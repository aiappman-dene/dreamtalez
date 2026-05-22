/**
 * Pacing Refiner
 *
 * Builds a refinement directive targeting cinematic flow issues:
 * weak transitions, abrupt scene cuts, poor scene grounding.
 */

export class PacingRefiner {
  /**
   * @param {string} storyText - Full story text
   * @param {string[]} warnings - Warnings from CinematicFlowValidator
   * @returns {string} Refinement directive
   */
  buildDirective(storyText = "", warnings = []) {
    const lines = [
      "=== CINEMATIC FLOW REFINEMENT ===",
      "The story's cinematic pacing scored below threshold. Apply these corrections:",
      "",
    ];

    for (const warning of warnings) {
      if (warning.includes("atmospheric thread signals")) {
        lines.push(
          "• ADD atmospheric transition threads — when moving between scenes, carry a physical sensation:",
          '  "The warmth of the lantern followed her into the corridor."',
          '  "A sound drifted from somewhere ahead — soft, like rustling leaves."',
          '  Use: carried, drifted, floated, wound, the light, the warmth, beyond the, through the.',
        );
      } else if (warning.includes("abrupt scene cuts")) {
        lines.push(
          '• REMOVE abrupt scene cuts ("then she went to", "next,", "after that,").',
          "  Between every scene change, add one atmospheric sentence that bridges the spaces.",
        );
      } else if (warning.includes("scene grounding")) {
        lines.push(
          "• ADD physical anchors to scenes — ground, floor, sky, tree, water, path, bridge, light, shadow, air.",
          "  Each scene must feel physically real, not floating in abstract space.",
        );
      } else if (warning.includes("Comfort anchor not returned")) {
        lines.push(
          "• RETURN warmth/safety to the ending — a comfort anchor from earlier in the story must reappear in the final scene.",
          "  Use: warm, light, safe, blanket, glow, home, lantern, stars, moonlight.",
        );
      }
    }

    lines.push("", "Apply these fixes throughout the full story. Maintain all existing plot and character beats.");
    return lines.join("\n");
  }
}

export default PacingRefiner;
