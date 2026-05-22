/**
 * Prose Breathing Refiner
 *
 * Applied when ProseDensityValidator detects over-poeticised prose.
 * Replaces known overly-dense phrases with simpler, cleaner versions.
 * Applied POST-generation — no LLM call.
 */

const REPLACEMENTS = [
  {
    from: /The moonlight shimmered softly across the endless silver floor\./g,
    to:   "The moonlight shimmered softly across the floor.",
  },
  {
    from: /each pause full of meaning/gi,
    to:   "each movement calm and gentle",
  },
  {
    from: /shimmered and shone and gleamed/gi,
    to:   "shimmered softly",
  },
  {
    from: /whispered and glimmered and glowed/gi,
    to:   "glowed warmly",
  },
  {
    from: /the silver moonlight shimmered and shimmered/gi,
    to:   "the moonlight settled softly",
  },
];

/**
 * @param {string} text - Full story text
 * @returns {string}
 */
export function addProseBreathing(text = "") {
  let refined = text;
  for (const { from, to } of REPLACEMENTS) {
    refined = refined.replace(from, to);
  }
  return refined;
}

export default addProseBreathing;
