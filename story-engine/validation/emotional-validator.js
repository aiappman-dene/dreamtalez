/**
 * Emotional Validator
 *
 * Bedtalez's emotional target is "warm bedtime magic" — sweet, cozy,
 * reassuring. This validator measures comfort anchors (warmth + wonder
 * + reassurance) and treats discomfort vocabulary as something to remove,
 * NOT as a dimension to model. Stories should feel cozy, never analytical.
 *
 * Inspects:
 *  - presence of comfort anchors (warmth, wonder, reassurance)
 *  - discomfort vocabulary against a flat low ceiling (no per-payload tolerance)
 *  - cross-scene continuity of warmth, and a warm closing scene
 *
 * Pure inspection. No prose mutation. No model calls.
 */

import { splitSentences, tokenize, countMatches, buildResult, flag } from "./validator-utils.js";
import { TONE_LEXICON } from "../config/lexicons.js";

export class EmotionalValidator {
  constructor(config = {}) {
    this.minWarmthDensity = config.minWarmthDensity ?? 0.012; // warmth tokens per word
    this.maxUneaseDensity = config.maxUneaseDensity ?? 0.020;
    this.maxNeighborJump = config.maxNeighborJump ?? 35;       // 0-100 tone delta between adjacent scenes
    this.sceneThreshold = config.thresholds?.scene ?? 78;
    this.storyThreshold = config.thresholds?.story ?? 80;
  }

  validateScene(sceneText, scenePayload = {}, context = {}) {
    const tokens = tokenize(sceneText);
    const wordCount = tokens.length || 1;
    const profile = toneProfile(tokens, wordCount);

    const flags = [];
    const target = scenePayload.emotional_state || {};

    // Comfort anchor: warmth should always be present in a bedtime scene.
    if (profile.warmthDensity < this.minWarmthDensity) {
      flags.push(
        flag(
          "low_warmth",
          profile.warmthDensity < this.minWarmthDensity / 2 ? "high" : "medium",
          `warmth density ${profile.warmthDensity.toFixed(3)} below floor ${this.minWarmthDensity}`,
          "Weave in cozy warmth: a held hand, a soft blanket, a steady breath, a kind word."
        )
      );
    }

    // Discomfort vocabulary is removed, not modeled. The payload's `nervousness`
    // field is intentionally ignored here — Bedtalez does not scale tolerance
    // up because a scene "should feel anxious." There is no such mode.
    const allowedUnease = this.maxUneaseDensity;
    if (profile.uneaseDensity > allowedUnease) {
      flags.push(
        flag(
          "tone_overshoot",
          profile.uneaseDensity > allowedUnease * 2 ? "high" : "medium",
          `discomfort density ${profile.uneaseDensity.toFixed(3)} exceeds bedtime ceiling ${allowedUnease.toFixed(3)}`,
          "Remove nervous or fearful imagery; replace with coziness — a held hand, a soft blanket, a kind word."
        )
      );
    }

    // Wonder is a comfort anchor for bedtime magic. If the payload calls for
    // wonder, the prose should carry at least a faint shimmer of it.
    const targetWonder = numberOr(target.wonder, 6) / 10;
    if (targetWonder >= 0.6 && profile.wonderDensity < 0.008) {
      flags.push(
        flag(
          "missing_wonder",
          "low",
          `payload wonder=${(targetWonder * 10).toFixed(1)} but wonder density ${profile.wonderDensity.toFixed(3)}`,
          "Add a small bedtime marvel — a shimmer, a moonlit edge, a quiet glow."
        )
      );
    }

    // Adjacent-sentence tone shift — a warm line directly followed by an
    // uneasy line breaks the bedtime spell. We only fire on warm→uneasy
    // pivots (sign change), not warm→neutral, which is just normal prose.
    const sentenceShifts = findAdjacentToneShifts(sceneText);
    const isWarmToUneasy = sentenceShifts.fromScore > 0.05 && sentenceShifts.toScore < -0.02;
    if (isWarmToUneasy && sentenceShifts.worstDelta > 0.12) {
      flags.push(
        flag(
          "abrupt_sentence_shift",
          sentenceShifts.worstDelta > 0.22 ? "medium" : "low",
          `warmth → unease pivot between sentence ${sentenceShifts.worstAt - 1} and ${sentenceShifts.worstAt}`,
          "Bridge the moment with a soft sensory beat — moonlight, breath, a held hand."
        )
      );
    }

    const score =
      100
      - clampPenalty((this.minWarmthDensity - profile.warmthDensity) * 1500, 0, 30)
      - clampPenalty((profile.uneaseDensity - allowedUnease) * 1200, 0, 35)
      - (flags.find((f) => f.type === "missing_wonder") ? 8 : 0)
      - (isWarmToUneasy && sentenceShifts.worstDelta > 0.12
           ? clampPenalty((sentenceShifts.worstDelta - 0.12) * 80, 0, 12)
           : 0);

    return buildResult({
      validator: "emotional",
      level: "scene",
      score,
      threshold: this.sceneThreshold,
      flags,
      metrics: {
        wordCount,
        ...profile,
        comfortAnchors: {
          warmth_floor: this.minWarmthDensity,
          discomfort_ceiling: Number(allowedUnease.toFixed(4)),
          wonder_target: Number(targetWonder.toFixed(2))
        },
        worstAdjacentToneDelta: Number(sentenceShifts.worstDelta.toFixed(3)),
        worstAdjacentToneAt: sentenceShifts.worstAt
      }
    });
  }

