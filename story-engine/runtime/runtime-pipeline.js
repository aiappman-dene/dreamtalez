/**
 * Runtime Pipeline
 *
 * Coordinates the framework-locked story generation pipeline:
 *   Locked frameworks (preloaded at boot)
 *     ↓
 *   Runtime context (built per request)
 *     ↓
 *   Sonnet generation (prose execution)
 *     ↓
 *   Story output
 *
 * This module is the bridge between the framework system and server.js.
 * It is used by server.js when locked frameworks are available.
 * When frameworks are not available, server.js falls back to the static
 * STORY_SYSTEM_PROMPT pipeline (fully backward compatible).
 */

import { frameworkLoader } from "./framework-loader.js";
import { buildRuntimeContext } from "./runtime-context.js";
import { compressContext } from "./context-compression-engine.js";

/**
 * Check if the framework locking system is ready.
 * If false, server.js should fall back to the static prompt pipeline.
 *
 * @returns {boolean}
 */
export function isFrameworkSystemReady() {
  return frameworkLoader.isLoaded() && frameworkLoader.hasProductionFrameworks();
}

/**
 * Get the locked Sonnet system prompt assembled from production frameworks.
 * Returns null if frameworks are not ready (caller handles fallback).
 *
 * @returns {string|null}
 */
export function getLockedSystemPrompt() {
  return frameworkLoader.buildSonnetSystemPrompt();
}

/**
 * Build a per-request runtime context from storyInputs.
 * Bridges the server.js storyInputs format to the runtime context schema.
 *
 * @param {object} storyInputs - from server.js runStoryPipeline
 * @param {object} adaptiveContext - from buildAdaptiveStoryflow
 * @returns {object} Compressed runtime context
 */
export function buildRequestContext(storyInputs, adaptiveContext = {}) {
  const fullContext = buildRuntimeContext({
    childProfile: {
      name:        storyInputs.name,
      age:         storyInputs.age,
      gender:      storyInputs.gender,
      interests:   storyInputs.interests,
      appearance:  storyInputs.appearance,
      language:    storyInputs.language,
      dialect:     storyInputs.language,
      familyMagic: storyInputs.familyMagic,
    },
    storyRequest: {
      mode:       storyInputs.mode,
      customIdea: storyInputs.customIdea,
      dayBeats:   storyInputs.dayBeats,
      childWish:  storyInputs.childWish,
      length:     storyInputs.length,
    },
    adaptiveState: {
      bedtimeHour:            storyInputs.bedtimeHour,
      sleepinessLevel:        adaptiveContext?.sleepiness?.level,
      previousStoryIntensity: storyInputs.previousStoryIntensity,
      ageBand:                adaptiveContext?.ageProfile?.key,
    },
  });

  return compressContext(fullContext);
}

/**
 * Get the locked config for a specific rule set.
 * Used by validators to load Opus-authored thresholds.
 *
 * @param {string} configKey - e.g. "validatorRules", "bedtimeRules"
 * @returns {object|null}
 */
export function getLockedConfig(configKey) {
  return frameworkLoader.getConfig(configKey);
}

export default {
  isFrameworkSystemReady,
  getLockedSystemPrompt,
  buildRequestContext,
  getLockedConfig,
};
