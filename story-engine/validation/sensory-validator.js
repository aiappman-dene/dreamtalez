/**
 * Sensory Validator
 *
 * Inspects modality balance (sight / sound / touch / smell / taste) and
 * the cozy bedtime atmosphere of the prose: moonlight, lantern glow,
 * snug blankets, drifting snowfall, hushed forests — the "soft moonlit
 * bedtime world" Bedtalez aims for.
 *
 * Bedtime prose leans heavily visual; we nudge toward the other senses
 * (especially touch and sound) without forcing every modality. We also
 * favor warm atmospheric imagery and warn when harsh imagery dominates.
 *
 * Pure inspection. No prose mutation. No model calls.
 */

import { tokenize, countMatches, buildResult, flag } from "./validator-utils.js";
import { SENSORY_LEXICON, COZY_ATMOSPHERE, HARSH_IMAGERY } from "../config/lexicons.js";

// Flat list across all cozy categories — used for atmosphere density.
const COZY_ALL = [
  ...COZY_ATMOSPHERE.light,
  ...COZY_ATMOSPHERE.shelter,
  ...COZY_ATMOSPHERE.gentle_nature,
  ...COZY_ATMOSPHERE.hush
];

export class SensoryValidator {
  constructor(config = {}) {
    this.minTotalDensity = config.minTotalDensity ?? 0.025; // sensory tokens per word
    this.minModalitiesPerScene = config.minModalitiesPerScene ?? 2;
    this.minModalitiesPerStory = config.minModalitiesPerStory ?? 4;
    this.maxSightShare = config.maxSightShare ?? 0.7;

    // Cozy atmosphere tunables.
    this.minCozyDensity = config.minCozyDensity ?? 0.012;        // ~12 atmosphere tokens per 1000 words
    this.minClosingCozyDensity = config.minClosingCozyDensity ?? 0.020; // closing scenes are warmer
    this.maxHarshDensity = config.maxHarshDensity ?? 0.005;      // harsh imagery should be rare

    this.sceneThreshold = config.thresholds?.scene ?? 72;
    this.storyThreshold = config.thresholds?.story ?? 75;
  }

