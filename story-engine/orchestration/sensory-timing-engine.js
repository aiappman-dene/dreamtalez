/**
 * Sensory Timing Engine
 *
 * Maps emotional moments to the most bedtime-appropriate sensory cue.
 * The key insight: sensory details land harder when placed at the exact
 * moment the reader's nervous system needs grounding — not scattered
 * throughout every paragraph.
 */

const SENSORY_CUES = {
  comfort:    "warm blanket texture",
  wonder:     "silver stars shimmering overhead",
  calmness:   "soft rain against the windows",
  safety:     "gentle fireplace warmth",
  sleepy:     "a quiet lantern glow",
  excitement: "the hum of the night breeze",
  discovery:  "a soft golden light ahead",
  courage:    "the steady beat of a warm heart",
  sadness:    "a gentle hand on a small shoulder",
  joy:        "the sound of distant music on the wind",
};

export function getSensoryCue(emotion) {
  return SENSORY_CUES[emotion] || "soft moonlight";
}

/**
 * Returns a prompt instruction block for sensory timing.
 * Teaches Claude to place sensory cues at emotional moments, not everywhere.
 */
export function buildSensoryTimingPromptBlock() {
  const cueTable = Object.entries(SENSORY_CUES)
    .map(([emotion, cue]) => `  ${emotion.padEnd(12)} → ${cue}`)
    .join("\n");

  return `SENSORY TIMING (place at emotional moments only — not throughout):
Do not fill every paragraph with sensory detail. Reserve sensory cues for:
- The moment of greatest wonder
- The emotional turning point
- The final calming beat

Emotion → sensory cue guide:
${cueTable}

One well-placed sensory detail creates more immersion than five scattered ones.`;
}

export default getSensoryCue;
