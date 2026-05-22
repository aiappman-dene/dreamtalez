/**
 * Middle Validator
 *
 * Validates the middle section — adventure + emotional arc development.
 * Checks for narrative development, emotional immersion, and pacing.
 *
 * Score: 1–10.
 */

const EMOTIONAL_IMMERSION_SIGNALS = [
  "felt", "noticed", "softly", "gently", "wondered", "realised", "realized",
  "understood", "discovered", "breathed", "paused", "smiled", "warmth",
];

const ABRUPT_PACING_WORD = "suddenly";
const MAX_SUDDEN_USES = 3;

const MIN_PARAGRAPH_COUNT = 5;
const MIN_MIDDLE_LENGTH   = 600; // characters

const FORWARD_MOMENTUM_SIGNALS = [
  "followed", "walked", "climbed", "stepped", "found", "reached",
  "arrived", "turned", "crossed", "moved", "went deeper", "ventured",
];

export class MiddleValidator {
  /**
   * @param {string} text - Middle section text
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate(text = "") {
    let score = 10;
    const warnings = [];
    const lower = text.toLowerCase();

    // Development check — paragraph count
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 20);
    if (paragraphs.length < MIN_PARAGRAPH_COUNT) {
      score -= 2;
      warnings.push(`Middle underdeveloped — only ${paragraphs.length} paragraphs (need ${MIN_PARAGRAPH_COUNT}+)`);
    }

    // Length check
    if (text.length < MIN_MIDDLE_LENGTH) {
      score -= 1;
      warnings.push(`Middle section too short (${text.length} chars)`);
    }

    // Abrupt pacing check
    const suddenCount = (lower.match(/\bsuddenly\b/g) || []).length;
    if (suddenCount > MAX_SUDDEN_USES) {
      score -= 1;
      warnings.push(`Abrupt pacing — "suddenly" used ${suddenCount} times (max ${MAX_SUDDEN_USES})`);
    }

    // Emotional immersion
    const hasImmersion = EMOTIONAL_IMMERSION_SIGNALS.some((s) => lower.includes(s));
    if (!hasImmersion) {
      score -= 2;
      warnings.push("Weak emotional immersion — middle lacks felt/noticed/softly/gently language");
    }

    // Forward momentum — story must be going somewhere
    const hasMomentum = FORWARD_MOMENTUM_SIGNALS.some((s) => lower.includes(s));
    if (!hasMomentum) {
      score -= 1;
      warnings.push("Weak narrative momentum — middle lacks directional movement");
    }

    // Excitement cap — no exclamation marks in second half of middle
    const exclamations = (text.match(/!/g) || []).length;
    if (exclamations > 3) {
      score -= 1;
      warnings.push(`${exclamations} exclamation marks in middle section — reduces bedtime calm`);
    }

    return {
      section:  "middle",
      score:    Math.max(score, 1),
      warnings,
    };
  }
}

export default MiddleValidator;
