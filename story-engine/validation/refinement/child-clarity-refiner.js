/**
 * Child Clarity Refiner
 *
 * Applied when ChildAccessibilityValidator flags abstract phrases.
 * Replaces adult-abstract language with concrete, child-readable equivalents.
 * Applied POST-generation — no LLM call.
 */

const REPLACEMENTS = [
  {
    from: "something she could not name",
    to:   "a brave little feeling growing inside her",
  },
  {
    from: "something he could not name",
    to:   "a brave little feeling growing inside him",
  },
  {
    from: "a quiet understanding moved through her",
    to:   "she suddenly understood",
  },
  {
    from: "a quiet understanding moved through him",
    to:   "he suddenly understood",
  },
  {
    from: "a feeling beyond words",
    to:   "a warm, happy feeling",
  },
  {
    from: "a sense of existence",
    to:   "a feeling of belonging",
  },
  {
    from: "the meaning of it all",
    to:   "why this moment mattered",
  },
];

/**
 * @param {string} text - Full story text
 * @returns {string}
 */
export function improveChildClarity(text = "") {
  let refined = text;
  for (const { from, to } of REPLACEMENTS) {
    refined = refined.split(from).join(to);
  }
  return refined;
}

export default improveChildClarity;