  validateStory(scenes = [], storyContext = {}) {
    const flags = [];
    const profiles = scenes.map((s, i) => {
      const text = typeof s === "string" ? s : s.text || "";
      const tokens = tokenize(text);
      const wc = tokens.length || 1;
      return { index: i, ...toneProfile(tokens, wc) };
    });

    if (profiles.length < 2) {
      return buildResult({
        validator: "emotional",
        level: "story",
        score: 100,
        threshold: this.storyThreshold,
        metrics: { profiles }
      });
    }

    let maxJump = 0;
    let jumpAt = -1;
    for (let i = 1; i < profiles.length; i += 1) {
      const prev = toneScore(profiles[i - 1]);
      const cur = toneScore(profiles[i]);
      const delta = Math.abs(cur - prev);
      if (delta > maxJump) {
        maxJump = delta;
        jumpAt = i;
      }
      if (delta > this.maxNeighborJump) {
        flags.push(
          flag(
            "abrupt_emotional_shift",
            delta > this.maxNeighborJump * 1.5 ? "high" : "medium",
            `tone delta ${delta.toFixed(1)} between scene ${i - 1} and scene ${i}`,
            "Carry warmth forward between scenes; let coziness flow gently rather than jumping."
          )
        );
      }
    }

    // Final scene must be the warmest in the bottom half of unease.
    const last = profiles[profiles.length - 1];
    const lastWarmthRank = profiles.filter((p) => p.warmthDensity > last.warmthDensity).length;
    if (lastWarmthRank > Math.floor(profiles.length / 2)) {
      flags.push(
        flag(
          "cool_ending",
          "medium",
          `final scene warmth ranks ${lastWarmthRank + 1} of ${profiles.length}`,
          "End on the warmest, coziest beat — name the comfort: home, held, loved, safe."
        )
      );
    }

    const score = 100 - clampPenalty(maxJump - this.maxNeighborJump, 0, 25)
      - (flags.find((f) => f.type === "cool_ending") ? 12 : 0);

    return buildResult({
      validator: "emotional",
      level: "story",
      score,
      threshold: this.storyThreshold,
      flags,
      metrics: {
        sceneCount: profiles.length,
        maxNeighborJump: Number(maxJump.toFixed(1)),
        maxJumpAt: jumpAt,
        profiles
      }
    });
  }
}

/**
 * Walk adjacent sentences and detect sharp tone pivots between neighbors.
 * Each sentence gets a small composite score: warmth/comfort tokens minus
 * unease tokens, normalized by sentence length. We return the worst delta.
 *
 * Cheap: O(total tokens). No allocations beyond the two helpers below.
 */
function findAdjacentToneShifts(text) {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return { worstDelta: 0, worstAt: -1, fromScore: 0, toScore: 0 };
  const scores = sentences.map(sentenceToneScore);
  let worstDelta = 0;
  let worstAt = -1;
  let fromScore = 0;
  let toScore = 0;
  for (let i = 1; i < scores.length; i += 1) {
    const d = Math.abs(scores[i] - scores[i - 1]);
    if (d > worstDelta) {
      worstDelta = d;
      worstAt = i;
      fromScore = scores[i - 1];
      toScore = scores[i];
    }
  }
  return { worstDelta, worstAt, fromScore, toScore };
}

function sentenceToneScore(sentence) {
  const toks = tokenize(sentence);
  const wc = toks.length || 1;
  const warmthHits  = countMatches(toks, TONE_LEXICON.warmth)
                    + countMatches(toks, TONE_LEXICON.comfort);
  const uneaseHits  = countMatches(toks, TONE_LEXICON.unease);
  // Range roughly -1..+1, but in practice clusters near 0 unless lexicon-heavy.
  return (warmthHits - uneaseHits) / wc;
}

function toneProfile(tokens, wordCount) {
  const warmth = countMatches(tokens, TONE_LEXICON.warmth);
  const wonder = countMatches(tokens, TONE_LEXICON.wonder);
  const comfort = countMatches(tokens, TONE_LEXICON.comfort);
  const reassurance = countMatches(tokens, TONE_LEXICON.reassurance);
  const unease = countMatches(tokens, TONE_LEXICON.unease);
  return {
    warmthDensity: warmth / wordCount,
    wonderDensity: wonder / wordCount,
    comfortDensity: comfort / wordCount,
    reassuranceDensity: reassurance / wordCount,
    uneaseDensity: unease / wordCount
  };
}

function toneScore(profile) {
  // 0..100 composite — higher = warmer, calmer
  return Math.max(
    0,
    Math.min(
      100,
      (profile.warmthDensity * 1500)
      + (profile.comfortDensity * 1200)
      + (profile.reassuranceDensity * 800)
      - (profile.uneaseDensity * 1500)
      + 50
    )
  );
}

function numberOr(value, fallback) {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function clampPenalty(value, min, max) {
  if (Number.isNaN(value) || value < min) return min;
  if (value > max) return max;
  return value;
}

export default EmotionalValidator;
