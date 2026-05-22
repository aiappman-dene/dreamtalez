/**
 * Sleepiness Engine
 *
 * Builds a sleepiness profile from bedtime hour.
 * Governs prose cadence, sentence rhythm, and how quickly the ending arrives.
 *
 * Returns { level, label, pacingNote, endingNote, cadenceDirective }
 */

const SLEEPINESS_PROFILES = [
  {
    hourRange: [18, 19],
    level: 1, label: "alert",
    pacingNote: "Child is still alert. Give the adventure room to breathe before deceleration.",
    endingNote: "Closing should feel gently earned, not rushed.",
    cadenceDirective: "Use longer flowing sentences in the middle. Slow naturally in the final third.",
  },
  {
    hourRange: [19, 20],
    level: 2, label: "relaxing",
    pacingNote: "Child is relaxing. Adventure should feel warm and satisfying, not stimulating.",
    endingNote: "Begin deceleration by the midpoint. Ending should feel inevitable.",
    cadenceDirective: "Mix long and short sentences evenly. Final section: short, complete, unhurried.",
  },
  {
    hourRange: [20, 21],
    level: 3, label: "settling",
    pacingNote: "Child is settling. Pacing should be gentle and steady throughout.",
    endingNote: "Reserve the last 25% of the story for sleep-readiness. Minimise new information.",
    cadenceDirective: "Shorter sentences from the emotional peak onwards. Final sentences: very short.",
  },
  {
    hourRange: [21, 22],
    level: 4, label: "sleepy",
    pacingNote: "Child is sleepy. Story should feel like being carried home — safe and quiet.",
    endingNote: "End earlier than you think. Simplicity is warmth.",
    cadenceDirective: "Brevity throughout the second half. The ending should be two or three short sentences.",
  },
  {
    hourRange: [22, 25],
    level: 5, label: "very-sleepy",
    pacingNote: "Child is very sleepy or overtired. Every sentence should ease rather than excite.",
    endingNote: "Minimal narrative action in final quarter. Pure atmosphere and safety signals.",
    cadenceDirective: "Short sentences dominant. Repetition of comfort words is allowed. Final sentence: five words or fewer.",
  },
];

const DEFAULT_PROFILE = SLEEPINESS_PROFILES[1]; // "relaxing" as default

/**
 * @param {{ bedtimeHour?: number }} opts
 * @returns {{ level: number, label: string, pacingNote: string, endingNote: string, cadenceDirective: string }}
 */
export function buildSleepinessProfile({ bedtimeHour } = {}) {
  if (bedtimeHour == null || isNaN(bedtimeHour)) return DEFAULT_PROFILE;
  const h = Number(bedtimeHour);
  const match = SLEEPINESS_PROFILES.find(({ hourRange: [lo, hi] }) => h >= lo && h < hi);
  return match || DEFAULT_PROFILE;
}

export default buildSleepinessProfile;
