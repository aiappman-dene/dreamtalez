/**
 * Section Balance Validator
 *
 * Checks the proportional balance of story sections.
 * The ending must be substantive relative to the whole —
 * a rushed ending breaks the bedtime ritual.
 *
 * Score: 1–10.
 */

const MIN_ENDING_RATIO = 0.12; // ending should be at least 12% of total

export class SectionBalanceValidator {
  /**
   * @param {{ opening: string, middle: string, ending: string }} opts
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate({ opening = "", middle = "", ending = "" }) {
    const count = (s) => s.trim().split(/\s+/).filter(Boolean).length;

    const openingWords = count(opening);
    const middleWords  = count(middle);
    const endingWords  = count(ending);
    const total = openingWords + middleWords + endingWords;

    let score = 10;
    const warnings = [];

    if (total === 0) {
      return { section: "section-balance", score: 1, warnings: ["Story is empty"] };
    }

    const endingRatio = endingWords / total;

    if (endingRatio < MIN_ENDING_RATIO) {
      score -= 3;
      warnings.push(
        `Ending too short relative to story — ${(endingRatio * 100).toFixed(1)}% (need ≥${(MIN_ENDING_RATIO * 100).toFixed(0)}%)`
      );
    }

    return {
      section: "section-balance",
      score,
      warnings,
    };
  }
}

export default SectionBalanceValidator;
