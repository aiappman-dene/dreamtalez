/**
 * Adaptive Storyflow Orchestrator
 *
 * Master orchestrator for Phase 4 — Adaptive Intelligence.
 * Pulls together all adaptive engines into a single prompt block.
 *
 * Called once per story generation with available context.
 * All parameters are optional — every engine has safe fallbacks.
 *
 * Returns { adaptiveContext, promptBlock }
 */

import { calculateStoryEnergy }         from "./adaptive-story-energy.js";
import { buildAdaptivePacing }          from "./adaptive-pacing-engine.js";
import { buildSleepinessProfile }       from "./sleepiness-engine.js";
import { buildAgeProfile, ageProfileToPromptBlock } from "./age-intelligence-engine.js";
import { buildRecoveryProfile }         from "./emotional-recovery-engine.js";
import { prioritizeComfortAnchors }     from "./comfort-reinforcement-engine.js";
import { determineStoryLength }         from "./adaptive-length-engine.js";

/**
 * @param {{
 *   bedtimeHour?: number,
 *   ageRange?: number,
 *   previousStoryIntensity?: number,
 *   continuityMemory?: object,
 * }} opts
 * @returns {{ adaptiveContext: object, promptBlock: string }}
 */
export function buildAdaptiveStoryflow({
  bedtimeHour,
  ageRange,
  previousStoryIntensity,
  continuityMemory,
} = {}) {
  const energy    = calculateStoryEnergy({ bedtimeHour, ageRange });
  const sleepiness = buildSleepinessProfile({ bedtimeHour });
  const ageProfile = buildAgeProfile(ageRange);
  const { pacingProfile, promptBlock: pacingBlock } = buildAdaptivePacing({ bedtimeHour, ageRange });
  const { recoveryProfile, promptBlock: recoveryBlock } = buildRecoveryProfile({ previousStoryIntensity });
  const { anchors, promptBlock: comfortBlock } = prioritizeComfortAnchors({ continuityMemory });
  const { lengthProfile, promptBlock: lengthBlock } = determineStoryLength({ bedtimeHour, ageRange });

  const adaptiveContext = {
    energy,
    sleepiness,
    ageProfile,
    pacingProfile,
    recoveryProfile,
    anchors,
    lengthProfile,
  };

  const sections = [
    lengthBlock,
    pacingBlock,
    ageProfileToPromptBlock(ageProfile),
    recoveryBlock,
    comfortBlock,
  ].filter(Boolean);

  const promptBlock = sections.length > 0
    ? `\n\n=== ADAPTIVE INTELLIGENCE (Phase 4) ===\n${sections.join("\n\n")}\n=== END ADAPTIVE INTELLIGENCE ===`
    : "";

  return { adaptiveContext, promptBlock };
}

export default buildAdaptiveStoryflow;
