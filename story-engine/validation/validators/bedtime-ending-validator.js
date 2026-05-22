/**
 * Bedtime Ending Validator
 *
 * Validates that the ending section has a proper calming descent
 * into sleep and contains no overstimulating language.
 *
 * Score: 1–10.
 */

const CALMING_WORDS = [
  "sleep", "dream", "blanket", "stars",
  "moon", "quiet", "safe", "warm",
];

const OVERSTIMULATING_WORDS = [
  "exploded", "screamed", "terrified", "crashed",
  "roared", "burst", "shattered", "danger",
];

const MIN_CALMING_HITS = 4;

export class BedtimeEndingValidator {
  /**
   * @param {string} text - Ending section text (last 25% of story)
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate(text = "") {
    let score = 10;
    const warnings = [];
    const lower = text.toLowerCase();

    const calmingHits = CALMING_WORDS.filter((w) => lower.includes(w)).length;
    if (calmingHits < MIN_CALMING_HITS) {
      score -= 3;
      warnings.push(
        `Ending lacks calming descent — only ${calmingHits} sleep signals (need ${MIN_CALMING_HITS}+)`
      );
    }

    for (const word of OVERSTIMULATING_WORDS) {
      if (lower.includes(word)) {
        score -= 3;
        warnings.push(`Overstimulating word in ending: "${word}"`);
      }
    }

    return {
      section: "bedtime-ending",
      score:   Math.max(score, 1),
      warnings,
    };
  }
}

export default BedtimeEndingValidator;
