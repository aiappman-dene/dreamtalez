/**
 * Shipping Thresholds
 *
 * The minimum scores required for a story to pass the production quality gate.
 * Authored as part of the Opus Framework Locking System.
 *
 * Scores are on a 1–10 scale. repetitionRisk is inverted (lower = better).
 * A story must pass ALL section thresholds AND the overall threshold to ship.
 */

export const SHIPPING_THRESHOLDS = {
  overall:         8.0,
  opening:         8.0,
  middle:          8.0,
  ending:          9.0,   // ending is held to a higher standard — it is the sleep transition
  emotionalFlow:   8.0,
  bedtimeSoftness: 9.0,   // bedtime softness is non-negotiable
  cinematicFlow:   8.0,
  familyMagic:     8.0,
  repetitionRisk:  3,     // max allowed (lower = better)
};

/**
 * Sections that trigger automatic refinement when below threshold
 * (rather than hard failure on first attempt).
 */
export const AUTO_REFINE_SECTIONS = new Set([
  "ending",
  "bedtime-softness",
  "emotional-flow",
]);

/**
 * Maximum refinement attempts before declaring hard failure.
 */
export const MAX_REFINEMENT_ATTEMPTS = 2;
