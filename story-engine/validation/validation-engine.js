/**
 * Validation Engine
 *
 * Coordinator only. Owns:
 *  - validator registry
 *  - thresholds
 *  - aggregation of scene-level and story-level results
 *  - lightweight debug logging (validator, score, pass/fail, execution time)
 *
 * Does NOT inspect prose itself. Does NOT mutate stories.
 * Does NOT trigger refinement loops (Phase 2).
 */

import { RepetitionValidator } from "./repetition-validator.js";
import { EmotionalValidator } from "./emotional-validator.js";
import { BedtimeSafetyValidator } from "./bedtime-safety-validator.js";
import { PacingValidator } from "./pacing-validator.js";
import { ProseRhythmValidator } from "./prose-rhythm-validator.js";
import { SensoryValidator } from "./sensory-validator.js";
import { ContinuityValidator } from "./continuity-validator.js";
import { ReadingLevelValidator } from "./reading-level-validator.js";
import { failThresholdsFor, VALIDATION_THRESHOLDS } from "../config/validation-thresholds.js";

const DEFAULT_WEIGHTS = {
  "bedtime-safety": 0.20,
  emotional:        0.18,
  pacing:           0.14,
  sensory:          0.12,
  "prose-rhythm":   0.12,
  repetition:       0.10,
  continuity:       0.08,
  "reading-level":  0.06
};

export class ValidationEngine {
  constructor(config = {}) {
    this.debug = config.debug ?? Boolean(process?.env?.STORY_ENGINE_VALIDATION_DEBUG);
    this.weights = { ...DEFAULT_WEIGHTS, ...(config.weights || {}) };

    this.validators = [
      new RepetitionValidator(mergeValidatorConfig("repetition", config.repetition)),
      new EmotionalValidator(mergeValidatorConfig("emotional", config.emotional)),
      new BedtimeSafetyValidator(mergeValidatorConfig("bedtime-safety", config.bedtimeSafety)),
      new PacingValidator(mergeValidatorConfig("pacing", config.pacing)),
      new ProseRhythmValidator(mergeValidatorConfig("prose-rhythm", config.proseRhythm)),
      new SensoryValidator(mergeValidatorConfig("sensory", config.sensory)),
      new ContinuityValidator(mergeValidatorConfig("continuity", config.continuity)),
      new ReadingLevelValidator(mergeValidatorConfig("reading-level", config.readingLevel))
    ];

    // Expose the full 3-tier threshold table for telemetry / advisor consumers.
    this.thresholdTable = VALIDATION_THRESHOLDS;
  }

  /**
   * Validate a single scene's prose.
   * @param {string} sceneText
   * @param {object} scenePayload   the structured payload from scene-payload-builder
   * @param {object} [context]      optional runtime context (characters, ageBand, isClosingScene)
   */
  validateScene(sceneText, scenePayload = {}, context = {}) {
    const results = this.runAll((v) => v.validateScene(sceneText, scenePayload, context), "scene");
    return this.aggregate(results, "scene", { sceneId: scenePayload?.scene_id });
  }

  /**
   * Validate a fully assembled story.
   * @param {Array<string|{text:string}>} scenes
   * @param {object} [storyContext]  characters, age band, story-level continuity_state, etc.
   */
  validateStory(scenes = [], storyContext = {}) {
    const results = this.runAll((v) => v.validateStory(scenes, storyContext), "story");
    return this.aggregate(results, "story", { sceneCount: scenes.length });
  }

  runAll(invoke, level) {
    const out = [];
    for (const validator of this.validators) {
      const name = validator.constructor.name;
      const t0 = nowMs();
      try {
        const res = invoke(validator);
        const ms = nowMs() - t0;
        if (this.debug) {
          const status = res.passed ? "PASS" : "FAIL";
          const flagCount = Array.isArray(res.flags) ? res.flags.length : 0;
          console.log(
            `[validation:${level}] ${res.validator} score=${res.score} thr=${res.threshold} ${status} flags=${flagCount} ${ms.toFixed(1)}ms`
          );
        }
        out.push({ ...res, executionMs: round1(ms) });
      } catch (err) {
        const ms = nowMs() - t0;
        console.error(`[validation:${level}] ${name} threw:`, err.message);
        out.push({
          validator: name.replace(/Validator$/, "").toLowerCase(),
          level,
          score: 0,
          threshold: 100,
          passed: false,
          flags: [{ type: "validator_error", severity: "high", evidence: err.message }],
          metrics: {},
          executionMs: round1(ms),
          error: err.message
        });
      }
    }
    return out;
  }

  aggregate(results, level, extras = {}) {
    const byValidator = {};
    const flags = [];
    let weightedSum = 0;
    let weightTotal = 0;
    let allPassed = true;
    let totalMs = 0;

    for (const r of results) {
      byValidator[r.validator] = r;
      const w = this.weights[r.validator] ?? 0;
      weightedSum += (r.score || 0) * w;
      weightTotal += w;
      if (!r.passed) allPassed = false;
      if (Array.isArray(r.flags)) flags.push(...r.flags.map((f) => ({ ...f, validator: r.validator })));
      totalMs += r.executionMs || 0;
    }

    const overallScore = weightTotal > 0 ? round1(weightedSum / weightTotal) : 0;

    return {
      level,
      ...extras,
      passed: allPassed,
      overallScore,
      results: byValidator,
      flags,
      executionMs: round1(totalMs),
      timestamp: new Date().toISOString()
    };
  }
}

function mergeValidatorConfig(name, override = {}) {
  const central = failThresholdsFor(name);
  return {
    ...override,
    thresholds: {
      scene: override.thresholds?.scene ?? central.scene,
      story: override.thresholds?.story ?? central.story
    }
  };
}

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export default ValidationEngine;
