/**
 * Adaptive Pacing Engine
 *
 * Combines bedtime hour and age range into a pacing directive block
 * that governs how the story accelerates and decelerates through its arc.
 *
 * Returns { pacingProfile, promptBlock }
 */

import { calculateStoryEnergy } from "./adaptive-story-energy.js";
import { buildSleepinessProfile } from "./sleepiness-engine.js";

const PACING_ARCHETYPES = {
  "early-alert":    { openingPace: "warm and curious",       middlePace: "gently building",    endingPace: "slow and soft"       },
  "standard-warm":  { openingPace: "warm and inviting",      middlePace: "steady and wonder-forward", endingPace: "quiet and settling" },
  "settling-soft":  { openingPace: "soft and grounding",     middlePace: "gentle momentum",    endingPace: "very slow, like breathing" },
  "sleepy-gentle":  { openingPace: "hush-quiet",             middlePace: "tender, unhurried",  endingPace: "near-silence"        },
  "overtired-calm": { openingPace: "immediately soothing",   middlePace: "barely moving",      endingPace: "still as the night"  },
};

function selectArchetype(energyLabel, sleepinessLevel) {
  if (sleepinessLevel >= 5) return "overtired-calm";
  if (sleepinessLevel >= 4) return "sleepy-gentle";
  if (sleepinessLevel >= 3) return "settling-soft";
  if (energyLabel === "early-bedtime") return "early-alert";
  return "standard-warm";
}

/**
 * @param {{ bedtimeHour?: number, ageRange?: number }} opts
 * @returns {{ pacingProfile: object, promptBlock: string }}
 */
export function buildAdaptivePacing({ bedtimeHour, ageRange } = {}) {
  const energy    = calculateStoryEnergy({ bedtimeHour, ageRange });
  const sleepiness = buildSleepinessProfile({ bedtimeHour });

  const archetypeKey = selectArchetype(energy.label, sleepiness.level);
  const archetype    = PACING_ARCHETYPES[archetypeKey];

  const pacingProfile = {
    archetypeKey,
    ...archetype,
    sleepinessLabel:    sleepiness.label,
    energyLabel:        energy.label,
    excitementLevel:    energy.excitementLevel,
    calmLevel:          energy.calmLevel,
    wonderLevel:        energy.wonderLevel,
    cadenceDirective:   sleepiness.cadenceDirective,
    pacingNote:         sleepiness.pacingNote,
    endingNote:         sleepiness.endingNote,
  };

  const promptBlock = `ADAPTIVE PACING (bedtime-aware):
Opening pace: ${archetype.openingPace}
Middle pace: ${archetype.middlePace}
Ending pace: ${archetype.endingPace}
${sleepiness.pacingNote}
Cadence: ${sleepiness.cadenceDirective}
Ending guidance: ${sleepiness.endingNote}
Energy profile → wonder: ${energy.wonderLevel}/10 · calm: ${energy.calmLevel}/10 · excitement: ${energy.excitementLevel}/10`;

  return { pacingProfile, promptBlock };
}

export default buildAdaptivePacing;
