/**
 * Refinement Advisor
 *
 * Future-safe interface for Phase 2 targeted refinement.
 *
 * Phase 1.5 contract:
 *   - inspect a validation report
 *   - decide which validators are in the "refine" tier
 *   - emit advisory directives + corrective prompt fragments
 *   - emit optional soft scoring adjustments (tuning experiments)
 *
 * Phase 1.5 explicitly does NOT:
 *   - call models
 *   - re-run validation
 *   - mutate scenes
 *   - trigger retries
 *
 * Phase 2 will read advise() output to drive an actual refinement loop.
 */

import { VALIDATION_THRESHOLDS } from "../config/validation-thresholds.js";

/**
 * Default corrective-prompt fragments. These are advisory text only —
 * the orchestrator decides whether and how to use them in Phase 2.
 *
 * Keep them short and renderer-friendly: imperative voice, one fix per line.
 */
export const DEFAULT_CORRECTIVE_PROMPTS = {
  repetition:
    "Vary sentence beginnings and avoid reusing the same imagery; rephrase repeated motifs with synonymous bedtime language.",
  emotional:
    "Lead with cozy warmth and reassurance: a held hand, a steady breath, a soft endearment. Remove any nervous, fearful, or anxious imagery — Bedtalez stories replace unease with coziness, never explore it.",
  "bedtime-safety":
    "Remove all violent, loud, or distressing vocabulary. Resolve any tension and end on a settling, declarative beat that names the comfort (home, held, safe, loved).",
  pacing:
    "Slow the verbs and lengthen the breath. Replace action with observation, especially toward the close.",
  "prose-rhythm":
    "Vary sentence length; break run-ons; trim comma chains. Bedtime cadence prefers short-medium-short rhythms.",
  sensory:
    "Layer warm bedtime atmosphere — moonlight, a lantern's glow, a snug blanket, a hush across the room. Balance modalities (tactile, sound, gentle motion) without overwriting; honor the payload's sensory_targets. Soften any sharp or cold imagery into warmth.",
  continuity:
    "Anchor the protagonist by name. Carry the recurring motif into this scene; do not let characters drift between scenes.",
  "reading-level":
    "Simplify vocabulary and shorten clauses. Match the bedtime read-aloud target for the child's age band."
};

export class RefinementAdvisor {
  constructor({
    thresholds = VALIDATION_THRESHOLDS,
    correctivePrompts = DEFAULT_CORRECTIVE_PROMPTS,
    softAdjustments = []
  } = {}) {
    this.thresholds = thresholds;
    this.correctivePrompts = { ...correctivePrompts };
    this.softAdjustments = [...softAdjustments];
  }

  /**
   * Override or add a corrective prompt for a specific validator.
   * Phase 2 orchestration will read this map.
   */
  registerCorrectivePrompt(validator, prompt) {
    if (typeof prompt !== "string" || !prompt.trim()) return;
    this.correctivePrompts[validator] = prompt.trim();
  }

  /**
   * Register a soft scoring adjustment.
   *
   * adjustment shape: { validator, level: "scene"|"story", delta: number, reason?: string }
   *
   * Adjustments are applied derivatively — they never mutate the original
   * report. Use them to A/B test threshold proposals without editing
   * validator code.
   */
  registerSoftAdjustment(adjustment) {
    if (!adjustment || typeof adjustment.validator !== "string") return;
    this.softAdjustments.push({
      validator: adjustment.validator,
      level: adjustment.level || "scene",
      delta: typeof adjustment.delta === "number" ? adjustment.delta : 0,
      reason: adjustment.reason || null
    });
  }

  /**
   * Inspect a validation report and emit advisory directives.
   *
   * Returns:
   *   {
   *     level,
   *     directives: [{ validator, tier, score, fail, refine, prompt }],
   *     adjustedScores: { validator: number },
   *     wouldRefine: boolean
   *   }
   *
   * Returns null on missing/invalid input.
   */
  advise(report) {
    if (!report || typeof report !== "object" || !report.results) return null;
    const level = report.level || "scene";
    const directives = [];
    const adjustedScores = {};

    for (const r of Object.values(report.results)) {
      const tiers = this.thresholds[r.validator]?.[level];
      const adjusted = this.applyAdjustments(r.validator, level, r.score);
      if (adjusted !== r.score) adjustedScores[r.validator] = adjusted;

      const tier = classifyScore(adjusted, tiers);
      if (tier === "fail" || tier === "refine") {
        directives.push({
          validator: r.validator,
          tier,
          score: r.score,
          adjustedScore: adjusted,
          failThreshold: tiers?.fail ?? null,
          refineThreshold: tiers?.refine ?? null,
          prompt: this.correctivePrompts[r.validator] || null,
          severity: tier === "fail" ? "high" : "medium"
        });
      }
    }

    return {
      level,
      sceneId: report.sceneId || null,
      directives,
      adjustedScores,
      wouldRefine: directives.length > 0
    };
  }

  /**
   * Apply registered soft adjustments to a single (validator, level) score.
   * Pure function — does not mutate the advisor's adjustment list or the report.
   */
  applyAdjustments(validator, level, score) {
    if (typeof score !== "number") return score;
    let total = 0;
    for (const adj of this.softAdjustments) {
      if (adj.validator === validator && adj.level === level) total += adj.delta;
    }
    if (!total) return score;
    const next = Math.max(0, Math.min(100, score + total));
    return Math.round(next * 10) / 10;
  }
}

function classifyScore(score, tiers) {
  if (!tiers || typeof score !== "number") return "pass";
  if (score < tiers.fail) return "fail";
  if (score < tiers.refine) return "refine";
  if (score < tiers.warn) return "warn";
  return "pass";
}

export default RefinementAdvisor;
