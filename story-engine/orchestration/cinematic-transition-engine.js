/**
 * Cinematic Transition Engine
 *
 * Provides natural-language transition templates and a prompt instruction
 * block that teaches Claude to write fluid scene transitions rather than
 * abrupt location jumps.
 *
 * Note: the template is generic (uses `childName` param) so it works for
 * any child — not hardcoded to a specific name.
 */

/**
 * Returns a single cinematic transition sentence.
 * @param {object} opts
 * @param {string} opts.childName  - The story's hero
 * @param {string} opts.location   - Destination location
 * @param {string} opts.atmosphere - Active atmospheric element (e.g. "lantern light")
 */
export function buildTransition({ childName = "the child", location, atmosphere }) {
  const atmo = atmosphere || "soft moonlight";
  const dest = location    || "the next adventure";
  return `As ${atmo} drifted softly around them, ${childName} wandered toward ${dest}.`;
}

/**
 * Returns a prompt instruction block that teaches Claude to write
 * cinematic transitions rather than blunt scene jumps.
 */
export function buildTransitionPromptBlock() {
  return `CINEMATIC TRANSITIONS (apply to every scene change):
- Never write "Then [child] went to [place]."
- Always carry an atmospheric thread from the previous scene into the next.
- Use a single transitional sentence: an image, a sensation, a sound — then arrive.
- Example: "As the lantern lights shimmered behind her, [name] followed the silver path deeper into the sleepy forest."
- Transitions should feel like a film dissolve — one world softening into the next.`;
}

export default buildTransition;
