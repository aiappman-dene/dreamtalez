/**
 * Repetition Suppression Engine
 *
 * Detects over-repeated phrases in a generated story.
 * Returns an array of phrases that appear more than the allowed threshold.
 *
 * Used as a post-generation quality gate — high repetition count is a
 * signal that the story generator fell into a looping pattern.
 */

const DEFAULT_THRESHOLD = 3;

// Core comfort/atmosphere phrases that AI tends to over-use
const WATCHED_PHRASES = [
  "sleepy stars",
  "soft rain",
  "warm blankets",
  "gentle glow",
  "lantern light",
  "moonlight",
  "cozy",
  "quietly",
  "softly",
  "whispered",
  "glowing",
  "drifted",
];

/**
 * @param {string} text - Full story text
 * @param {object} [opts]
 * @param {number} [opts.threshold=3]        - Max allowed occurrences before flagging
 * @param {string[]} [opts.extraPhrases=[]]  - Additional phrases to watch (e.g. child's name)
 * @returns {{ repeatedPhrases: string[], counts: Record<string, number> }}
 */
export function detectRepetition(text = "", { threshold = DEFAULT_THRESHOLD, extraPhrases = [] } = {}) {
  const textLower = text.toLowerCase();
  const allPhrases = [...WATCHED_PHRASES, ...extraPhrases];
  const repeatedPhrases = [];
  const counts = {};

  for (const phrase of allPhrases) {
    const phraseLower = phrase.toLowerCase();
    const count = textLower.split(phraseLower).length - 1;
    counts[phrase] = count;
    if (count > threshold) {
      repeatedPhrases.push(phrase);
    }
  }

  return { repeatedPhrases, counts };
}

/**
 * Convenience wrapper: returns true if any phrase exceeds threshold.
 */
export function hasExcessiveRepetition(text, opts) {
  return detectRepetition(text, opts).repeatedPhrases.length > 0;
}

export default detectRepetition;
