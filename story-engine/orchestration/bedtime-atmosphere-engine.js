/**
 * Bedtime Atmosphere Engine
 *
 * Returns a consistent set of environmental textures and pacing directives
 * applied to every Family Magic story. These become sensory anchors that,
 * repeated across stories, make the universe feel familiar and lived-in.
 */

export function buildBedtimeAtmosphere() {
  return {
    environmentalTextures: [
      "soft rain on windows",
      "glowing lanterns",
      "warm blankets",
      "silver moonlight",
      "sleepy stars",
      "gentle fireplace glow",
      "quiet owl calls",
      "distant thunder turning soft",
    ],
    pacing:        "slow-soft-calm",
    emotionalGoal: "safe-and-sleepy",
  };
}

/**
 * Converts atmosphere data into a prompt instruction block.
 * Called by the prompt builder to inject atmosphere into the Sonnet payload.
 */
export function atmosphereToPromptBlock(atmosphere = buildBedtimeAtmosphere()) {
  const textureList = (atmosphere.environmentalTextures || []).slice(0, 4).join(", ");
  return `ATMOSPHERE: The story world should feel: ${textureList}. Pacing: ${atmosphere.pacing}. Emotional goal: ${atmosphere.emotionalGoal}.`;
}

export default buildBedtimeAtmosphere;
