/**
 * Ending Refiner
 *
 * Builds a targeted refinement directive for a weak ending section.
 * Ending is held to the highest standard (threshold 9.0).
 */

export class EndingRefiner {
  /**
   * @param {string} endingText - The ending section text
   * @param {string[]} warnings - Warnings from EndingValidator
   * @returns {string} Refinement directive
   */
  buildDirective(endingText = "", warnings = []) {
    const lines = [
      "=== ENDING SECTION REFINEMENT (HIGHEST PRIORITY) ===",
      "The ending scored below 9.0 — this is the last thing the child hears before sleep.",
      "Apply these corrections precisely:",
      "",
    ];

    for (const warning of warnings) {
      if (warning.includes("too short")) {
        lines.push("• EXPAND the ending — the sleep transition needs space. Add warmth, physical settling, and the world growing soft and still.");
      } else if (warning.includes("bedtime softness")) {
        lines.push("• ADD sleep signals — blanket, stars, moonlight, warmth, breath, stillness, drifting. At least three must appear.");
      } else if (warning.includes("overstimulating")) {
        lines.push("• REMOVE all stimulating words from the ending — no explosions, screams, sudden events, or danger. The ending is sacred calm.");
      } else if (warning.includes("emotional landing")) {
        lines.push("• STRENGTHEN emotional landing — the child must feel safe, warm, and home. Use: safe, calm, soft, quiet, warm, loved, together.");
      } else if (warning.includes("exclamation mark")) {
        lines.push("• REMOVE all exclamation marks from the ending. Every sentence should end with a period or an ellipsis.");
      } else if (warning.includes("Final sentence too long")) {
        lines.push("• SHORTEN the final sentence to 10 words or fewer. Make it a lullaby line — simple, soft, complete.");
      } else if (warning.includes("abruptly")) {
        lines.push("• ADD a proper closing sentence with terminal punctuation. The story must land, not cut.");
      }
    }

    lines.push(
      "",
      "The ideal ending:",
      "  — Slows the pacing sentence by sentence",
      "  — Returns warmth and safety from earlier in the story",
      "  — Ends with a short, complete, quiet sentence",
      "",
      "Rewrite the ending section only. Do not change the opening or middle.",
    );

    return lines.join("\n");
  }
}

export default EndingRefiner;
