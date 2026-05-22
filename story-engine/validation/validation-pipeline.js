/**
 * Validation Pipeline
 *
 * Two exports:
 *   runValidationPipeline — section-level quality gate (cinematic, emotional, etc.)
 *   validateStory         — budget-aware structural gate (word count, pacing, balance)
 *
 * Neither calls the LLM. story-runtime.js decides which to use and when.
 */

import { OpeningValidator }       from "./validators/opening-validator.js";
import { MiddleValidator }        from "./validators/middle-validator.js";
import { EndingValidator }        from "./validators/ending-validator.js";
import { EmotionalFlowValidator } from "./validators/emotional-flow-validator.js";
import { BedtimeSoftnessValidator } from "./validators/bedtime-softness-validator.js";
import { CinematicFlowValidator } from "./validators/cinematic-flow-validator.js";
import { RepetitionValidator }    from "./validators/repetition-validator.js";
import { FamilyMagicValidator }   from "./validators/family-magic-validator.js";
import { aggregateScores }        from "./scoring/score-aggregator.js";

// Budget-aware structural validators
import { CompletionValidator }         from "./validators/completion-validator.js";
import { ProseDensityValidator }       from "./validators/prose-density-validator.js";
import { ChildAccessibilityValidator } from "./validators/child-accessibility-validator.js";
import { BedtimeEndingValidator }      from "./validators/bedtime-ending-validator.js";
import { WordCountValidator }          from "./validators/word-count-validator.js";
import { PacingBudgetValidator }       from "./validators/pacing-budget-validator.js";
import { SectionBalanceValidator }     from "./validators/section-balance-validator.js";

// Section split ratios: opening 20%, middle 55%, ending 25%
const OPENING_END   = 0.20;
const MIDDLE_END    = 0.75;

/**
 * Split a story string into named sections.
 * @param {string} text
 * @returns {{ opening: string, middle: string, ending: string }}
 */
export function splitStoryIntoSections(text) {
  const len = text.length;
  const opening = text.slice(0, Math.floor(len * OPENING_END));
  const middle  = text.slice(Math.floor(len * OPENING_END), Math.floor(len * MIDDLE_END));
  const ending  = text.slice(Math.floor(len * MIDDLE_END));
  return { opening, middle, ending };
}

/**
 * Run the full validation pipeline on a story.
 *
 * @param {string} storyText
 * @param {{
 *   childName?: string,
 *   comfortItems?: string[],
 *   familyMembers?: string[],
 *   familyMagicEnabled?: boolean,
 * }} opts
 * @returns {{
 *   passed: boolean,
 *   overall: number,
 *   scores: Record<string, number>,
 *   warnings: Record<string, string[]>,
 *   failedSections: string[],
 *   refineRequired: boolean,
 *   sections: { opening: string, middle: string, ending: string },
 * }}
 */
export function runValidationPipeline(storyText, opts = {}) {
  const { childName, comfortItems = [], familyMembers = [], familyMagicEnabled = false } = opts;

  const sections = splitStoryIntoSections(storyText);

  const openingResult       = new OpeningValidator().validate(sections.opening);
  const middleResult        = new MiddleValidator().validate(sections.middle);
  const endingResult        = new EndingValidator().validate(sections.ending);
  const emotionalResult     = new EmotionalFlowValidator().validate(storyText);
  const softnessResult      = new BedtimeSoftnessValidator().validate(storyText);
  const cinematicResult     = new CinematicFlowValidator().validate(storyText);
  const repetitionResult    = new RepetitionValidator().validate(storyText);

  const results = [
    openingResult, middleResult, endingResult,
    emotionalResult, softnessResult, cinematicResult, repetitionResult,
  ];

  if (familyMagicEnabled) {
    const familyResult = new FamilyMagicValidator().validate(storyText, {
      childName, comfortItems, familyMembers,
    });
    results.push(familyResult);
  }

  const aggregated = aggregateScores(results);

  return {
    ...aggregated,
    sections,
  };
}

/**
 * Budget-aware structural validation.
 * Checks completion, prose density, child accessibility, ending quality,
 * word count, pacing budgets, and section balance.
 *
 * @param {{
 *   opening?: string,
 *   middle?: string,
 *   ending?: string,
 *   fullStory?: string,
 *   budgets?: object,
 *   maximumWords?: number,
 * }} opts
 * @returns {{ overall: number, passed: boolean, results: Array }}
 */
export async function validateStory({
  opening = "",
  middle = "",
  ending = "",
  fullStory = "",
  budgets = {},
  maximumWords = 1000,
}) {
  const story = fullStory || [opening, middle, ending].join("\n\n").trim();
  const endingText = ending || story.slice(Math.floor(story.length * 0.75));

  const results = [
    new CompletionValidator().validate(story),
    new ProseDensityValidator().validate(story),
    new ChildAccessibilityValidator().validate(story),
    new BedtimeEndingValidator().validate(endingText),
    new WordCountValidator().validate({ story, maximumWords }),
    new PacingBudgetValidator().validate({ opening, middle, ending, budgets }),
    new SectionBalanceValidator().validate({ opening, middle, ending }),
  ];

  const overall = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  return {
    overall: Math.round(overall * 10) / 10,
    passed:  overall >= 8,
    results,
  };
}

export default runValidationPipeline;
