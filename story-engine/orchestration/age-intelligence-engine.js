/**
 * Age Intelligence Engine
 *
 * Builds a rich age profile that shapes vocabulary complexity, sentence length,
 * emotional nuance, and narrative abstraction level.
 *
 * Returns an AgeProfile object injected into the story prompt.
 */

const AGE_PROFILES = [
  {
    key: "toddler",
    ageRange: [2, 4],
    label: "Toddler (2–4)",
    vocabularyLevel: "very-simple",
    sentenceLength: "short",        // ≤ 8 words average
    emotionalNuance: "concrete",    // happy/sad/scared, no subtlety
    abstractionLevel: "none",       // everything literal and immediate
    narrativeComplexity: "single-thread", // one thing at a time
    magicTone: "playful",
    promptDirectives: [
      "Use only very simple, common words a 3-year-old would know.",
      "Sentences must be short and rhythmic — 6 to 8 words maximum.",
      "Emotions are concrete: happy, sad, scared, cozy — no subtlety.",
      "No subplots. One clear adventure thread from start to finish.",
      "Animals and objects can talk and act like friends.",
      "Repetition of comfort words is warmly welcome.",
    ],
  },
  {
    key: "preschool",
    ageRange: [4, 6],
    label: "Preschool (4–6)",
    vocabularyLevel: "simple",
    sentenceLength: "short-medium", // 8–12 words average
    emotionalNuance: "emerging",    // beginning to recognise emotional shading
    abstractionLevel: "minimal",    // concrete with small imaginative leaps
    narrativeComplexity: "light-arc",
    magicTone: "wonder-forward",
    promptDirectives: [
      "Language should be accessible and warm — a child of 5 should follow every sentence.",
      "Sentences average 8 to 12 words. Vary rhythm: short punchy sentences mixed with gentle longer ones.",
      "Emotional moments are simple but allowed to be tender and touching.",
      "A small narrative arc: a challenge, a moment of courage or kindness, a warm resolution.",
      "Magic should feel genuinely magical — not explained, just real.",
      "End with strong safety and comfort signals.",
    ],
  },
  {
    key: "early",
    ageRange: [6, 8],
    label: "Early reader (6–8)",
    vocabularyLevel: "moderate",
    sentenceLength: "medium",       // 10–15 words average
    emotionalNuance: "moderate",    // nuanced within safe territory
    abstractionLevel: "moderate",   // metaphor and gentle symbolism OK
    narrativeComplexity: "two-thread",
    magicTone: "wonder-with-stakes",
    promptDirectives: [
      "Vocabulary can be richer — introduce one or two new words per story, used contextually.",
      "Sentences can be longer and more complex, but never tangled.",
      "Emotional depth is welcome: bravery, small fears overcome, the warmth of belonging.",
      "A secondary story thread (a helper, a mystery) is allowed if it resolves before the ending.",
      "Metaphors and imagery are welcome — soft, vivid, and purposeful.",
      "The ending should feel emotionally complete, not just narratively closed.",
    ],
  },
  {
    key: "middle",
    ageRange: [8, 10],
    label: "Middle childhood (8–10)",
    vocabularyLevel: "rich",
    sentenceLength: "medium-long",  // 12–18 words average
    emotionalNuance: "nuanced",
    abstractionLevel: "full",       // symbolism, irony-lite, theme
    narrativeComplexity: "multi-thread",
    magicTone: "wonder-with-meaning",
    promptDirectives: [
      "Rich, confident language. Vivid imagery. Well-chosen words over safe ones.",
      "Story can carry emotional complexity: loyalty, fairness, the courage to be kind.",
      "A clear theme should emerge — not stated, but felt.",
      "Two story threads may weave — but resolve completely before the ending.",
      "Sensory language can be layered and precise.",
      "The ending carries weight — earned, not given.",
    ],
  },
  {
    key: "older",
    ageRange: [10, 13],
    label: "Older child (10–12)",
    vocabularyLevel: "advanced",
    sentenceLength: "long",         // 15–20 words average
    emotionalNuance: "complex",
    abstractionLevel: "high",
    narrativeComplexity: "full-arc",
    magicTone: "wonder-as-metaphor",
    promptDirectives: [
      "Prose quality is paramount: precise, evocative, confident.",
      "Emotional complexity is welcome — nuance over simplicity.",
      "Theme should run as a clear undercurrent throughout.",
      "The child hero navigates genuine moral or emotional stakes.",
      "Magic may carry symbolic weight — a quest about belonging, courage, or growth.",
      "The ending should feel like exhaling — complete and deeply felt.",
    ],
  },
];

const DEFAULT_PROFILE = AGE_PROFILES[1]; // "preschool"

/**
 * @param {number|string} ageRange
 * @returns {object} AgeProfile
 */
export function buildAgeProfile(ageRange) {
  const age = Number(ageRange) || 5;
  const match = AGE_PROFILES.find(({ ageRange: [lo, hi] }) => age >= lo && age < hi);
  return match || DEFAULT_PROFILE;
}

/**
 * @param {object} profile - result of buildAgeProfile()
 * @returns {string} Prompt block for injection
 */
export function ageProfileToPromptBlock(profile) {
  return `AGE INTELLIGENCE (${profile.label}):
${profile.promptDirectives.map((d) => `- ${d}`).join("\n")}
Vocabulary level: ${profile.vocabularyLevel} | Sentence length: ${profile.sentenceLength} | Magic tone: ${profile.magicTone}`;
}

export default buildAgeProfile;
