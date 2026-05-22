/**
 * Family Warmth Balancer
 *
 * Returns the appropriate family presence level for each stage of a story.
 * "medium" = a brief warm moment; "low" = background colour only;
 * "medium-high" = a gentle homecoming beat.
 *
 * Used to generate scene-level instructions that keep family from
 * dominating the narrative while ensuring the child feels loved throughout.
 */

const WARMTH_LEVELS = {
  opening:          "medium",
  adventure:        "low",
  "emotional-moment": "medium",
  ending:           "medium-high",
};

export function balanceFamilyPresence({ sceneStage }) {
  return WARMTH_LEVELS[sceneStage] || "low";
}

/**
 * Returns natural-language guidance for a warmth level — used directly
 * in prompt construction so Claude understands what "low" means in practice.
 */
export function warmthGuidance(level) {
  switch (level) {
    case "medium-high":
      return "A warm, gentle homecoming beat — the child returns to family love. One short, tender exchange.";
    case "medium":
      return "A brief warm moment — family presence felt but not foregrounded. One line or gesture.";
    case "low":
    default:
      return "Family is background warmth only — their love travels with the child but they are not present.";
  }
}

export default balanceFamilyPresence;
