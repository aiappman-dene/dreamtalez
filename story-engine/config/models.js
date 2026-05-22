/**
 * Model Configuration
 * Defines LLM model choices and capabilities
 * 
 * ARCHITECTURE RULE:
 * - Opus: Framework creation, narrative design, orchestration planning
 * - Sonnet: Runtime story generation, refinement execution
 * - All model calls are injected through this config
 */

export const MODELS = {
  // Framework Design & Orchestration (expensive, high-quality)
  OPUS: {
    id: "claude-opus-4-1",
    type: "framework",
    capabilities: [
      "narrative-framework-design",
      "emotional-architecture",
      "character-philosophy",
      "scene-structure-planning",
      "refinement-rules"
    ],
    costTier: "premium",
    latency: "high"
  },

  // Runtime Production (efficient, consistent)
  SONNET: {
    id: "claude-sonnet-4-20250514",
    type: "runtime",
    capabilities: [
      "story-generation",
      "scene-writing",
      "prose-refinement",
      "sensory-injection",
      "final-polish"
    ],
    costTier: "standard",
    latency: "low"
  }
};

/**
 * Model selection strategy
 */
export const MODEL_STRATEGY = {
  // Use Opus only during setup/framework-building phases
  frameworkDesign: MODELS.OPUS,
  narrativeArchitecture: MODELS.OPUS,
  orchestrationPlanning: MODELS.OPUS,

  // Use Sonnet for all runtime operations
  storyGeneration: MODELS.SONNET,
  sceneRefinement: MODELS.SONNET,
  proofReading: MODELS.SONNET
};

/**
 * Model context windows and token limits
 */
export const TOKEN_LIMITS = {
  [MODELS.OPUS.id]: {
    contextWindow: 200000,
    maxOutput: 4096,
    safetyMargin: 0.85
  },
  [MODELS.SONNET.id]: {
    contextWindow: 200000,
    maxOutput: 4096,
    safetyMargin: 0.85
  }
};

export default {
  MODELS,
  MODEL_STRATEGY,
  TOKEN_LIMITS
};
