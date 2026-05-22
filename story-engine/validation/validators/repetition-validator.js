/**
 * Repetition Validator
 *
 * Detects phrase-level repetition that breaks immersion. Checks for
 * overused sentence openers, repeated descriptors, and echo phrases.
 *
 * Score: 1–10. Lower is better for repetitionRisk (reported inverted).
 */

const FILLER_OPENERS = [
  "and then", "but then", "so then", "just then",
  "after a moment", "after a while", "suddenly,",
];

const MAX_OPENER_REUSE    = 2;
const MAX_WORD_FREQ_RATIO = 0.06; // single non-stop word > 6% of total = repetitive
const MAX_PHRASE_REPEATS  = 3;

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "was","is","are","were","had","has","have","she","he","they","it","her",
  "him","his","their","that","this","which","who","what","as","by","be",
  "from","not","you","we","all","one","our","into","up","so","out","there",
  "when","then","would","could","about","said","came","went","felt","back",
  "over","after","just","little","now","like","been","very","some","more",
]);

export class RepetitionValidator {
  /**
   * @param {string} text - Full story text
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate(text = "") {
    let score = 10;
    const warnings = [];
    const lower = text.toLowerCase();

    // Filler opener overuse
    for (const opener of FILLER_OPENERS) {
      const count = (lower.split(opener).length - 1);
      if (count > MAX_OPENER_REUSE) {
        score -= 1;
        warnings.push(`"${opener}" used ${count}× — breaks narrative freshness`);
      }
    }

    // Word frequency analysis — flag non-stop words used too often
    const words = lower.match(/\b[a-z]{4,}\b/g) || [];
    const total = words.length;
    if (total > 0) {
      const freq = {};
      for (const w of words) {
        if (!STOP_WORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
      }
      const overused = Object.entries(freq)
        .filter(([, n]) => n / total > MAX_WORD_FREQ_RATIO)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      for (const [word, count] of overused) {
        score -= 1;
        warnings.push(`"${word}" repeated ${count}× (${((count / total) * 100).toFixed(1)}% of words) — vary the vocabulary`);
      }
    }

    // Exact phrase repetition — 4–6 word sequences
    const sentences = text.split(/[.!?]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const phraseMap = {};
    for (const sentence of sentences) {
      const wordArr = sentence.split(/\s+/).filter(Boolean);
      for (let i = 0; i <= wordArr.length - 4; i++) {
        const phrase = wordArr.slice(i, i + 4).join(" ");
        phraseMap[phrase] = (phraseMap[phrase] || 0) + 1;
      }
    }
    const repeatedPhrases = Object.entries(phraseMap)
      .filter(([, n]) => n >= MAX_PHRASE_REPEATS)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    for (const [phrase, count] of repeatedPhrases) {
      score -= 1;
      warnings.push(`Phrase "${phrase}" appears ${count}× — vary phrasing for immersion`);
    }

    return {
      section:  "repetition-risk",
      score:    Math.max(score, 1),
      warnings,
    };
  }
}

export default RepetitionValidator;
