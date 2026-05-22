/**
 * Prose Density Validator
 *
 * Detects over-poeticised sentences — those stacked with too many
 * atmospheric words at once. Signals purple prose that will lose
 * a child's attention.
 *
 * Score: 1–10.
 */

const POETIC_MARKERS = [
  "whisper", "shimmer", "glow", "silver",
  "softly", "gently", "moonlight", "warmth",
];

const MAX_DENSITY_RATIO = 0.55; // more than 55% of sentences being heavily poetic = too much

export class ProseDensityValidator {
  /**
   * @param {string} text - Full story text
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate(text = "") {
    let score = 10;
    const warnings = [];

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    let poeticCount = 0;

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const hits = POETIC_MARKERS.filter((w) => lower.includes(w)).length;
      if (hits >= 3) poeticCount++;
    }

    const density = poeticCount / Math.max(sentences.length, 1);

    if (density > MAX_DENSITY_RATIO) {
      score -= 3;
      warnings.push(
        `Excessive poetic density — ${(density * 100).toFixed(0)}% of sentences are heavily atmospheric (max ${(MAX_DENSITY_RATIO * 100).toFixed(0)}%)`
      );
    }

    return {
      section: "prose-density",
      score:   Math.max(score, 1),
      warnings,
    };
  }
}

export default ProseDensityValidator;
