/**
 * Sensory Balance Validator
 *
 * Checks that sensory details are well-timed and not over-concentrated.
 * A story with sensory cues in every sentence stops feeling immersive and
 * starts feeling exhausting — exactly wrong for bedtime.
 *
 * Returns { passed, warnings } — never throws.
 */

const SENSORY_TERMS = [
  "warm", "cold", "soft", "rough", "smooth",      // tactile
  "bright", "dark", "glowing", "shimmering",      // visual
  "whispered", "silence", "humming", "crackled",  // auditory
  "smelled", "scent", "fragrance", "aroma",       // olfactory
];

const MAX_SENSORY_DENSITY = 0.4;  // max proportion of paragraphs with sensory terms
const MIN_SENSORY_COVERAGE = 0.1; // min proportion — must have some atmosphere

export class SensoryBalanceValidator {
  /**
   * @param {string} story - Full story text
   * @returns {{ passed: boolean, warnings: object[], metrics: object }}
   */
  validate(story = "") {
    const warnings = [];
    const paragraphs = story.split(/\n\n+/).filter((p) => p.trim().length > 20);
    if (paragraphs.length === 0) {
      return { passed: true, warnings: [], metrics: {} };
    }

    let sensoryCount = 0;
    const sensoryParagraphs = [];

    for (const [i, para] of paragraphs.entries()) {
      const paraLower = para.toLowerCase();
      const hasSensory = SENSORY_TERMS.some((term) => paraLower.includes(term));
      if (hasSensory) {
        sensoryCount++;
        sensoryParagraphs.push(i + 1);
      }
    }

    const density = sensoryCount / paragraphs.length;

    if (density > MAX_SENSORY_DENSITY) {
      warnings.push({
        type:     "sensory_overload",
        severity: "low",
        evidence: `${Math.round(density * 100)}% of paragraphs contain sensory detail — aim for ≤${Math.round(MAX_SENSORY_DENSITY * 100)}%`,
      });
    }

    if (density < MIN_SENSORY_COVERAGE) {
      warnings.push({
        type:     "sensory_absence",
        severity: "low",
        evidence: "Story has very little sensory grounding — atmosphere may feel thin",
      });
    }

    // Check for consecutive sensory-heavy paragraphs (3+ in a row)
    let consecutive = 1;
    for (let i = 1; i < sensoryParagraphs.length; i++) {
      if (sensoryParagraphs[i] === sensoryParagraphs[i - 1] + 1) {
        consecutive++;
        if (consecutive >= 3) {
          warnings.push({
            type:     "consecutive_sensory",
            severity: "low",
            evidence: `${consecutive} consecutive paragraphs with sensory detail (paragraphs ${sensoryParagraphs[i - 2]}–${sensoryParagraphs[i]})`,
          });
          break;
        }
      } else {
        consecutive = 1;
      }
    }

    return {
      passed:   warnings.filter((w) => w.severity === "high").length === 0,
      warnings,
      metrics:  { paragraphCount: paragraphs.length, sensoryCount, density: Math.round(density * 100) },
    };
  }
}

export default SensoryBalanceValidator;
