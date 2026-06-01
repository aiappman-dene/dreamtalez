/**
 * Adaptive Story Length Validator
 *
 * Validates that the story stays within the 1200–1500 word premium runtime.
 * Bedtalez's ~8–10 minute bedtime ritual is a core product promise — stories
 * that are too short feel cheap; too long breaks the ritual.
 *
 * Returns { passed, warnings, metrics }
 */

const MIN_WORDS = 600;
const MAX_WORDS = 1000;
const IDEAL_MIN = 650;
const IDEAL_MAX = 850;

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * @param {string} story
 * @returns {{ passed: boolean, warnings: object[], metrics: object }}
 */
export class AdaptiveStoryLengthValidator {
  validate(story = "") {
    const warnings = [];
    const wordCount = countWords(story);

    if (wordCount < MIN_WORDS) {
      warnings.push({
        type:     "story_too_short",
        severity: "medium",
        evidence: `Story is ${wordCount} words — minimum is ${MIN_WORDS} for a 5–8 minute bedtime ritual`,
      });
    } else if (wordCount > MAX_WORDS) {
      warnings.push({
        type:     "story_too_long",
        severity: "medium",
        evidence: `Story is ${wordCount} words — maximum is ${MAX_WORDS}; trim to preserve ritual pacing`,
      });
    } else if (wordCount < IDEAL_MIN) {
      warnings.push({
        type:     "story_slightly_short",
        severity: "low",
        evidence: `Story is ${wordCount} words — aim for ${IDEAL_MIN}–${IDEAL_MAX} for optimal read-aloud time`,
      });
    } else if (wordCount > IDEAL_MAX) {
      warnings.push({
        type:     "story_slightly_long",
        severity: "low",
        evidence: `Story is ${wordCount} words — slightly above ideal range of ${IDEAL_MIN}–${IDEAL_MAX}`,
      });
    }

    // Paragraph count sanity check — too few = walls of text; too many = choppy
    const paragraphs = story.split(/\n\n+/).filter((p) => p.trim().length > 20);
    if (paragraphs.length < 6) {
      warnings.push({
        type:     "too_few_paragraphs",
        severity: "low",
        evidence: `Only ${paragraphs.length} paragraphs — story may feel like a wall of text`,
      });
    } else if (paragraphs.length > 25) {
      warnings.push({
        type:     "too_many_paragraphs",
        severity: "low",
        evidence: `${paragraphs.length} paragraphs — story may feel too fragmented`,
      });
    }

    return {
      passed:  warnings.filter((w) => w.severity === "high" || w.severity === "medium").length === 0,
      warnings,
      metrics: { wordCount, paragraphCount: paragraphs.length },
    };
  }
}

export default AdaptiveStoryLengthValidator;
