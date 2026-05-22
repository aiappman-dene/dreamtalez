/**
 * Validation Observer
 *
 * Phase 1 passive observer wrapper around the ValidationEngine.
 *
 * Responsibilities:
 *  - Run validateScene / validateStory at the orchestrator's call sites
 *  - Aggregate per-scene results
 *  - Emit lightweight runtime logs (overall score, failed validators, top flags, ms)
 *  - Expose a structured report for the pipeline output
 *  - Provide refinement-hook interfaces for Phase 2 (registered, but never invoked
 *    to mutate prose or trigger retries — strictly informational)
 *
 * NEVER mutates scenes. NEVER blocks delivery. NEVER calls models.
 */

export class ValidationObserver {
  constructor({ engine, debug = false, telemetry = null, advisor = null } = {}) {
    if (!engine) throw new Error("ValidationObserver requires an engine.");
    this.engine = engine;
    this.debug = debug;
    this.telemetry = telemetry;
    this.advisor = advisor;

    this.sceneReports = [];
    this.storyReport = null;

    // Lifecycle safeguard. `pipeline.execute()` opens a session at the
    // story boundary; if a future caller (Phase 2 tooling, direct
    // runStage() use, ad-hoc scripts) skips that step, the observer
    // detects the gap and self-heals rather than leaking prior-story
    // state into the next one. Telemetry is unaffected.
    this.activeSession = null;

    // Refinement hooks (Phase 2). Registered here; the observer DOES NOT
    // invoke any orchestration. Callbacks receive the validation report
    // and may return advisory data for a future refinement loop.
    this.hooks = {
      onSceneFlagged: [],
      onStoryFlagged: [],
      onSceneValidated: [],
      onStoryValidated: []
    };
  }

  /**
   * Reset per-story state (sceneReports, storyReport).
   * Hooks, telemetry, and advisor are NOT reset — they're process-scoped
   * collaborators that persist across stories.
   */
  reset() {
    this.sceneReports = [];
    this.storyReport = null;
  }

  /**
   * Open a story session. Canonically called by `pipeline.execute()`;
   * Phase 2 / tooling that drives the pipeline directly should also call this.
   *
   * If a prior session is still open, or stale story-scoped state is present,
   * the observer warns clearly and resets that state. Telemetry is preserved.
   *
   * @param {string} [sessionId] caller-supplied id; one is synthesized if absent
   * @returns {string} the active session id
   */
  startStory(sessionId) {
    const id = sessionId || synthesizeSessionId("story");
    const hasStaleState = this.sceneReports.length > 0 || this.storyReport !== null;

    if (this.activeSession && this.activeSession.id !== id) {
      console.warn(
        `[validation-observer] previous session ${this.activeSession.id} still open — `
        + `closing and resetting before ${id} (carry-over=${this.sceneReports.length} scene(s))`
      );
      this.reset();
    } else if (hasStaleState) {
      console.warn(
        `[validation-observer] stale story-scoped state present without active session — `
        + `resetting before ${id} (carry-over=${this.sceneReports.length} scene(s))`
      );
      this.reset();
    }

    this.activeSession = { id, startedAt: Date.now(), synthetic: false };
    if (this.debug) console.log(`[validation-observer] session ${id} opened`);
    return id;
  }

  /**
   * Close the active story session. Idempotent; safe to call when no session is open.
   * Per-story state (sceneReports, storyReport) is intentionally NOT cleared here —
   * pipeline output may still want to read the report. The next startStory()
   * call resets it.
   */
  endStory() {
    if (!this.activeSession) return;
    const { id } = this.activeSession;
    if (this.debug) {
      console.log(
        `[validation-observer] session ${id} closed (${this.sceneReports.length} scene(s))`
      );
    }
    this.activeSession = null;
  }

  /**
   * Defensive boundary assertion called from observeScene/observeStory.
   * If a caller drives validation directly without opening a session,
   * we synthesize one and warn. Stale state from a prior unbounded run
   * is reset here, so leakage between separate stories cannot occur.
   */
  ensureSession(level, sceneId) {
    if (this.activeSession) return this.activeSession.id;

    const id = synthesizeSessionId(`auto-${level}`);
    const ctx = sceneId ? ` (scene=${sceneId})` : "";
    console.warn(
      `[validation-observer] no active session at ${level} validation${ctx} — `
      + `auto-opening ${id}. Phase 2 callers should invoke startStory(); `
      + `pipeline.execute() does this automatically.`
    );
    if (this.sceneReports.length > 0 || this.storyReport !== null) {
      console.warn(
        `[validation-observer] stale state present — resetting before synthetic session ${id}`
      );
      this.reset();
    }
    this.activeSession = { id, startedAt: Date.now(), synthetic: true };
    return id;
  }

  /**
   * Register a refinement-orchestration hook.
   * Phase 1: callbacks are invoked for telemetry only — they MUST NOT
   * mutate prose or trigger retries. The observer ignores their return value.
   */
  on(event, fn) {
    if (!Object.prototype.hasOwnProperty.call(this.hooks, event)) {
      throw new Error(`Unknown validation hook: ${event}`);
    }
    if (typeof fn !== "function") return;
    this.hooks[event].push(fn);
  }

