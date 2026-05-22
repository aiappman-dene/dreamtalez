/**
 * Bedtime Softness Validator
 *
 * Validates that the story maintains bedtime-safe language throughout.
 * Any harsh, stimulating, or jarring language reduces this score.
 * Threshold is 9.0 — second only to the ending section in strictness.
 *
 * Score: 1–10.
 */

const HARSH_WORDS = [
  "shouted", "crashed", "terrified", "violent", "screamed", "exploded",
  "shattered", "danger", "attacked", "monster", "frightened", "horror",
  "nightmare", "evil", "trapped", "failed", "lost forever", "never coming back",
  "destroyed", "hurt badly",
];

const STIMULATING_PATTERNS = [
  { pattern: /[!]{2,}/g,         msg: "Multiple exclamation marks" },
  { pattern: /\bsuddenly\b/gi,   msg: '"suddenly" (abrupt energy spike)' },
  { pattern: /\bexploded\b/gi,   msg: '"exploded" (too intense)' },
  { pattern: /\bterrified\b/gi,  msg: '"terrified" (lingers in child\'s mind)' },
];

const HARSH_PENALTY  = 2;  // per harsh word found
const PATTERN_PENALTY = 1; // per stimulating pattern found

export class BedtimeSoftnessValidator {
  /**
   * @param {string} text - Full story text
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate(text = "") {
    let score = 10;
    const warnings = [];
    const lower = text.toLowerCase();

    // Harsh word check
    for (const word of HARSH_WORDS) {
      if (lower.includes(word)) {
        score -= HARSH_PENALTY;
        warnings.push(`Harsh bedtime wording: "${word}"`);
      }
    }

    // Stimulating pattern check
    for (const { pattern, msg } of STIMULATING_PATTERNS) {
      if (pattern.test(text)) {
        score -= PATTERN_PENALTY;
        warnings.push(`Stimulating element detected: ${msg}`);
        pattern.lastIndex = 0; // reset stateful regex
      }
    }

    // Unresolved tension check — story must not end on fear or uncertainty
    const endingSection = text.slice(Math.floor(text.length * 0.75)).toLowerCase();
    const endingHarsh = HARSH_WORDS.filter((w) => endingSection.includes(w));
    if (endingHarsh.length > 0) {
      score -= 2;
      warnings.push(`Harsh language in ending section: "${endingHarsh[0]}" — must be resolved before sleep transition`);
    }

    return {
      section:  "bedtime-softness",
      score:    Math.max(score, 1),
      warnings,
    };
  }
}

export default BedtimeSoftnessValidator;
