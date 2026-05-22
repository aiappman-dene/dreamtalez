/**
 * Ending Descent Refiner
 *
 * Appended when CompletionValidator detects a weak or truncated ending.
 * Adds a gentle sleep-descent paragraph so the story always lands softly.
 * Applied POST-generation — never sent to the LLM.
 */

/**
 * @param {string} ending   - The current ending section text
 * @param {string} childName
 * @returns {string}
 */
export function applyEndingDescent(ending = "", childName = "The child") {
  const descent = `

By the time ${childName} returned home, the moon had climbed high above the quiet rooftops.

Everything felt calm, warm, and safe. The blankets were soft, the night air was still, and the gentle memories of the adventure lingered like the last note of a lullaby.

Soon, with sleepy eyes and a peaceful heart, ${childName} drifted quietly into dreams.`;

  return ending.trimEnd() + descent;
}

export default applyEndingDescent;
