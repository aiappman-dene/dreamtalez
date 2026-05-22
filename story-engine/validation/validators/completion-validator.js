/**
 * Completion Validator
 *
 * Detects truncated stories (ellipsis endings, mid-sentence cuts)
 * and checks that the ending contains proper bedtime closure language.
 *
 * Score: 1–10.
 */

const TRUNCATION_PATTERNS = [
  /\.\.\.$/,
  /who\.\.\.$/i,
  /and then\.\.\.$/i,
  /before she could\.\.\.$/i,
  /before he could\.\.\.$/i,
  /suddenly\.\.\.$/i,
];

const PROPER_ENDING_PATTERNS = [
  /sleep\./i,
  /dreams?\./i,
  /moon\./i,
  /stars?\./i,
  /night\./i,
  /safe\./i,
];

export class CompletionValidator {
  /**
   * @param {string} text - Full story text
   * @returns {{ section: string, score: number, warnings: string[], passed: boolean }}
   */
  validate(text = "") {
    let score = 10;
    const warnings = [];
    const trimmed = text.trim();

    for (const pattern of TRUNCATION_PATTERNS) {
      if (pattern.test(trimmed)) {
        score = 1;
        warnings.push("Story appears truncated — ends mid-thought");
        break;
      }
    }

    const hasProperEnding = PROPER_ENDING_PATTERNS.some((p) => p.test(trimmed));
    if (!hasProperEnding) {
      score -= 3;
      warnings.push("Weak bedtime closure — ending lacks sleep/dream/moon/stars/night/safe");
    }

    return {
      section: "completion",
      score:   Math.max(score, 1),
      warnings,
      passed:  score >= 8,
    };
  }
}

export default CompletionValidator;
