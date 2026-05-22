/**
 * Bedtime Rhythm Validator
 *
 * Checks that the story's closing section genuinely decelerates toward sleep.
 * Validates calming cadence, emotional decompression, and ending softness.
 *
 * Returns { passed, warnings } — never throws.
 */

const ENDING_CALM_SIGNALS = [
  "sleep", "dream", "goodnight", "drifted", "closed", "quiet",
  "softly", "warmly", "safe", "blanket", "stars", "moonlight",
];

const ENDING_DANGER_PATTERNS = [
  { pattern: /[!]{1,}/g,               type: "exclamation_in_ending",  severity: "low",    msg: "Exclamation marks in ending reduce sleep-readiness" },
  { pattern: /\bsuddenly\b/i,           type: "sudden_event_in_ending", severity: "medium", msg: "'Suddenly' in ending disrupts decompression" },
  { pattern: /\bexcited\b|\braced\b/i,  type: "high_energy_ending",     severity: "medium", msg: "High-energy language in ending counteracts calm" },
];

export class BedtimeRhythmValidator {
  /**
   * @param {string} story  - Full story text
   * @returns {{ passed: boolean, warnings: object[] }}
   */
  validate(story = "") {
    const warnings = [];

    // Extract the final ~20% of the story as "ending section"
    const endingStart  = Math.floor(story.length * 0.8);
    const endingSection = story.slice(endingStart).toLowerCase();

    // Must contain at least one calming signal in the ending
    const hasCalm = ENDING_CALM_SIGNALS.some((signal) => endingSection.includes(signal));
    if (!hasCalm) {
      warnings.push({
        type:     "missing_calm_ending",
        severity: "medium",
        evidence: "Ending section contains no calming sleep signals",
      });
    }

    // Check for danger patterns in the ending section
    for (const { pattern, type, severity, msg } of ENDING_DANGER_PATTERNS) {
      if (pattern.test(endingSection)) {
        warnings.push({ type, severity, evidence: msg });
      }
    }

    // Sentence length deceleration check — last sentence should be shorter than average
    const sentences = story
      .replace(/\n/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    if (sentences.length >= 5) {
      const avgLen   = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
      const lastLen  = sentences[sentences.length - 1].length;
      if (lastLen > avgLen * 1.2) {
        warnings.push({
          type:     "long_final_sentence",
          severity: "low",
          evidence: `Final sentence (${lastLen} chars) is longer than average (${Math.round(avgLen)} chars)`,
        });
      }
    }

    return {
      passed:   warnings.filter((w) => w.severity === "high" || w.severity === "medium").length === 0,
      warnings,
    };
  }
}

export default BedtimeRhythmValidator;
