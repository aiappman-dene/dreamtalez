/**
 * Family Magic Validator
 *
 * Checks that generated prose honours the family-magic contract:
 *   - child remains the primary protagonist
 *   - family members appear supportively, not as problem-solvers
 *   - comfort motifs are present
 *
 * Returns { passed, warnings } — never throws.
 */

const FAMILY_OVERSHADOW_PATTERNS = [
  /\b(mum|mom|dad|father|mother|grandma|grandpa|nana|papa)\s+(saved|rescued|fixed|solved|defeated|caught|stopped|beat)/i,
  /\b(parent|family)\s+(saved|rescued|fixed|solved)/i,
  /it was\s+(mum|mom|dad|father|mother)\s+who\s+(saved|fixed|solved|defeated)/i,
];

export class FamilyMagicValidator {
  validate(story = "", context = {}) {
    const warnings = [];

    for (const pattern of FAMILY_OVERSHADOW_PATTERNS) {
      if (pattern.test(story)) {
        warnings.push({
          type: "family_overshadow",
          severity: "medium",
          evidence: story.match(pattern)?.[0] || "pattern match",
        });
      }
    }

    // Comfort item continuity check (if items were specified)
    const comfortItems = context.comfortItems || [];
    if (comfortItems.length > 0) {
      const primaryItem = comfortItems[0].toLowerCase();
      const storyLower = story.toLowerCase();
      // Only flag if item is very specific (2+ words) and completely absent
      const words = primaryItem.split(/\s+/);
      if (words.length >= 2 && !storyLower.includes(primaryItem)) {
        warnings.push({
          type: "missing_comfort_item",
          severity: "low",
          evidence: `"${comfortItems[0]}" not referenced in story`,
        });
      }
    }

    return {
      passed: warnings.filter((w) => w.severity === "high" || w.severity === "medium").length === 0,
      warnings,
    };
  }
}

export default FamilyMagicValidator;