  /**
   * Validate a single rendered scene.
   * Returns the report. Never throws on failure — warns, logs, continues.
   */
  observeScene({ sceneText, scenePayload = {}, context = {} } = {}) {
    if (!sceneText || typeof sceneText !== "string" || !sceneText.trim()) {
      if (this.debug) {
        console.log(`[validation-observer] scene ${scenePayload?.scene_id || "?"}: skipped (no prose)`);
      }
      return null;
    }

    const sessionId = this.ensureSession("scene", scenePayload?.scene_id);

    const t0 = nowMs();
    let report;
    try {
      report = this.engine.validateScene(sceneText, scenePayload, context);
    } catch (err) {
      console.warn(`[validation-observer] scene ${scenePayload?.scene_id || "?"} validation error: ${err.message}`);
      return null;
    }
    const ms = round1(nowMs() - t0);
    report.observedMs = ms;
    report.sessionId = sessionId;

    this.sceneReports.push(report);
    this.logSceneReport(report);

    if (this.telemetry) {
      try { this.telemetry.recordSceneReport(report); }
      catch (err) { console.warn(`[validation-observer] telemetry error (scene): ${err.message}`); }
    }

    let advice = null;
    if (this.advisor) {
      try { advice = this.advisor.advise(report); }
      catch (err) { console.warn(`[validation-observer] advisor error (scene): ${err.message}`); }
    }
    if (advice) report.advice = advice;

    this.fireHooks("onSceneValidated", report);
    if (!report.passed) this.fireHooks("onSceneFlagged", report);

    return report;
  }

  /**
   * Validate a fully assembled story.
   * Returns the report. Never throws — warns, logs, continues.
   */
  observeStory({ scenes = [], storyContext = {} } = {}) {
    const usable = scenes
      .map((s) => (typeof s === "string" ? { text: s } : s))
      .filter((s) => s && typeof s.text === "string" && s.text.trim().length > 0);

    if (!usable.length) {
      if (this.debug) {
        console.log(`[validation-observer] story validation skipped (no usable scenes)`);
      }
      return null;
    }

    const sessionId = this.ensureSession("story");

    const t0 = nowMs();
    let report;
    try {
      report = this.engine.validateStory(usable, storyContext);
    } catch (err) {
      console.warn(`[validation-observer] story validation error: ${err.message}`);
      return null;
    }
    report.observedMs = round1(nowMs() - t0);
    report.sessionId = sessionId;

    this.storyReport = report;
    this.logStoryReport(report);

    if (this.telemetry) {
      try { this.telemetry.recordStoryReport(report); }
      catch (err) { console.warn(`[validation-observer] telemetry error (story): ${err.message}`); }
    }

    let advice = null;
    if (this.advisor) {
      try { advice = this.advisor.advise(report); }
      catch (err) { console.warn(`[validation-observer] advisor error (story): ${err.message}`); }
    }
    if (advice) report.advice = advice;

    this.fireHooks("onStoryValidated", report);
    if (!report.passed) this.fireHooks("onStoryFlagged", report);

    return report;
  }

  /**
   * Aggregate report for inclusion in pipeline output.
   */
  getReport() {
    const sceneCount = this.sceneReports.length;
    const sceneAverage = sceneCount
      ? round1(this.sceneReports.reduce((s, r) => s + (r.overallScore || 0), 0) / sceneCount)
      : null;
    const failedScenes = this.sceneReports.filter((r) => !r.passed).length;
    const totalSceneMs = round1(this.sceneReports.reduce((s, r) => s + (r.executionMs || 0), 0));

    return {
      scene: {
        count: sceneCount,
        averageScore: sceneAverage,
        failedCount: failedScenes,
        reports: this.sceneReports
      },
      story: this.storyReport,
      totalMs: round1(totalSceneMs + (this.storyReport?.executionMs || 0)),
      passed: failedScenes === 0 && (this.storyReport ? this.storyReport.passed : true)
    };
  }

  // ───── internals ─────

  fireHooks(event, report) {
    const fns = this.hooks[event];
    for (const fn of fns) {
      try { fn(report); }
      catch (err) { console.warn(`[validation-observer] hook ${event} threw: ${err.message}`); }
    }
  }

  logSceneReport(report) {
    const failed = this.failedValidators(report);
    const topFlags = this.topFlags(report, 3);
    const status = report.passed ? "PASS" : "WARN";
    const id = report.sceneId || "?";
    const flagBlurb = topFlags.length ? ` flags=[${topFlags.map((f) => f.label).join(", ")}]` : "";
    const failBlurb = failed.length ? ` failed=[${failed.join(", ")}]` : "";
    console.log(
      `[validation:scene:${id}] ${status} score=${report.overallScore} ms=${report.executionMs}${failBlurb}${flagBlurb}`
    );
  }

  logStoryReport(report) {
    const failed = this.failedValidators(report);
    const topFlags = this.topFlags(report, 5);
    const status = report.passed ? "PASS" : "WARN";
    const flagBlurb = topFlags.length ? ` flags=[${topFlags.map((f) => f.label).join(", ")}]` : "";
    const failBlurb = failed.length ? ` failed=[${failed.join(", ")}]` : "";
    console.log(
      `[validation:story] ${status} score=${report.overallScore} ms=${report.executionMs}${failBlurb}${flagBlurb}`
    );
  }

  failedValidators(report) {
    return Object.values(report.results || {})
      .filter((r) => !r.passed)
      .map((r) => `${r.validator}=${r.score}`);
  }

  topFlags(report, n) {
    const severityRank = { high: 3, medium: 2, low: 1 };
    return [...(report.flags || [])]
      .sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0))
      .slice(0, n)
      .map((f) => ({ label: `${f.validator}:${f.type}`, severity: f.severity }));
  }
}

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function synthesizeSessionId(prefix) {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${t}-${r}`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export default ValidationObserver;
