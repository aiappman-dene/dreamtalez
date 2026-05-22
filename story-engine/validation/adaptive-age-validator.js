/**
 * Adaptive Age Validator
 *
 * Checks that the story's vocabulary level and sentence rhythm match
 * the child's age profile. Catches stories that are too complex for toddlers
 * or too simple for older children.
 *
 * Returns { passed, warnings, metrics }
 */

// Words unlikely to appear in toddler/preschool stories
const COMPLEX_VOCABULARY = [
  "consequently", "furthermore", "nevertheless", "approximately", "inevitably",
  "particularly", "significantly", "simultaneously", "throughout", "comprehend",
  "extraordinary", "magnificent", "treacherous", "formidable", "melancholy",
  "bewildered", "persevered", "reluctantly", "contemplated", "overwhelmed",
];

// Words that signal age-appropriate simplicity (good for toddler/preschool)
const SIMPLE_SIGNALS = [
  "cozy", "tiny", "fluffy", "sleepy", "giggled", "wiggled", "snuggled",
  "bounced", "yummy", "sparkly", "twinkled", "plopped",
];

/**
 * @param {string} story
 * @param {{ vocabularyLevel?: string, ageRange?: number }} opts
 * @returns {{ passed: boolean, warnings: object[], metrics: object }}
 */
export class AdaptiveAgeValidator {
  validate(story = "", { vocabularyLevel = "simple", ageRange = 5 } = {}) {
    const warnings = [];
    const storyLower  = story.toLowerCase();
    const sentences   = story.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 5);
    const avgSentenceLen = sentences.length > 0
      ? sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length
      : 0;

    const isYoung = ["very-simple", "simple"].includes(vocabularyLevel);
    const isOlder = ["rich", "advanced"].includes(vocabularyLevel);

    // Young children: flag complex vocabulary
    if (isYoung) {
      const complexFound = COMPLEX_VOCABULARY.filter((w) => storyLower.includes(w));
      if (complexFound.length > 2) {
        warnings.push({
          type:     "vocabulary_too_complex",
          severity: "low",
          evidence: `${complexFound.length} complex word(s) found for age ${ageRange}: "${complexFound.slice(0, 3).join('", "')}"`,
        });
      }

      // Average sentence too long for young children
      if (avgSentenceLen > 16) {
        warnings.push({
          type:     "sentences_too_long",
          severity: "low",
          evidence: `Average sentence length ${Math.round(avgSentenceLen)} words — for age ${ageRange} aim for ≤12`,
        });
      }
    }

    // Older children: flag overly simple vocabulary (regression check)
    if (isOlder) {
      const simpleCount = SIMPLE_SIGNALS.filter((w) => storyLower.includes(w)).length;
      if (simpleCount > 4) {
        warnings.push({
          type:     "vocabulary_too_simple",
          severity: "low",
          evidence: `${simpleCount} toddler-register words for age ${ageRange} — prose may feel too childish`,
        });
      }

      if (avgSentenceLen < 8) {
        warnings.push({
          type:     "sentences_too_short",
          severity: "low",
          evidence: `Average sentence length ${Math.round(avgSentenceLen)} words — for age ${ageRange} aim for ≥12`,
        });
      }
    }

    return {
      passed:  warnings.filter((w) => w.severity === "high" || w.severity === "medium").length === 0,
      warnings,
      metrics: { avgSentenceLen: Math.round(avgSentenceLen), vocabularyLevel, ageRange },
    };
  }
}

export default AdaptiveAgeValidator;
