/**
 * Cinematic Flow Validator
 *
 * Checks that a generated story feels cinematically fluid rather than
 * stitched together. Looks for abrupt transition signals, jarring
 * structural patterns, and pacing red flags.
 *
 * Returns { passed, warnings } — never throws.
 */

const ABRUPT_TRANSITION_PATTERNS = [
  /^then [a-z]+ (went|walked|ran|moved|went) to\b/im,
  /\. then [a-z]+ (went|walked|ran|moved) to /i,
  /\bnext, [a-z]+ (went|walked|ran)/i,
  /\bafter that, [a-z]+ (went|walked|ran)/i,
  /\bsuddenly [a-z]+ (was|were) at /i,
];

const PACING_RED_FLAGS = [
  { pattern: /[!]{2,}/g,              type: "multiple_exclamations",  msg: "Multiple exclamation marks reduce bedtime calm" },
  { pattern: /\b(BOOM|CRASH|BANG)\b/i, type: "loud_sound_word",       msg: "Loud onomatopoeia disrupts bedtime pacing" },
  { pattern: /Chapter \d+/i,          type: "chapter_heading",         msg: "Chapter headings break prose immersion" },
];

export class CinematicFlowValidator {
  /**
   * @param {string} story - Full story text
   * @returns {{ passed: boolean, warnings: object[] }}
   */
  validate(story = "") {
    const warnings = [];

    for (const pattern of ABRUPT_TRANSITION_PATTERNS) {
      if (pattern.test(story)) {
        warnings.push({
          type:     "abrupt_transition",
          severity: "medium",
          evidence: story.match(pattern)?.[0]?.trim() || "pattern match",
        });
      }
    }

    for (const { pattern, type, msg } of PACING_RED_FLAGS) {
      if (pattern.test(story)) {
        warnings.push({ type, severity: "low", evidence: msg });
      }
    }

    // Check structural flow: story should have multiple paragraphs
    const paragraphs = story.split(/\n\n+/).filter((p) => p.trim().length > 20);
    if (paragraphs.length < 4) {
      warnings.push({
        type:     "insufficient_structure",
        severity: "medium",
        evidence: `Only ${paragraphs.length} substantial paragraph(s) — story may feel rushed`,
      });
    }

    return {
      passed:   warnings.filter((w) => w.severity === "high" || w.severity === "medium").length === 0,
      warnings,
    };
  }
}

export default CinematicFlowValidator;
