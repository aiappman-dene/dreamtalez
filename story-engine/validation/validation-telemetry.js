/**
 * Validation Telemetry
 *
 * Process-scoped aggregator. Collects scoring data across many stories
 * so we can tune thresholds, detect drift, and feed Phase 2 refinement
 * decisions with real distributions.
 *
 * Tracks:
 *  - per-validator: runs, pass/warn/fail counts, score sum & min/max, exec time
 *  - top flags by frequency (capped to keep memory bounded)
 *  - failure-signature histogram (which validators co-fail)
 *  - scene-level vs story-level failure split
 *
 * Sampling-safe: per-call work is O(validators + flags), no allocation explosion.
 * Telemetry NEVER mutates reports or stories.
 *
 * The 3-tier classification (pass / warn / refine) is derived from the
 * central thresholds config, not from the report's `passed` flag.
 */

import { VALIDATION_THRESHOLDS } from "../config/validation-thresholds.js";

const MAX_FLAG_KEYS = 200;
const MAX_SIGNATURE_KEYS = 100;

export class ValidationTelemetry {
  constructor({ thresholds = VALIDATION_THRESHOLDS, debugSampleRate = 0 } = {}) {
    this.thresholds = thresholds;
    this.debugSampleRate = clampSample(debugSampleRate);

    this.startedAt = new Date().toISOString();
    this.scenes = makeLevelBucket();
    this.stories = makeLevelBucket();
    this.callsSinceLastSample = 0;
  }

  /**
   * Record a per-scene aggregate report (the envelope the engine returns
   * from validateScene, wrapped by the observer).
   */
  recordSceneReport(report) {
    if (!report) return;
    this.ingest(this.scenes, report, "scene");
    this.maybeSampleLog("scene", report);
  }

  /**
   * Record a per-story aggregate report.
   */
  recordStoryReport(report) {
    if (!report) return;
    this.ingest(this.stories, report, "story");
    this.maybeSampleLog("story", report);
  }

  /**
   * Snapshot of accumulated telemetry. Pure read — does not reset state.
   */
  snapshot() {
    return {
      startedAt: this.startedAt,
      generatedAt: new Date().toISOString(),
      scene: summarizeBucket(this.scenes),
      story: summarizeBucket(this.stories)
    };
  }

  /**
   * Compact one-line summary for periodic logging.
   */
  summarize() {
    const s = summarizeBucket(this.scenes);
    const t = summarizeBucket(this.stories);
    return (
      `[telemetry] scenes=${this.scenes.totalReports} `
      + `failed=${s.failedCount} warned=${s.warnedCount} avg=${s.averageOverallScore ?? "n/a"} `
      + `| stories=${this.stories.totalReports} `
      + `failed=${t.failedCount} warned=${t.warnedCount} avg=${t.averageOverallScore ?? "n/a"}`
    );
  }

  reset() {
    this.scenes = makeLevelBucket();
    this.stories = makeLevelBucket();
    this.startedAt = new Date().toISOString();
    this.callsSinceLastSample = 0;
  }

  // ───── internals ─────

  ingest(bucket, report, level) {
    bucket.totalReports += 1;
    bucket.overallScoreSum += report.overallScore || 0;
    if (typeof report.executionMs === "number") {
      bucket.totalExecutionMs += report.executionMs;
    }

    const allPassed = report.passed === true;
    if (!allPassed) bucket.failedCount += 1;

    // Per-validator updates.
    const failedValidators = [];
    const warnedValidators = [];
    const refineValidators = [];

    for (const r of Object.values(report.results || {})) {
      const v = bucket.byValidator[r.validator] || initValidatorBucket();
      v.runs += 1;
      v.scoreSum += r.score || 0;
      v.minScore = Math.min(v.minScore, r.score || 0);
      v.maxScore = Math.max(v.maxScore, r.score || 0);
      v.executionMsSum += r.executionMs || 0;

      const tier = this.classify(r.validator, level, r.score);
      if (tier === "fail") {
        v.failedCount += 1;
        failedValidators.push(r.validator);
      } else if (tier === "warn") {
        v.warnedCount += 1;
        warnedValidators.push(r.validator);
      } else if (tier === "refine") {
        v.refineCount += 1;
        refineValidators.push(r.validator);
      } else {
        v.passedCount += 1;
      }

      bucket.byValidator[r.validator] = v;
    }

    // Top flags.
    for (const f of report.flags || []) {
      const key = `${f.validator || "?"}:${f.type || "?"}`;
      bucket.flagCounts.set(key, (bucket.flagCounts.get(key) || 0) + 1);
      if (bucket.flagCounts.size > MAX_FLAG_KEYS) {
        // Trim least-frequent — keeps memory bounded under long runs.
        trimLeastFrequent(bucket.flagCounts, MAX_FLAG_KEYS);
      }
    }

    // Failure-signature: which combination of validators co-failed.
    if (failedValidators.length) {
      const sig = [...failedValidators].sort().join("+");
      bucket.failureSignatures.set(sig, (bucket.failureSignatures.get(sig) || 0) + 1);
      if (bucket.failureSignatures.size > MAX_SIGNATURE_KEYS) {
        trimLeastFrequent(bucket.failureSignatures, MAX_SIGNATURE_KEYS);
      }
    } else {
      bucket.allPassCount += 1;
    }

    // Disagreement-pair counts (which validator pairs end up on opposite
    // sides of the pass line — used to discover redundancy / conflict).
    const passedSet = new Set(
      Object.values(report.results || {})
        .filter((r) => this.classify(r.validator, level, r.score) !== "fail")
        .map((r) => r.validator)
    );
    for (const failed of failedValidators) {
      for (const passed of passedSet) {
        const key = pairKey(failed, passed);
        bucket.disagreementPairs.set(key, (bucket.disagreementPairs.get(key) || 0) + 1);
      }
    }
  }

