/**
 * Softness Refiner
 *
 * Builds a refinement directive targeting bedtime softness failures:
 * harsh words, stimulating patterns, unresolved tension in the ending.
 */

export class SoftnessRefiner {
  /**
   * @param {string} storyText - Full story text
   * @param {string[]} warnings - Warnings from BedtimeSoftnessValidator
   * @returns {string} Refinement directive
   */
  buildDirective(storyText = "", warnings = []) {
    const lines = [
      "=== BEDTIME SOFTNESS REFINEMENT ===",
      "The story contains elements that are too stimulating for a bedtime context.",
      "Apply these corrections carefully:",
      "",
    ];

    const harshWords = warnings
      .filter((w) => w.includes("Harsh bedtime wording:"))
      .map((w) => w.match(/"([^"]+)"/)?.[1])
      .filter(Boolean);

    if (harshWords.length > 0) {
      lines.push(`• REPLACE these harsh words: ${harshWords.map((w) => `"${w}"`).join(", ")}`);
      lines.push(
        "  Substitutions: shouted→called softly, crashed→tumbled gently, terrified→surprised,",
        "  screamed→gasped, danger→challenge, monster→shadow-creature, frightened→uncertain.",
        "  Never use the original harsh word anywhere in the story.",
        "",
      );
    }

    for (const warning of warnings) {
      if (warning.includes("Multiple exclamation marks")) {
        lines.push("• REMOVE consecutive exclamation marks (!! or !!!). One exclamation at most, only in moments of wonder — never fear.");
      } else if (warning.includes('"suddenly"')) {
        lines.push('• REPLACE "suddenly" with gentler transitions: "then," "quietly," "slowly," "in a moment." Keep energy without the shock.');
      } else if (warning.includes("Harsh language in ending section")) {
        lines.push(
          "• RESOLVE all tension before the sleep transition — the final 25% of the story must be free of harsh language.",
          "  Any challenge or difficulty must be fully resolved before the ending begins.",
        );
      }
    }

    lines.push(
      "",
      "After applying changes, read the story aloud in your mind — it should feel like a lullaby, not a thriller.",
      "Apply changes throughout the full story.",
    );

    return lines.join("\n");
  }
}

export default SoftnessRefiner;
