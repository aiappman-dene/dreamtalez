/**
 * Emotional Rhythm Engine
 *
 * Returns target emotional scores for each stage of a bedtime story.
 * Scores are 0–10 and represent the desired *intensity* of each quality —
 * not a hard clamp, but a direction signal for the story renderer.
 *
 * The pattern: warm curiosity → wonder → gentle peak → softening → sleep.
 * This mirrors the natural nervous-system wind-down of a healthy bedtime.
 */

export function buildEmotionalRhythm(stage) {
  switch (stage) {
    case "opening":
      return { wonder: 6, calmness: 8, excitement: 3 };

    case "adventure":
      return { wonder: 9, calmness: 6, excitement: 5 };

    case "middle":
      return { wonder: 7, calmness: 7, excitement: 4 };

    case "emotional-moment":
      return { wonder: 5, calmness: 9, excitement: 2 };

    case "ending":
      return { wonder: 4, calmness: 10, excitement: 1 };

    default:
      return { wonder: 5, calmness: 7, excitement: 3 };
  }
}

/**
 * Converts stage rhythm scores into a natural-language prompt directive.
 * Used by the prompt builder to communicate target energy to Claude.
 */
export function rhythmToPromptDirective(stage) {
  const r = buildEmotionalRhythm(stage);
  const label = {
    opening:          "Warm + curious — invite the child gently in",
    adventure:        "Wonder-forward — the world expands; stakes remain soft",
    middle:           "Gentle excitement — momentum without overstimulation",
    "emotional-moment": "Soft + comforting — slow the breath, ground the emotion",
    ending:           "Calm + sleepy — prose nearly stops; every word earns its space",
  }[stage] || "Steady warmth";

  return `${label} (wonder ${r.wonder}/10 · calm ${r.calmness}/10 · excitement ${r.excitement}/10)`;
}

/**
 * Returns the full five-stage rhythm table as a prompt block.
 * Injected once per story into buildStoryPrompt.
 */
export function buildRhythmPromptBlock() {
  const stages = ["opening", "adventure", "middle", "emotional-moment", "ending"];
  const rows = stages.map((s) => `  ${s.padEnd(18)} → ${rhythmToPromptDirective(s)}`).join("\n");
  return `EMOTIONAL RHYTHM (follow this arc — do not flatten it):\n${rows}`;
}

export default buildEmotionalRhythm;
