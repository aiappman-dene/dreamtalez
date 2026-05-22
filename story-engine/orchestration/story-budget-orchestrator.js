/**
 * Story Budget Orchestrator
 *
 * Resolves the word budget for a given story mode and returns
 * a structured budget object used by validators and the trimmer.
 */

import { STORY_LIMITS } from "../config/story-limits.js";

/**
 * @param {{ mode?: string }} opts
 * @returns {{
 *   targetWords: number,
 *   maximumWords: number,
 *   sectionBudgets: object,
 *   enforcement: { hardWordCap: boolean, trimExcess: boolean, strictEndingBudget: boolean },
 * }}
 */
export function buildStoryBudget({ mode = "default" } = {}) {
  const limits = STORY_LIMITS[mode] || STORY_LIMITS.default;

  return {
    targetWords:    limits.targetWords,
    maximumWords:   limits.maximumWords,
    sectionBudgets: limits.sections,
    enforcement: {
      hardWordCap:         true,
      trimExcess:          true,
      strictEndingBudget:  true,
    },
  };
}

export default buildStoryBudget;
