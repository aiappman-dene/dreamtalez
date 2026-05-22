/**
 * Validation Thresholds — single source of truth.
 *
 * Three tiers per validator, per level (scene / story):
 *   fail    — score below this fails the validator (drives `passed`)
 *   warn    — score below this is logged as a warning but does not fail
 *   refine  — score below this is what Phase 2 will treat as "needs refinement"
 *             (Phase 1.5 records this signal but does NOT trigger orchestration)
 *
 * Tuning workflow: collect telemetry, look at warn/fail/refine distributions,
 * adjust here. Validators read these via the engine; do not edit constants
 * inside validator files.
 */

export const VALIDATION_THRESHOLDS = {
  repetition: {
    scene: { fail: 75, warn: 85, refine: 80 },
    story: { fail: 72, warn: 82, refine: 78 }
  },
  emotional: {
    scene: { fail: 78, warn: 86, refine: 82 },
    story: { fail: 80, warn: 88, refine: 84 }
  },
  "bedtime-safety": {
    scene: { fail: 90, warn: 95, refine: 92 },
    story: { fail: 92, warn: 96, refine: 94 }
  },
  pacing: {
    scene: { fail: 78, warn: 86, refine: 82 },
    story: { fail: 80, warn: 88, refine: 84 }
  },
  "prose-rhythm": {
    scene: { fail: 76, warn: 84, refine: 80 },
    story: { fail: 78, warn: 86, refine: 82 }
  },
  sensory: {
    scene: { fail: 72, warn: 82, refine: 78 },
    story: { fail: 75, warn: 84, refine: 80 }
  },
  continuity: {
    scene: { fail: 80, warn: 88, refine: 84 },
    story: { fail: 82, warn: 90, refine: 86 }
  },
  "reading-level": {
    scene: { fail: 78, warn: 86, refine: 82 },
    story: { fail: 80, warn: 88, refine: 84 }
  }
};

/**
 * Look up tiered thresholds for a validator/level pair.
 * Returns a defensive copy so consumers can't mutate the source.
 */
export function getThresholds(validator, level) {
  const v = VALIDATION_THRESHOLDS[validator];
  const base = v && v[level];
  if (!base) return { fail: 75, warn: 85, refine: 80 };
  return { ...base };
}

/**
 * Return the fail-threshold pair (scene + story) for a validator,
 * the shape validators expect via constructor config.
 */
export function failThresholdsFor(validator) {
  const v = VALIDATION_THRESHOLDS[validator] || {};
  return {
    scene: v.scene?.fail,
    story: v.story?.fail
  };
}

export default VALIDATION_THRESHOLDS;
