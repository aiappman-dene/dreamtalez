/**
 * Score Aggregator
 *
 * Combines all section validation results into an overall score,
 * evaluates against shipping thresholds, and produces a pass/fail verdict.
 */

import { SHIPPING_THRESHOLDS, AUTO_REFINE_SECTIONS } from "./shipping-thresholds.js";

/**
 * @param {Array<{ section: string, score: number, warnings: string[] }>} results
 * @returns {{
 *   passed: boolean,
 *   overall: number,
 *   scores: object,
 *   warnings: string[],
 *   failedSections: string[],
 *   refineRequired: string[],
 * }}
 */
export function aggregateScores(results = []) {
  const scores   = {};
  const warnings = [];

  for (const result of results) {
    scores[result.section] = result.score;
    if (result.warnings?.length) {
      warnings.push(...result.warnings.map((w) => `[${result.section}] ${w}`));
    }
  }

  const overall = Object.values(scores).length > 0
    ? Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length
    : 0;

  const failedSections = [];
  const refineRequired = [];

  // Check each threshold
  if (overall < SHIPPING_THRESHOLDS.overall) failedSections.push("overall");
  if ((scores.opening        ?? 10) < SHIPPING_THRESHOLDS.opening)        failedSections.push("opening");
  if ((scores.middle         ?? 10) < SHIPPING_THRESHOLDS.middle)         failedSections.push("middle");
  if ((scores.ending         ?? 10) < SHIPPING_THRESHOLDS.ending)         failedSections.push("ending");
  if ((scores["emotional-flow"]  ?? 10) < SHIPPING_THRESHOLDS.emotionalFlow)   failedSections.push("emotional-flow");
  if ((scores["bedtime-softness"] ?? 10) < SHIPPING_THRESHOLDS.bedtimeSoftness) failedSections.push("bedtime-softness");
  if ((scores["cinematic-flow"]   ?? 10) < SHIPPING_THRESHOLDS.cinematicFlow)   failedSections.push("cinematic-flow");
  if ((scores["family-magic"]     ?? 10) < SHIPPING_THRESHOLDS.familyMagic)     failedSections.push("family-magic");
  if ((scores.repetition         ?? 0)  > SHIPPING_THRESHOLDS.repetitionRisk)  failedSections.push("repetition");

  // Which failed sections can be auto-refined?
  for (const section of failedSections) {
    if (AUTO_REFINE_SECTIONS.has(section)) refineRequired.push(section);
  }

  const passed = failedSections.length === 0;

  return {
    passed,
    overall: Math.round(overall * 10) / 10,
    scores,
    warnings,
    failedSections,
    refineRequired,
  };
}

export default aggregateScores;
