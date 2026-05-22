/**
 * Adaptive Story Energy
 *
 * Calculates a composite energy profile based on bedtime hour and child age.
 * Energy governs how active, exciting, or calm the narrative feels overall.
 *
 * Returns { baseEnergy, wonderLevel, calmLevel, excitementLevel, label }
 * All levels are 1–10 scales matching the Phase 3 emotional rhythm arc.
 */

// Maps hour → base energy modifier (0.0 = very sleepy, 1.0 = fully alert)
const HOUR_ENERGY_MAP = [
  { hourRange: [18, 19], modifier: 0.85, label: "early-bedtime" },
  { hourRange: [19, 20], modifier: 0.75, label: "standard-bedtime" },
  { hourRange: [20, 21], modifier: 0.60, label: "settling" },
  { hourRange: [21, 22], modifier: 0.45, label: "sleepy" },
  { hourRange: [22, 23], modifier: 0.30, label: "very-sleepy" },
  { hourRange: [23, 25], modifier: 0.20, label: "overtired" },
];

const DEFAULT_HOUR_MODIFIER = 0.65; // fallback: assume ~8pm feel

// Maps age → energy profile weights
const AGE_ENERGY_PROFILES = {
  toddler:     { ageRange: [2, 4],  wonder: 9, calm: 8, excitement: 3 },
  preschool:   { ageRange: [4, 6],  wonder: 9, calm: 7, excitement: 4 },
  early:       { ageRange: [6, 8],  wonder: 8, calm: 6, excitement: 5 },
  middle:      { ageRange: [8, 10], wonder: 7, calm: 5, excitement: 6 },
  older:       { ageRange: [10, 13],wonder: 6, calm: 5, excitement: 7 },
};

function getHourModifier(hour) {
  if (hour == null || isNaN(hour)) return DEFAULT_HOUR_MODIFIER;
  const h = Number(hour);
  const match = HOUR_ENERGY_MAP.find(({ hourRange: [lo, hi] }) => h >= lo && h < hi);
  return match ? match.modifier : DEFAULT_HOUR_MODIFIER;
}

function getHourLabel(hour) {
  if (hour == null || isNaN(hour)) return "standard-bedtime";
  const h = Number(hour);
  const match = HOUR_ENERGY_MAP.find(({ hourRange: [lo, hi] }) => h >= lo && h < hi);
  return match ? match.label : "standard-bedtime";
}

function getAgeProfile(ageRange) {
  const age = Number(ageRange) || 5;
  const key = Object.keys(AGE_ENERGY_PROFILES).find((k) => {
    const [lo, hi] = AGE_ENERGY_PROFILES[k].ageRange;
    return age >= lo && age < hi;
  }) || "preschool";
  return AGE_ENERGY_PROFILES[key];
}

/**
 * @param {{ bedtimeHour?: number, ageRange?: number }} opts
 * @returns {{ baseEnergy: number, wonderLevel: number, calmLevel: number, excitementLevel: number, label: string }}
 */
export function calculateStoryEnergy({ bedtimeHour, ageRange } = {}) {
  const hourMod  = getHourModifier(bedtimeHour);
  const hourLabel = getHourLabel(bedtimeHour);
  const ageProf  = getAgeProfile(ageRange);

  // Apply hour modifier: late hour suppresses excitement, amplifies calm
  const wonderLevel     = Math.round(ageProf.wonder     * (0.8 + hourMod * 0.2));
  const excitementLevel = Math.round(ageProf.excitement * hourMod);
  const calmLevel       = Math.round(ageProf.calm       * (1 + (1 - hourMod) * 0.3));

  const baseEnergy = Math.round((wonderLevel + excitementLevel + calmLevel) / 3);

  return {
    baseEnergy:     Math.min(10, Math.max(1, baseEnergy)),
    wonderLevel:    Math.min(10, Math.max(1, wonderLevel)),
    calmLevel:      Math.min(10, Math.max(1, calmLevel)),
    excitementLevel:Math.min(10, Math.max(1, excitementLevel)),
    label:          hourLabel,
  };
}

export default calculateStoryEnergy;
