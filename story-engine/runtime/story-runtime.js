/**
 * Story Runtime
 *
 * Two entry points:
 *
 *   runStoryRuntime  — LLM-loop: generate → section validate → refine → repeat.
 *                      Takes a generateFn callback so the LLM call stays in server.js.
 *
 *   applyPostProcessing — deterministic pass applied after the LLM loop completes.
 *                         Runs budget enforcement, prose breathing, child clarity,
 *                         and ending descent without any LLM call.
 */

import { runValidationPipeline, validateStory } from "../validation/validation-pipeline.js";
import { MAX_REFINEMENT_ATTEMPTS, AUTO_REFINE_SECTIONS }  from "../validation/scoring/shipping-thresholds.js";
import { OpeningRefiner }  from "../validation/refinement/opening-refiner.js";
import { MiddleRefiner }   from "../validation/refinement/middle-refiner.js";
import { EndingRefiner }   from "../validation/refinement/ending-refiner.js";
import { PacingRefiner }   from "../validation/refinement/pacing-refiner.js";
import { SoftnessRefiner } from "../validation/refinement/softness-refiner.js";
import { applyEndingDescent }   from "../validation/refinement/ending-descent-refiner.js";
import { addProseBreathing }    from "../validation/refinement/prose-breathing-refiner.js";
import { improveChildClarity }  from "../validation/refinement/child-clarity-refiner.js";
import { trimStory }            from "../validation/refinement/story-trimmer.js";
import { buildStoryBudget }     from "../orchestration/story-budget-orchestrator.js";
import { splitStoryIntoSections } from "../validation/validation-pipeline.js";

/**
 * Map failed section names → their refiner classes.
 */
const SECTION_REFINERS = {
  "ending":           EndingRefiner,
  "bedtime-softness": SoftnessRefiner,
  "emotional-flow":   null, // handled by full-story re-generation with directive
  "cinematic-flow":   PacingRefiner,
  "opening":          OpeningRefiner,
  "middle":           MiddleRefiner,
};

/**
 * Convert the flat warnings array from aggregateScores into a section-keyed map.
 * @param {string[]} warnings
 * @returns {Record<string, string[]>}
 */
function indexWarningsBySection(warnings) {
  const map = {};
  for (const w of warnings) {
    const match = w.match(/^\[([^\]]+)\] (.+)$/);
    if (match) {
      const [, section, msg] = match;
      if (!map[section]) map[section] = [];
      map[section].push(msg);
    }
  }
  return map;
}

/**
 * Build a combined refinement prompt block from failed sections.
 * @param {{ sections: Object, warnings: string[], failedSections: string[] }} report
 * @returns {string}
 */
function buildRefinementBlock(report) {
  const { sections, warnings: rawWarnings, failedSections } = report;
  const warnings = indexWarningsBySection(rawWarnings);
  const blocks = [];

  for (const sectionKey of failedSections) {
    const RefinerClass = SECTION_REFINERS[sectionKey];
    if (!RefinerClass) continue;

    const sectionWarnings = warnings[sectionKey] || [];
    let sectionText = "";
    if      (sectionKey === "opening")  sectionText = sections.opening;
    else if (sectionKey === "middle")   sectionText = sections.middle;
    else if (sectionKey === "ending")   sectionText = sections.ending;
    else                                sectionText = ""; // full-story validators

    const refiner = new RefinerClass();
    blocks.push(refiner.buildDirective(sectionText, sectionWarnings));
  }

  // Emotional flow is a full-story concern — append directive inline
  if (failedSections.includes("emotional-flow")) {
    const efWarnings = warnings["emotional-flow"] || [];
    blocks.push([
      "=== EMOTIONAL FLOW REFINEMENT ===",
      "The story's emotional warmth is insufficient. Apply these corrections:",
      "",
      ...efWarnings.map((w) => {
        if (w.includes("Weak emotional flow"))      return "• ADD warmth signals throughout — warm, gentle, soft, wonder, loved, safe, brave, cozy, magical, together, home.";
        if (w.includes("Heart moment missing"))     return "• ADD a quiet internal realisation — a moment where the child pauses, breathes, and knows something. Use: realised, understood, felt, something clicked.";
        if (w.includes("second half"))              return "• STRENGTHEN warmth in the second half — the story must feel warmer as it moves toward sleep.";
        if (w.includes("first half"))               return "• OPEN with more warmth — the child should feel welcome in the world from the first paragraph.";
        if (w.includes("told emotions"))            return "• SHOW emotions through action, not statement — replace 'felt happy' with a specific image or gesture.";
        return `• ${w}`;
      }),
      "",
      "Apply changes throughout the full story.",
    ].join("\n"));
  }

  return blocks.join("\n\n");
}

