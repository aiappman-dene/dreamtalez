/**
 * Pacing Budget Validator
 *
 * Checks that each section stays within its allocated word budget.
 * Opening too long = slow start. Ending too short = rushed sleep
 * transition. Middle bloated = pacing drags.
 *
 * Score: 1–10.
 */

export class PacingBudgetValidator {
  /**
   * @param {{
   *   opening: string,
   *   middle: string,
   *   ending: string,
   *   budgets: { opening: number, middle: number, ending: number },
   * }} opts
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate({ opening = "", middle = "", ending = "", budgets = {} }) {
    const count = (s) => s.trim().split(/\s+/).filter(Boolean).length;

    const openingWords = count(opening);
    const middleWords  = count(middle);
    const endingWords  = count(ending);

    let score = 10;
    const warnings = [];

    if (budgets.opening && openingWords > budgets.opening * 1.25) {
      score -= 2;
      warnings.push(`Opening pacing too long — ${openingWords} words (budget ${budgets.opening})`);
    }

    if (budgets.ending && endingWords < budgets.ending * 0.60) {
      score -= 3;
      warnings.push(`Ending emotionally rushed — ${endingWords} words (minimum ${Math.floor(budgets.ending * 0.60)})`);
    }

    if (budgets.middle && middleWords > budgets.middle * 1.35) {
      score -= 2;
      warnings.push(`Middle pacing bloated — ${middleWords} words (budget ${budgets.middle})`);
    }

    return {
      section: "pacing-budget",
      score:   Math.max(score, 1),
      warnings,
    };
  }
}

export default PacingBudgetValidator;
