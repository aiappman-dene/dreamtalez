/**
 * Emotional Flow Validator
 *
 * Validates emotional warmth and continuity across the full story.
 * Checks that emotional language is distributed through the arc and
 * that the heart moment registers as emotionally distinct.
 *
 * Score: 1–10.
 */

const EMOTIONAL_WARMTH_WORDS = [
  "warm", "gentle", "soft", "comfort", "wonder", "loved", "safe",
  "brave", "kind", "tender", "peaceful", "cozy", "cosy", "magical",
  "belong", "together", "home", "smile", "laugh", "felt",
];

const HEART_MOMENT_SIGNALS = [
  "realised", "realized", "understood", "knew", "felt", "breathed",
  "let out", "paused", "something clicked", "became clear", "quiet moment",
  "whispered", "knew then", "always",
];

const MIN_WARMTH_COUNT = 4;
const MIN_HEART_SIGNALS = 1;

export class EmotionalFlowValidator {
  /**
   * @param {string} text - Full story text
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate(text = "") {
    let score = 10;
    const warnings = [];
    const lower = text.toLowerCase();

    // Emotional warmth density
    const warmthFound = EMOTIONAL_WARMTH_WORDS.filter((w) => lower.includes(w));
    if (warmthFound.length < MIN_WARMTH_COUNT) {
      score -= 3;
      warnings.push(`Weak emotional flow — only ${warmthFound.length} warmth signals (need ${MIN_WARMTH_COUNT}+)`);
    }

    // Heart moment detection — a story without a quiet internal realisation
    // has missed its emotional purpose
    const hasHeartMoment = HEART_MOMENT_SIGNALS.some((s) => lower.includes(s));
    if (!hasHeartMoment) {
      score -= 2;
      warnings.push("Heart moment missing — no internal realisation detected in story");
    }

    // Emotional arc — warmth should appear in second half as well as first
    const midpoint = Math.floor(text.length / 2);
    const firstHalf  = text.slice(0, midpoint).toLowerCase();
    const secondHalf = text.slice(midpoint).toLowerCase();
    const firstHalfWarmth  = EMOTIONAL_WARMTH_WORDS.filter((w) => firstHalf.includes(w)).length;
    const secondHalfWarmth = EMOTIONAL_WARMTH_WORDS.filter((w) => secondHalf.includes(w)).length;

    if (secondHalfWarmth < 2) {
      score -= 2;
      warnings.push("Emotional warmth absent in second half — ending feels cold");
    }
    if (firstHalfWarmth < 2) {
      score -= 1;
      warnings.push("Emotional warmth weak in first half — story opens cold");
    }

    // Told vs. shown — flag pure emotion-stating
    const toldEmotions = (text.match(/\bfelt (very )?(happy|sad|scared|brave|excited)\b/gi) || []).length;
    if (toldEmotions > 2) {
      score -= 1;
      warnings.push(`${toldEmotions} told emotions detected — show emotion through action, not statement`);
    }

    return {
      section:  "emotional-flow",
      score:    Math.max(score, 1),
      warnings,
    };
  }
}

export default EmotionalFlowValidator;
