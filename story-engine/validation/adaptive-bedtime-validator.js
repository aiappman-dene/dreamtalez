/**
 * Adaptive Bedtime Validator
 *
 * Validates that a generated story matches the expected bedtime-hour profile.
 * Later hours require higher calm density and shorter, quieter endings.
 *
 * Returns { passed, warnings, metrics }
 */

const CALM_SIGNALS = [
  "sleep", "dream", "goodnight", "drifted", "closed", "quiet", "softly", "gently",
  "warmly", "safe", "cozy", "blanket", "stars", "moonlight", "whispered", "still",
  "peaceful", "rest", "slept", "hush", "settled",
];

const STIMULATION_SIGNALS = [
  "suddenly", "exploded", "crashed", "screamed", "ran", "rushed", "danger",
  "chased", "terrified", "shock", "alarm", "burst", "roared",
];

/**
 * @param {string} story
 * @param {{ sleepinessLevel?: number }} opts
 * @returns {{ passed: boolean, warnings: object[], metrics: object }}
 */
export class AdaptiveBedtimeValidator {
  validate(story = "", { sleepinessLevel = 2 } = {}) {
    const warnings = [];
    const storyLower = story.toLowerCase();

    // Calm density check
    const calmCount = CALM_SIGNALS.filter((s) => storyLower.includes(s)).length;
    const minCalmExpected = sleepinessLevel; // higher sleepiness = more calm required

    if (calmCount < minCalmExpected) {
      warnings.push({
        type:     "insufficient_calm_density",
        severity: "medium",
        evidence: `Found ${calmCount} calm signals; expected at least ${minCalmExpected} for sleepiness level ${sleepinessLevel}`,
      });
    }

    // Stimulation check in the final 30% of the story
    const endStart   = Math.floor(story.length * 0.7);
    const endSection = story.slice(endStart).toLowerCase();
    const stimFound  = STIMULATION_SIGNALS.filter((s) => endSection.includes(s));

    if (sleepinessLevel >= 3 && stimFound.length > 0) {
      warnings.push({
        type:     "stimulation_in_late_story",
        severity: sleepinessLevel >= 4 ? "medium" : "low",
        evidence: `High-stimulation word(s) found in final 30% for sleepy child: "${stimFound.slice(0, 3).join('", "')}"`,
      });
    }

    // Ending length check — overtired profile needs shorter ending sentences
    if (sleepinessLevel >= 4) {
      const sentences = story
        .replace(/\n/g, " ")
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);

      if (sentences.length > 0) {
        const lastSentence = sentences[sentences.length - 1];
        if (lastSentence.split(/\s+/).length > 10) {
          warnings.push({
            type:     "long_final_sentence_for_sleepiness",
            severity: "low",
            evidence: `Final sentence has ${lastSentence.split(/\s+/).length} words — for very sleepy children aim for ≤10`,
          });
        }
      }
    }

    return {
      passed:  warnings.filter((w) => w.severity === "high" || w.severity === "medium").length === 0,
      warnings,
      metrics: { calmCount, sleepinessLevel },
    };
  }
}

export default AdaptiveBedtimeValidator;
