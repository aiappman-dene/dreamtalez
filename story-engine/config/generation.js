/**
 * Generation Configuration
 * Settings for story generation parameters and behavior
 */

export const GENERATION_CONFIG = {
  // Story length presets
  lengths: {
    short: {
      targetTokens: 800,
      sceneCount: 3,
      readingTime: "5 min",
      description: "Quick bedtime adventure"
    },
    medium: {
      targetTokens: 1500,
      sceneCount: 5,
      readingTime: "7-10 min",
      description: "Full bedtime story"
    },
    long: {
      targetTokens: 2500,
      sceneCount: 7,
      readingTime: "12-15 min",
      description: "Extended adventure"
    }
  },

  // Generation modes
  modes: {
    adventure: "Exciting, wonder-filled journey",
    emotional: "Emotional learning and growth",
    comfort: "Safe, soothing, reassuring",
    discovery: "Exploration and wonder",
    heroic: "Courage and achievement",
    magical: "Fantasy and transformation"
  },

  // Bedtime safety parameters
  bedtimeSafety: {
    maxExcitementPeakIntensity: 0.6,
    requiresDownwardPacing: true,
    minimumCalmingEnd: true,
    avoidJarringTransitions: true,
    emphasisOnSafety: true
  },

  // Refinement iterations
  refinementLayers: {
    prose: {
      enabled: true,
      passes: 2,
      focus: "rhythm, clarity, flow"
    },
    sensory: {
      enabled: true,
      passes: 1,
      focus: "immersion, imagery"
    },
    bedtime: {
      enabled: true,
      passes: 1,
      focus: "calming, safety, comfort"
    },
    polish: {
      enabled: true,
      passes: 1,
      focus: "final smoothing, consistency"
    }
  },

  // Temperature and sampling
  sampling: {
    temperature: 0.8,
    topP: 0.95,
    frequencyPenalty: 0.3,
    presencePenalty: 0.1
  }
};

export default GENERATION_CONFIG;
