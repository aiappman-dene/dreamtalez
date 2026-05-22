/**
 * Opening Refiner
 *
 * Builds a targeted refinement prompt for a weak opening section.
 * Does NOT rewrite the story — it tells Sonnet what to fix and why.
 */

export class OpeningRefiner {
  /**
   * @param {string} openingText - The opening section text
   * @param {string[]} warnings  - Warnings from OpeningValidator
   * @returns {string} Refinement directive to inject into next generation
   */
  buildDirective(openingText = "", warnings = []) {
    const lines = [
      "=== OPENING SECTION REFINEMENT ===",
      "The opening section scored below threshold. Apply these corrections:",
      "",
    ];

    for (const warning of warnings) {
      if (warning.includes("too short")) {
        lines.push("• EXPAND the opening — add another sensory paragraph. Show the world before the adventure begins.");
      } else if (warning.includes("Generic opener")) {
        lines.push('• REMOVE the generic opener ("Once upon a time" / "There once was"). Begin mid-scene — a sound, a texture, a feeling already in motion.');
      } else if (warning.includes("bedtime atmosphere")) {
        lines.push("• ADD bedtime atmosphere to the opening — moonlight, soft air, the hush of evening. The child must feel the world settling.");
      } else if (warning.includes("wonder hook")) {
        lines.push("• ADD a wonder hook in the first paragraph — a question, a mystery, a quiet impossibility that draws the child forward.");
      } else if (warning.includes("sensory grounding")) {
        lines.push("• ADD sensory grounding — one specific texture, sound, or scent that places the child physically inside the world.");
      }
    }

    lines.push("", "Rewrite the opening section only. Keep all other sections unchanged.");
    return lines.join("\n");
  }
}

export default OpeningRefiner;
