/**
 * Emotional Continuity Validator
 *
 * Checks that a Family Magic story contains at least one grounding continuity
 * element — a comfort object, cozy sensory word, or warmth cue — confirming
 * the atmosphere engine's instructions were followed.
 *
 * Intentionally lightweight: one pass, no mutations, no API calls.
 * Returns { passed, warnings } — never throws.
 */

const BASE_CONTINUITY_KEYWORDS = [
  "scarf", "blanket", "lantern", "plushie", "toy",
  "warm", "cozy", "cosy", "soft", "gentle",
  "glow", "moonlight", "stars", "rain", "fireplace",
];

export class EmotionalContinuityValidator {
  /**
   * @param {string} story - Full story text
   * @param {object} context - { comfortItems: string[], cozyPatterns: string[] }
   */
  validate(story = "", context = {}) {
    const warnings = [];
    const storyLower = story.toLowerCase();

    // Build keyword list: base keywords + child-specific comfort items
    const specificItems = [
      ...(context.comfortItems || []),
      ...(context.cozyPatterns || []),
    ].map((s) => s.toLowerCase());

    const allKeywords = [...BASE_CONTINUITY_KEYWORDS, ...specificItems];

    const found = allKeywords.some((kw) => storyLower.includes(kw));

    if (!found) {
      warnings.push({
        type: "no_emotional_continuity",
        severity: "low",
        evidence: "No continuity keyword or comfort item detected in story",
      });
    }

    // If child had specific comfort items, check at least one appears
    if (specificItems.length > 0) {
      const specificFound = specificItems.some((item) => storyLower.includes(item));
      if (!specificFound) {
        warnings.push({
          type: "missing_personal_comfort",
          severity: "low",
          evidence: `None of the child's comfort items appear: ${specificItems.slice(0, 3).join(", ")}`,
        });
      }
    }

    return {
      passed:   warnings.filter((w) => w.severity === "high").length === 0,
      warnings,
    };
  }
}

export default EmotionalContinuityValidator;
