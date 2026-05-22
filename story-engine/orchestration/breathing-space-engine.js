/**
 * Breathing Space Engine
 *
 * Provides emotional decompression templates and prompt instructions.
 * A "breathing moment" is a short paragraph of stillness — no action,
 * no dialogue — just the world settling around the child hero.
 *
 * These moments prevent bedtime stories from feeling relentless and give
 * the child reader a moment to exhale before the next story beat.
 */

/**
 * Returns a breathing moment template string.
 * Can be used as a literal text snippet or as an example in a prompt.
 * @param {object} opts
 * @param {string} [opts.atmosphere] - Active sensory texture (e.g. "soft rain")
 * @param {string} [opts.lightSource] - Warm light in the scene (e.g. "glowing lanterns")
 */
export function insertBreathingMoment({ atmosphere = "soft rain", lightSource = "glowing lanterns" } = {}) {
  return `
For a moment, everything felt still.

Only the ${atmosphere} and the warm ${lightSource} remained.
`;
}

/**
 * Returns a prompt instruction block for breathing space placement.
 * Teaches Claude when and how to create decompression moments.
 */
export function buildBreathingSpacePromptBlock() {
  return `EMOTIONAL BREATHING SPACE (mandatory — at least once):
After the emotional peak, insert one quiet moment before the ending begins.
A breathing moment: 2–3 short sentences. No action. No dialogue. Just the world settling.
Example:
  "For a moment, everything felt still.
   Only the soft rain and glowing lanterns remained.
   [Child] breathed in. The world breathed with them."
This is not filler — it is decompression. The nervous system needs it.`;
}

export default insertBreathingMoment;