/**
 * Run the story runtime: generate → validate → refine loop.
 *
 * @param {{
 *   generateFn: (refinementBlock?: string) => Promise<string>,
 *   validationOpts?: {
 *     childName?: string,
 *     comfortItems?: string[],
 *     familyMembers?: string[],
 *     familyMagicEnabled?: boolean,
 *   },
 *   onQualityReport?: (report: Object, attempt: number) => void,
 * }} params
 * @returns {Promise<{ story: string, qualityReport: Object, attempts: number }>}
 */
export async function runStoryRuntime({ generateFn, validationOpts = {}, onQualityReport }) {
  let story = "";
  let qualityReport = null;
  let attempt = 0;
  let refinementBlock = undefined;

  while (attempt <= MAX_REFINEMENT_ATTEMPTS) {
    attempt++;

    story = await generateFn(refinementBlock);

    qualityReport = runValidationPipeline(story, validationOpts);

    if (onQualityReport) {
      onQualityReport(qualityReport, attempt);
    }

    // If passed or no refinable sections remain, ship it
    if (qualityReport.passed || qualityReport.refineRequired.length === 0) break;

    // Only refine sections that are in AUTO_REFINE_SECTIONS and failed
    const refinableFailures = qualityReport.failedSections.filter((s) => AUTO_REFINE_SECTIONS.has(s));
    if (refinableFailures.length === 0) break;

    // Build refinement directives for next attempt (only auto-refinable sections)
    refinementBlock = buildRefinementBlock({
      sections:       qualityReport.sections,
      warnings:       qualityReport.warnings,
      failedSections: refinableFailures,
    });

    if (!refinementBlock.trim()) break;
  }

  return { story, qualityReport, attempts: attempt };
}

/**
 * Deterministic post-processing pass — no LLM call.
 *
 * Run AFTER the LLM loop. Applies:
 *   1. Child clarity fixes (abstract phrase substitution)
 *   2. Prose breathing (over-poeticised sentence simplification)
 *   3. Budget enforcement (hard word-cap trim)
 *   4. Ending descent (append if completion validator fails)
 *
 * @param {{
 *   story: string,
 *   childName?: string,
 *   mode?: string,
 * }} params
 * @returns {Promise<{ story: string, structuralValidation: object }>}
 */
export async function applyPostProcessing({ story, childName = "The child", mode = "default" }) {
  const budget = buildStoryBudget({ mode });
  const { opening, middle, ending } = splitStoryIntoSections(story);

  // Run structural validation to know what to fix
  const validation = await validateStory({
    opening, middle, ending, fullStory: story,
    budgets: budget.sectionBudgets,
    maximumWords: budget.maximumWords,
  });

  const completionResult    = validation.results.find((r) => r.section === "completion");
  const densityResult       = validation.results.find((r) => r.section === "prose-density");
  const accessibilityResult = validation.results.find((r) => r.section === "child-accessibility");
  const wordCountResult     = validation.results.find((r) => r.section === "word-count");

  let refined = story;

  if (accessibilityResult?.score < 8) refined = improveChildClarity(refined);
  if (densityResult?.score < 8)       refined = addProseBreathing(refined);
  if (wordCountResult?.score < 8)     refined = trimStory({ story: refined, maximumWords: budget.maximumWords });
  if (completionResult?.score < 8)    refined = applyEndingDescent(refined, childName);

  return { story: refined, structuralValidation: validation };
}

export default runStoryRuntime;
