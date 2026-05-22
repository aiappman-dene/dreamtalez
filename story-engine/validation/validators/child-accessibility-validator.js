/**
 * Child Accessibility Validator
 *
 * Flags abstract philosophical phrasing that goes over a child's head
 * and sentences too long for comfortable bedtime reading.
 *
 * Score: 1–10.
 */

const ABSTRACT_PHRASES = [
  "something she could not name",
  "something he could not name",
  "a feeling beyond words",
  "a sense of existence",
  "the meaning of it all",
  "the nature of being",
  "ontological",
  "existential",
];

const MAX_LONG_SENTENCES = 5;
const LONG_SENTENCE_CHARS = 180; // characters without punctuation = too long

export class ChildAccessibilityValidator {
  /**
   * @param {string} text - Full story text
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate(text = "") {
    let score = 10;
    const warnings = [];
    const lower = text.toLowerCase();

    for (const phrase of ABSTRACT_PHRASES) {
      if (lower.includes(phrase)) {
        score -= 2;
        warnings.push(`Abstract phrasing detected: "${phrase}" — replace with a concrete feeling`);
      }
    }

    const longSentences = (text.match(/[^.!?]{180,}[.!?]/g) || []).length;
    if (longSentences > MAX_LONG_SENTENCES) {
      score -= 2;
      warnings.push(`${longSentences} overly long sentences — aim for shorter, breathable prose`);
    }

    return {
      section: "child-accessibility",
      score:   Math.max(score, 1),
      warnings,
    };
  }
}

export default ChildAccessibilityValidator;
