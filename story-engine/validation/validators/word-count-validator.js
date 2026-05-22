/**
 * Word Count Validator
 *
 * Enforces the story word budget. A story over maximumWords is
 * a hard fail (score=1). A story significantly under budget may
 * feel underdeveloped.
 *
 * Score: 1–10.
 */

export class WordCountValidator {
  /**
   * @param {{ story: string, maximumWords: number }} opts
   * @returns {{ section: string, score: number, warnings: string[], wordCount: number, passed: boolean }}
   */
  validate({ story = "", maximumWords = 1000 }) {
    const wordCount = story.trim().split(/\s+/).filter(Boolean).length;
    let score = 10;
    const warnings = [];

    if (wordCount > maximumWords) {
      score = 1;
      warnings.push(`Story exceeds maximum word limit (${wordCount}/${maximumWords})`);
    } else if (wordCount < maximumWords * 0.65) {
      score -= 2;
      warnings.push(`Story may feel underdeveloped — ${wordCount} words (target ≥${Math.floor(maximumWords * 0.65)})`);
    }

    return {
      section:   "word-count",
      score,
      warnings,
      wordCount,
      passed:    score >= 8,
    };
  }
}

export default WordCountValidator;
