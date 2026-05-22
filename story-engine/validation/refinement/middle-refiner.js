/**
 * Middle Refiner
 *
 * Builds a targeted refinement directive for a weak middle section.
 */

export class MiddleRefiner {
  /**
   * @param {string} middleText - The middle section text
   * @param {string[]} warnings - Warnings from MiddleValidator
   * @returns {string} Refinement directive
   */
  buildDirective(middleText = "", warnings = []) {
    const lines = [
      "=== MIDDLE SECTION REFINEMENT ===",
      "The middle section scored below threshold. Apply these corrections:",
      "",
    ];

    for (const warning of warnings) {
      if (warning.includes("underdeveloped")) {
        lines.push("• EXPAND the middle — add at least two new scene beats. Each beat should move the child one step closer to the heart moment.");
      } else if (warning.includes("too short")) {
        lines.push("• LENGTHEN the middle section — it should be the longest part of the story. Add atmosphere between action beats.");
      } else if (warning.includes("suddenly")) {
        lines.push('• REDUCE "suddenly" usage — replace abrupt jumps with atmospheric transitions. Carry a sensory thread between scenes.');
      } else if (warning.includes("emotional immersion")) {
        lines.push("• ADD emotional immersion — include at least one moment where the child notices, wonders, or feels something specific. Use: felt, noticed, softly, gently, realised.");
      } else if (warning.includes("narrative momentum")) {
        lines.push("• ADD forward momentum — the child must move through the world: walked, followed, climbed, found. The adventure must have direction.");
      } else if (warning.includes("exclamation marks")) {
        lines.push("• REMOVE excess exclamation marks from the middle. Replace energy with specificity — show excitement through action, not punctuation.");
      }
    }

    lines.push("", "Rewrite the middle section only. Preserve opening and ending.");
    return lines.join("\n");
  }
}

export default MiddleRefiner;