  validateScene(sceneText, scenePayload = {}, context = {}) {
    const tokens = tokenize(sceneText);
    const wc = tokens.length || 1;
    const counts = modalityCounts(tokens);
    const total = sum(Object.values(counts));
    const density = total / wc;
    const modalitiesPresent = Object.values(counts).filter((c) => c > 0).length;
    const sightShare = total ? counts.sight / total : 0;

    const flags = [];

    if (density < this.minTotalDensity) {
      flags.push(
        flag(
          "low_immersion",
          density < this.minTotalDensity / 2 ? "high" : "medium",
          `sensory density ${density.toFixed(3)} below floor ${this.minTotalDensity}`,
          "Add tactile or auditory detail; bedtime needs felt-experience, not just description."
        )
      );
    }

    if (modalitiesPresent < this.minModalitiesPerScene) {
      flags.push(
        flag(
          "single_modality",
          "medium",
          `only ${modalitiesPresent} modality present`,
          "Layer at least one non-visual sense — touch, sound, or scent."
        )
      );
    }

    if (sightShare > this.maxSightShare && total >= 4) {
      flags.push(
        flag(
          "visual_dominant",
          sightShare > 0.85 ? "medium" : "low",
          `${(sightShare * 100).toFixed(0)}% of sensory cues are visual`,
          "Balance with sound, touch, or scent; bedtime wants atmosphere, not just imagery."
        )
      );
    }

    // Honor payload sensory_targets — if listed, scene should hit at least one.
    const targets = Array.isArray(scenePayload?.sensory_targets) ? scenePayload.sensory_targets : [];
    if (targets.length) {
      const lowerText = sceneText.toLowerCase();
      const hits = targets.filter((t) => t && lowerText.includes(String(t).toLowerCase()));
      if (!hits.length) {
        flags.push(
          flag(
            "missed_sensory_targets",
            "medium",
            `none of payload sensory_targets [${targets.slice(0, 3).join(", ")}] surface in prose`,
            "Honor at least one sensory target from the payload."
          )
        );
      }
    }

    // ── Cozy bedtime atmosphere ──────────────────────────────────────────
    const cozyCount = countMatches(tokens, COZY_ALL);
    const cozyDensity = cozyCount / wc;
    const harshCount = countMatches(tokens, HARSH_IMAGERY);
    const harshDensity = harshCount / wc;
    const isClosingScene = Boolean(
      scenePayload?.metadata?.isClosingScene
      || context?.isClosingScene
      || scenePayload?.scene_objectives?.some?.((o) => /closing|ending|final/i.test(o))
    );

    if (cozyDensity < this.minCozyDensity) {
      flags.push(
        flag(
          "low_cozy_atmosphere",
          cozyDensity < this.minCozyDensity / 2 ? "medium" : "low",
          `cozy imagery density ${cozyDensity.toFixed(3)} below floor ${this.minCozyDensity}`,
          "Layer in a soft bedtime image — moonlight on the windowsill, a lantern's glow, a snug blanket."
        )
      );
    }

    // Harsh imagery is fine in moderation if balanced by warmth; we only
    // flag when it's meaningful AND the scene lacks cozy counterweight.
    if (harshDensity > this.maxHarshDensity && cozyDensity < this.minCozyDensity * 1.5) {
      flags.push(
        flag(
          "harsh_imagery",
          harshDensity > this.maxHarshDensity * 2 ? "medium" : "low",
          `harsh imagery density ${harshDensity.toFixed(3)} without warm counterpoint`,
          "Soften sharp or cold imagery; bedtime atmosphere wants warmth and gentle motion."
        )
      );
    }

    // Closing scene must drift toward warmth — the world settling for sleep.
    if (isClosingScene && cozyDensity < this.minClosingCozyDensity) {
      flags.push(
        flag(
          "ending_lacks_warmth",
          cozyDensity < this.minClosingCozyDensity / 2 ? "medium" : "low",
          `closing scene cozy density ${cozyDensity.toFixed(3)} below closing floor ${this.minClosingCozyDensity}`,
          "Drift into stillness — name the warmth: a glowing lantern, a quilt tucked close, a hush over the room."
        )
      );
    }

    let score = 100;
    score -= clampPenalty((this.minTotalDensity - density) * 1500, 0, 30);
    if (modalitiesPresent < this.minModalitiesPerScene) score -= 12;
    if (sightShare > this.maxSightShare && total >= 4) {
      score -= clampPenalty((sightShare - this.maxSightShare) * 60, 0, 14);
    }
    if (flags.find((f) => f.type === "missed_sensory_targets")) score -= 10;
    // Cozy/harsh — light penalties; these steer atmosphere rather than block.
    if (cozyDensity < this.minCozyDensity) {
      score -= clampPenalty((this.minCozyDensity - cozyDensity) * 1200, 0, 14);
    }
    if (harshDensity > this.maxHarshDensity && cozyDensity < this.minCozyDensity * 1.5) {
      score -= clampPenalty((harshDensity - this.maxHarshDensity) * 1500, 0, 12);
    }
    if (isClosingScene && cozyDensity < this.minClosingCozyDensity) {
      score -= clampPenalty((this.minClosingCozyDensity - cozyDensity) * 1000, 0, 14);
    }

    return buildResult({
      validator: "sensory",
      level: "scene",
      score,
      threshold: this.sceneThreshold,
      flags,
      metrics: {
        wordCount: wc,
        counts,
        density: Number(density.toFixed(4)),
        modalitiesPresent,
        sightShare: Number(sightShare.toFixed(2)),
        targets,
        cozyDensity: Number(cozyDensity.toFixed(4)),
        harshDensity: Number(harshDensity.toFixed(4)),
        isClosingScene
      }
    });
  }