  classify(validator, level, score) {
    const tiers = this.thresholds[validator]?.[level];
    if (!tiers || typeof score !== "number") return "pass";
    if (score < tiers.fail) return "fail";
    if (score < tiers.refine) return "refine";
    if (score < tiers.warn) return "warn";
    return "pass";
  }

  maybeSampleLog(level, report) {
    if (this.debugSampleRate <= 0) return;
    this.callsSinceLastSample += 1;
    if (Math.random() >= this.debugSampleRate) return;
    this.callsSinceLastSample = 0;

    const id = report.sceneId ? `:${report.sceneId}` : "";
    const failedValidators = Object.values(report.results || {})
      .filter((r) => this.classify(r.validator, level, r.score) === "fail")
      .map((r) => r.validator);
    console.log(
      `[telemetry:sample:${level}${id}] score=${report.overallScore} `
      + `failed=[${failedValidators.join(",") || "none"}] flags=${(report.flags || []).length}`
    );
  }
}

// ───── helpers ─────

function makeLevelBucket() {
  return {
    totalReports: 0,
    failedCount: 0,
    allPassCount: 0,
    overallScoreSum: 0,
    totalExecutionMs: 0,
    byValidator: {},
    flagCounts: new Map(),
    failureSignatures: new Map(),
    disagreementPairs: new Map()
  };
}

function initValidatorBucket() {
  return {
    runs: 0,
    passedCount: 0,
    warnedCount: 0,
    refineCount: 0,
    failedCount: 0,
    scoreSum: 0,
    minScore: Infinity,
    maxScore: -Infinity,
    executionMsSum: 0
  };
}

function summarizeBucket(b) {
  const out = {
    totalReports: b.totalReports,
    failedCount: b.failedCount,
    allPassCount: b.allPassCount,
    averageOverallScore: b.totalReports ? round1(b.overallScoreSum / b.totalReports) : null,
    averageExecutionMs: b.totalReports ? round1(b.totalExecutionMs / b.totalReports) : null,
    byValidator: {},
    topFlags: topN(b.flagCounts, 10).map(([flag, count]) => ({ flag, count })),
    failureSignatures: topN(b.failureSignatures, 10).map(([signature, count]) => ({ signature, count })),
    disagreementPairs: topN(b.disagreementPairs, 10).map(([pair, count]) => ({ pair, count }))
  };

  let warnedTotal = 0;
  for (const [name, v] of Object.entries(b.byValidator)) {
    out.byValidator[name] = {
      runs: v.runs,
      passedCount: v.passedCount,
      warnedCount: v.warnedCount,
      refineCount: v.refineCount,
      failedCount: v.failedCount,
      averageScore: v.runs ? round1(v.scoreSum / v.runs) : null,
      minScore: v.runs ? v.minScore : null,
      maxScore: v.runs ? v.maxScore : null,
      averageExecutionMs: v.runs ? round1(v.executionMsSum / v.runs) : null,
      failureRate: v.runs ? round1(v.failedCount / v.runs) : null,
      refineRate: v.runs ? round1(v.refineCount / v.runs) : null
    };
    warnedTotal += v.warnedCount;
  }
  out.warnedCount = warnedTotal;
  return out;
}

function topN(map, n) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function trimLeastFrequent(map, target) {
  const sorted = [...map.entries()].sort((a, b) => a[1] - b[1]);
  while (map.size > target && sorted.length) {
    const [key] = sorted.shift();
    map.delete(key);
  }
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function clampSample(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export default ValidationTelemetry;
