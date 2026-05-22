/**
 * Emotional Recovery Engine
 *
 * When the previous story carried high emotional intensity, this engine
 * suppresses re-stimulation and boosts decompression signals in the new story.
 *
 * "previousStoryIntensity" is a 1–5 scale: 1 = calm, 5 = highly intense.
 * In practice, this is passed from the client if available; default: 2 (mild).
 *
 * Returns { recoveryProfile, promptBlock }
 */

const RECOVERY_PROFILES = [
  {
    level: 1,
    label: "calm-continuation",
    suppressAdventure: false,
    boostComfort: false,
    note: "Previous story was calm. Standard emotional arc applies.",
    promptDirectives: [],
  },
  {
    level: 2,
    label: "mild-recovery",
    suppressAdventure: false,
    boostComfort: false,
    note: "Mild intensity last time. Standard arc with gentle landing.",
    promptDirectives: [
      "Ensure the emotional peak does not exceed mild excitement.",
      "The return to safety at the end should feel generous and warm.",
    ],
  },
  {
    level: 3,
    label: "moderate-recovery",
    suppressAdventure: true,
    boostComfort: true,
    note: "Moderate intensity last time. This story should prioritise decompression.",
    promptDirectives: [
      "Begin with a noticeably calm, grounding opening — no immediate adventure.",
      "Emotional peak should be soft and comforting, not exciting.",
      "The ending should be longer and warmer than usual — linger in safety.",
      "Avoid antagonists, tension, or unresolved moments.",
    ],
  },
  {
    level: 4,
    label: "active-recovery",
    suppressAdventure: true,
    boostComfort: true,
    note: "High intensity last time. This story is primarily a comfort story.",
    promptDirectives: [
      "This is a gentle comfort story — adventure is minimal, warmth is primary.",
      "Open with familiar, cosy imagery — home, warmth, favourite things.",
      "Any challenge is small and immediately resolved with kindness.",
      "The ending is the longest, softest section — pure safety signals.",
      "Favour familiar words and gentle repetition over novelty.",
    ],
  },
  {
    level: 5,
    label: "full-recovery",
    suppressAdventure: true,
    boostComfort: true,
    note: "Very high intensity last time. Story should be a pure lullaby.",
    promptDirectives: [
      "This story is a lullaby in prose form. No adventure, no challenge.",
      "Open and stay in warmth: soft light, quiet world, safety.",
      "One gentle thread: the child arrives at rest.",
      "Every sentence should ease the reader toward sleep.",
      "End with the shortest, softest closing in the story.",
    ],
  },
];

/**
 * @param {{ previousStoryIntensity?: number }} opts
 * @returns {{ recoveryProfile: object, promptBlock: string }}
 */
export function buildRecoveryProfile({ previousStoryIntensity } = {}) {
  const intensity = Math.min(5, Math.max(1, Math.round(Number(previousStoryIntensity) || 2)));
  const profile   = RECOVERY_PROFILES.find((p) => p.level === intensity) || RECOVERY_PROFILES[1];

  const promptBlock = profile.promptDirectives.length > 0
    ? `EMOTIONAL RECOVERY (previous intensity: ${intensity}/5 — ${profile.label}):\n${profile.promptDirectives.map((d) => `- ${d}`).join("\n")}`
    : "";

  return { recoveryProfile: profile, promptBlock };
}

export default buildRecoveryProfile;