  validateStory(scenes = [], storyContext = {}) {
    const flags = [];
    const sceneTexts = scenes.map((s) => (typeof s === "string" ? s : s.text || ""));
    const totals = { sight: 0, sound: 0, touch: 0, smell: 0, taste: 0 };
    let totalWords = 0;

    for (const text of sceneTexts) {
      const tokens = tokenize(text);
      totalWords += tokens.length;
      const c = modalityCounts(tokens);
      for (const k of Object.keys(totals)) totals[k] += c[k];
    }

    const modalitiesPresent = Object.values(totals).filter((c) => c > 0).length;
    if (modalitiesPresent < this.minModalitiesPerStory) {
      flags.push(
        flag(
          "story_sensory_narrow",
          "medium",
          `only ${modalitiesPresent}/5 modalities used across full story`,
          "Diversify modalities across scenes — touch and sound especially."
        )
      );
    }

    const total = sum(Object.values(totals));
    const sightShare = total ? totals.sight / total : 0;
    if (sightShare > this.maxSightShare) {
      flags.push(
        flag(
          "story_visual_dominant",
          sightShare > 0.85 ? "medium" : "low",
          `${(sightShare * 100).toFixed(0)}% of story sensory cues are visual`,
          "Bring more atmosphere from non-visual senses across scenes."
        )
      );
    }

    // Tail warmth — closing scenes should drift toward more atmospheric warmth,
    // not less. Compute cozy density per scene and compare the tail to the head.
    const cozyDensitiesPerScene = sceneTexts.map((text) => {
      const toks = tokenize(text);
      return toks.length ? countMatches(toks, COZY_ALL) / toks.length : 0;
    });

    let tailWarmthDelta = 0;
    let tailLength = 0;
    if (cozyDensitiesPerScene.length >= 3) {
      tailLength = Math.max(2, Math.ceil(cozyDensitiesPerScene.length * 0.25));
      const headSlice = cozyDensitiesPerScene.slice(0, -tailLength);
      const tailSlice = cozyDensitiesPerScene.slice(-tailLength);
      const headAvg = headSlice.length ? sum(headSlice) / headSlice.length : 0;
      const tailAvg = tailSlice.length ? sum(tailSlice) / tailSlice.length : 0;
      tailWarmthDelta = tailAvg - headAvg;

      // Tail should be at least as cozy as the head; flag if it drops materially.
      if (tailAvg < headAvg * 0.85 && headAvg > 0.005) {
        flags.push(
          flag(
            "tail_warmth_descending",
            tailAvg < headAvg * 0.65 ? "medium" : "low",
            `tail cozy density ${tailAvg.toFixed(3)} below head average ${headAvg.toFixed(3)}`,
            "Soften the closing scenes — let glow, hush, and warm imagery deepen toward sleep."
          )
        );
      }
    }

    let score = 100;
    if (modalitiesPresent < this.minModalitiesPerStory) {
      score -= (this.minModalitiesPerStory - modalitiesPresent) * 8;
    }
    if (sightShare > this.maxSightShare) {
      score -= clampPenalty((sightShare - this.maxSightShare) * 60, 0, 16);
    }
    if (flags.find((f) => f.type === "tail_warmth_descending")) {
      score -= clampPenalty(-tailWarmthDelta * 1500, 0, 14);
    }

    return buildResult({
      validator: "sensory",
      level: "story",
      score,
      threshold: this.storyThreshold,
      flags,
      metrics: {
        totalWords,
        totals,
        modalitiesPresent,
        sightShare: Number(sightShare.toFixed(2)),
        cozyDensitiesPerScene: cozyDensitiesPerScene.map((d) => Number(d.toFixed(4))),
        tailLength,
        tailWarmthDelta: Number(tailWarmthDelta.toFixed(4))
      }
    });
  }
}

function modalityCounts(tokens) {
  return {
    sight: countMatches(tokens, SENSORY_LEXICON.sight),
    sound: countMatches(tokens, SENSORY_LEXICON.sound),
    touch: countMatches(tokens, SENSORY_LEXICON.touch),
    smell: countMatches(tokens, SENSORY_LEXICON.smell),
    taste: countMatches(tokens, SENSORY_LEXICON.taste)
  };
}

function sum(arr) {
  return arr.reduce((s, v) => s + v, 0);
}

function clampPenalty(value, min, max) {
  if (Number.isNaN(value) || value < min) return min;
  if (value > max) return max;
  return value;
}

export default SensoryValidator;
