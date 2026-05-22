/**
 * Adaptive Length Engine
 *
 * DreamTalez stories must remain ~8–10 minutes read-aloud at all times.
 * This engine does NOT change story length — it enforces the premium stable runtime.
 *
 * What it DOES adjust:
 * - How much of that runtime is spent in each arc section
 * - The proportion of "settling" vs "adventure" sentences
 * - Word density signals passed to the prompt
 *
 * Returns { lengthProfile, promptBlock }
 */

import { buildSleepinessProfile } from "./sleepiness-engine.js";

// ~8–10 min = ~1200–1500 words read aloud at a bedtime pace (slow, expressive)
const TARGET_WORD_COUNT = { min: 1200, max: 1500, ideal: 1350 };

// Arc section proportions by sleepiness level (must sum to 1.0)
const ARC_PROPORTIONS = {
  1: { opening: 0.15, adventure: 0.35, middle: 0.25, emotional: 0.10, ending: 0.15 },
  2: { opening: 0.12, adventure: 0.30, middle: 0.25, emotional: 0.13, ending: 0.20 },
  3: { opening: 0.10, adventure: 0.25, middle: 0.25, emotional: 0.15, ending: 0.25 },
  4: { opening: 0.10, adventure: 0.20, middle: 0.20, emotional: 0.20, ending: 0.30 },
  5: { opening: 0.10, adventure: 0.15, middle: 0.15, emotional: 0.20, ending: 0.40 },
};

/**
 * @param {{ bedtimeHour?: number, ageRange?: number }} opts
 * @returns {{ lengthProfile: object, promptBlock: string }}
 */
export function determineStoryLength({ bedtimeHour, ageRange } = {}) {
  const sleepiness   = buildSleepinessProfile({ bedtimeHour });
  const proportions  = ARC_PROPORTIONS[sleepiness.level] || ARC_PROPORTIONS[2];

  // Compute rough word targets per section
  const ideal = TARGET_WORD_COUNT.ideal;
  const sections = Object.fromEntries(
    Object.entries(proportions).map(([k, v]) => [k, Math.round(ideal * v)])
  );

  const lengthProfile = {
    targetWordCount:  TARGET_WORD_COUNT,
    sleepinessLevel:  sleepiness.level,
    arcProportions:   proportions,
    sectionWordTargets: sections,
  };

  const promptBlock = `STORY LENGTH STANDARD (non-negotiable):
- Total story: ~${TARGET_WORD_COUNT.min}–${TARGET_WORD_COUNT.max} words (8–10 minutes read aloud at bedtime pace)
- DO NOT shorten the story. DO NOT lengthen beyond 1500 words.
- Arc section guidance for tonight (sleepiness level ${sleepiness.level}/5):
  Opening:          ~${sections.opening} words (${Math.round(proportions.opening * 100)}%)
  Adventure:        ~${sections.adventure} words (${Math.round(proportions.adventure * 100)}%)
  Middle:           ~${sections.middle} words (${Math.round(proportions.middle * 100)}%)
  Emotional moment: ~${sections.emotional} words (${Math.round(proportions.emotional * 100)}%)
  Ending:           ~${sections.ending} words (${Math.round(proportions.ending * 100)}%)
- Length is always stable. Adapt the emotional weight and pacing inside this container.`;

  return { lengthProfile, promptBlock };
}

export default determineStoryLength;
