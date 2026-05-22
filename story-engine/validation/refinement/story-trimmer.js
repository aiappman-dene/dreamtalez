/**
 * Story Trimmer
 *
 * Hard word-cap enforcement. Applied POST-generation when WordCountValidator
 * detects the story exceeds its maximumWords budget. Trims at sentence
 * boundaries where possible to avoid mid-sentence cuts.
 */

/**
 * @param {{ story: string, maximumWords: number }} opts
 * @returns {string}
 */
export function trimStory({ story = "", maximumWords = 1000 }) {
  const words = story.split(/\s+/).filter(Boolean);
  if (words.length <= maximumWords) return story;

  // Try to trim at a sentence boundary near the word cap
  const truncated = words.slice(0, maximumWords).join(" ");
  const lastPunctuation = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("!"),
    truncated.lastIndexOf("?"),
  );

  if (lastPunctuation > truncated.length * 0.85) {
    return truncated.slice(0, lastPunctuation + 1).trimEnd();
  }

  return truncated;
}

export default trimStory;
