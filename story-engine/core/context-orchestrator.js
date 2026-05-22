/**
 * Context Orchestrator
 *
 * Manages story generation context across all pipeline stages.
 * Integrates the runtime Context Builder for controlled Sonnet payloads.
 */

import ContextBuilder from "../orchestration/context-builder.js";
import { buildFamilyMagicContext } from "../orchestration/family-magic-context.js";

export class ContextOrchestrator {
  constructor(options = {}) {
    this.storyContext = {};
    this.emotionalState = {};
    this.sensoryState = {};
    this.continuityBuffer = [];
    this.memoryStore = options.memoryStore || null;
    this.frameworkStore = options.frameworkStore || null;
    this.contextBuilder = new ContextBuilder(options);
  }

  /**
   * Initialize story context from user request
   */
  async initializeContext(request) {
    const frameworks = request.frameworks ?? await this.loadFrameworks(request);
    const runtimeContextPayload = await this.contextBuilder.buildRuntimeContext({
      request,
      frameworks,
      previousContext: this.storyContext.runtime_context || {}
    });

    const familyMagicContext = buildFamilyMagicContext(request.profile || {});

    const context = {
      requestId: this.generateRequestId(),
      timestamp: new Date().toISOString(),
      child: {
        name: request.childName,
        age: request.childAge,
        gender: request.childGender
      },
      story: {
        theme: request.theme,
        length: request.length || "medium",
        mode: request.mode || "adventure"
      },
      familyMagic: familyMagicContext,
      frameworks,
      runtime_context: {
        ...runtimeContextPayload.runtime_context,
        familyMagic: familyMagicContext,
      },
      generation: {
        phase: "initialization",
        status: "pending",
        startTime: Date.now()
      }
    };

    this.storyContext = context;
    this.emotionalState = runtimeContextPayload.runtime_context.emotional_state;
    this.sensoryState = runtimeContextPayload.runtime_context.sensory_targets;
    this.continuityBuffer = runtimeContextPayload.runtime_context.continuity_state?.compressed_history?.recent_scenes || [];

    return context;
  }

  /**
   * Load narrative frameworks for this story
   */
  async loadFrameworks(request) {
    return {
      narrative: {
        masterDirector: "master-director.md",
        disneyDNA: "disney-dna.md",
        emotionalPhilosophy: "emotional-philosophy.md"
      },
      scene: {
        structure: "scene-structure.md",
        transitions: "transition-rules.md"
      },
      character: {
        philosophy: "character-philosophy.md",
        dialogue: "dialogue-rules.md"
      },
      refinement: {
        prose: "prose-refinement.md",
        sensory: "sensory-layering.md"
      }
    };
  }

  /**
   * Update emotional state as generation progresses
   */
  updateEmotionalState(sceneNumber, emotionalIntensity, emotionalType) {
    if (!this.emotionalState.arc) {
      this.emotionalState.arc = [];
    }

    this.emotionalState.arc.push({
      sceneNumber,
      emotion: emotionalType,
      intensity: emotionalIntensity,
      timestamp: Date.now()
    });

    return this.emotionalState;
  }

  /**
   * Update sensory state for immersion tracking
   */
  updateSensoryState(sceneSensoryElements) {
    this.sensoryState = {
      lastUpdated: Date.now(),
      visual: sceneSensoryElements.visual || [],
      auditory: sceneSensoryElements.auditory || [],
      tactile: sceneSensoryElements.tactile || [],
      olfactory: sceneSensoryElements.olfactory || []
    };

    return this.sensoryState;
  }

  /**
   * Maintain continuity buffer for consistency validation
   */
  recordGeneratedContent(sceneNumber, generatedText, metadata) {
    this.continuityBuffer.push({
      sceneNumber,
      text: generatedText,
      metadata,
      recordedAt: Date.now()
    });

    if (this.continuityBuffer.length > 10) {
      this.continuityBuffer = this.continuityBuffer.slice(-10);
    }

    return this.continuityBuffer;
  }

  /**
   * Get context summary for next pipeline stage
   */
  getContextSummary() {
    return {
      child: this.storyContext.child,
      story: this.storyContext.story,
      emotionalArc: this.emotionalState.arc,
      sensoryState: this.sensoryState,
      recentContent: this.continuityBuffer.slice(-3)
    };
  }

  /**
   * Finalize context after generation complete
   */
  finalizeContext(generatedStory) {
    this.storyContext.generation.phase = "complete";
    this.storyContext.generation.endTime = Date.now();
    this.storyContext.generation.duration =
      this.storyContext.generation.endTime - this.storyContext.generation.startTime;

    return {
      context: this.storyContext,
      story: generatedStory,
      metadata: {
        requestId: this.storyContext.requestId,
        duration: this.storyContext.generation.duration,
        frameworksUsed: Object.keys(this.storyContext.frameworks)
      }
    };
  }

  generateRequestId() {
    return `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ContextOrchestrator;
