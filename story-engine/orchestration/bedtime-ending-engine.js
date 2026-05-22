/**
 * Bedtime Ending Engine
 *
 * Builds the ending orchestration layer for bedtime stories.
 * The ending is the most safety-critical section: it must fully resolve
 * emotional tension and guide the child toward sleep.
 *
 * Provides both a template literal (for debugging/examples) and a
 * prompt instruction block (for Claude to follow during generation).
 */

/**
 * Returns a template ending string.
 * Used as an example, not injected literally (Claude writes its own ending).
 * @param {object} opts
 * @param {string} [opts.comfortItem] - Child's primary comfort item
 * @param {string} [opts.childName]   - Story hero's name
 */
export function buildBedtimeEnding({ comfortItem = "the soft blanket", childName = "the child" } = {}) {
  return `
Back beneath the blankets, the ${comfortItem} felt warm and safe.

Outside, rain whispered softly beneath the sleepy stars.

${childName} smiled — a quiet, satisfied smile.

Tomorrow night's adventure waited patiently beyond the moonlight.
`;
}

/**
 * Returns a prompt instruction block for ending orchestration.
 * Teaches Claude exactly how to construct the final scene.
 * @param {object} opts
 * @param {string} [opts.comfortItem] - Personalised comfort item if available
 */
export function buildEndingPromptBlock({ comfortItem } = {}) {
  const comfortLine = comfortItem
    ? `Reference "${comfortItem}" in the closing — it should feel like coming home.`
    : "Reference a warm, familiar comfort object in the closing.";

  return `BEDTIME ENDING ORCHESTRATION (strictly follow):
The final scene must:
1. Reduce stimulation completely — no new information, no new characters
2. Return the child hero to safety and warmth
3. Include one quiet moment of physical comfort (blanket, plushie, warmth)
4. End with the night world settling — stars, rain, moonlight, quiet
5. Final sentence: the quietest, warmest, most complete sentence in the story
${comfortLine}
Example closing rhythm: action settles → comfort object → world quiets → one last image → silence.
DO NOT end with "The End." DO NOT rush the final beat.`;
}

export default buildBedtimeEnding;
