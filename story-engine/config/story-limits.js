/**
 * Story Limits
 *
 * Word budgets per story mode. Section targets are guides for the
 * pacing validator — the total is the hard cap enforced by the trimmer.
 */

export const STORY_LIMITS = {
  // Standard stories: 700–900 words. Do NOT pad to reach the maximum.
  // Short emotional scenes may be 500–650; climactic scenes may approach 900.
  default: {
    targetWords:  700,
    maximumWords: 800,
    sections: {
      opening:    140,
      wonder:     180,
      middle:     220,
      resolution: 100,
      ending:     60,
    },
  },
  familyMagic: {
    targetWords:  900,
    maximumWords: 1000,
    sections: {
      opening:    180,
      wonder:     220,
      middle:     300,
      resolution: 160,
      ending:     140,
    },
  },
  hero: {
    targetWords:  700,
    maximumWords: 800,
    sections: {
      opening:    140,
      wonder:     180,
      middle:     220,
      resolution: 100,
      ending:     60,
    },
  },
  sleepy: {
    targetWords:  700,
    maximumWords: 800,
    sections: {
      opening:    140,
      wonder:     160,
      middle:     220,
      resolution: 110,
      ending:     110,
    },
  },
};

export default STORY_LIMITS;
