/**
 * Runtime Performance Validator
 *
 * Validates generation latency and token efficiency against Bedtalez's
 * premium-feeling speed targets. This is a monitoring and alerting tool —
 * it never fails a story, only flags performance concerns.
 *
 * Targets (from Phase 5 spec):
 *   Ideal:     5–15 seconds
 *   Maximum:   ~20 seconds
 *   Emergency: >30 seconds = page-level alert in logs
 *
 * Returns { passed, warnings, metrics }
 */

const SPEED_TARGETS = {
  ideal:     { maxMs: 15000, label: "ideal" },
  acceptable:{ maxMs: 20000, label: "acceptable" },
  slow:      { maxMs: 30000, label: "slow" },
  critical:  { maxMs: Infinity, label: "critical" },
};

const TOKEN_EFFICIENCY_TARGETS = {
  maxInputTokens:   3500,  // prompt should stay under this
  minOutputTokens:  900,   // story should produce at least this many tokens
  maxOutputTokens:  2500,  // excessive output = padding risk
};

/**
 * @param {{
 *   generationMs?: number,
 *   inputTokens?: number,
 *   outputTokens?: number,
 *   pipeline?: string,       // "lean" | "full"
 *   attempts?: number,
 * }} metrics
 * @returns {{ passed: boolean, warnings: object[], metrics: object, speedLabel: string }}
 */
export class RuntimePerformanceValidator {
  validate({
    generationMs,
    inputTokens,
    outputTokens,
    pipeline = "lean",
    attempts = 1,
  } = {}) {
    const warnings = [];

    // ── Speed check ────────────────────────────────────────────────────────
    let speedLabel = "unknown";
    if (typeof generationMs === "number") {
      if (generationMs <= SPEED_TARGETS.ideal.maxMs) {
        speedLabel = "ideal";
      } else if (generationMs <= SPEED_TARGETS.acceptable.maxMs) {
        speedLabel = "acceptable";
        warnings.push({
          type:     "generation_slower_than_ideal",
          severity: "low",
          evidence: `Generation took ${Math.round(generationMs / 1000)}s — target is ≤15s for premium-feeling UX`,
        });
      } else if (generationMs <= SPEED_TARGETS.slow.maxMs) {
        speedLabel = "slow";
        warnings.push({
          type:     "generation_slow",
          severity: "medium",
          evidence: `Generation took ${Math.round(generationMs / 1000)}s — above 20s threshold; investigate context size or model load`,
        });
      } else {
        speedLabel = "critical";
        warnings.push({
          type:     "generation_critically_slow",
          severity: "high",
          evidence: `Generation took ${Math.round(generationMs / 1000)}s — critical latency; check API health and prompt size`,
        });
      }
    }

    // ── Token efficiency check ─────────────────────────────────────────────
    if (typeof inputTokens === "number") {
      if (inputTokens > TOKEN_EFFICIENCY_TARGETS.maxInputTokens) {
        warnings.push({
          type:     "prompt_too_large",
          severity: "low",
          evidence: `Input prompt is ~${inputTokens} tokens — above ${TOKEN_EFFICIENCY_TARGETS.maxInputTokens} target; context compression may help`,
        });
      }
    }

    if (typeof outputTokens === "number") {
      if (outputTokens < TOKEN_EFFICIENCY_TARGETS.minOutputTokens) {
        warnings.push({
          type:     "output_too_short",
          severity: "medium",
          evidence: `Output was only ~${outputTokens} tokens — may indicate truncation or model cut-off`,
        });
      } else if (outputTokens > TOKEN_EFFICIENCY_TARGETS.maxOutputTokens) {
        warnings.push({
          type:     "output_possibly_padded",
          severity: "low",
          evidence: `Output was ~${outputTokens} tokens — above premium target; story may contain filler`,
        });
      }
    }

    // ── Retry overhead check ───────────────────────────────────────────────
    if (attempts > 1) {
      warnings.push({
        type:     "pipeline_retried",
        severity: "low",
        evidence: `Pipeline required ${attempts} generation attempts — investigate first-pass quality`,
      });
    }

    return {
      passed:    warnings.filter((w) => w.severity === "high").length === 0,
      warnings,
      speedLabel,
      metrics: { generationMs, inputTokens, outputTokens, pipeline, attempts },
    };
  }
}

export default RuntimePerformanceValidator;
