/**
 * Pipeline Controller
 * 
 * Orchestrates the story generation pipeline:
 * 1. Framework Injection
 * 2. Story Planning (Claude Opus)
 * 3. Scene Generation (Claude Sonnet)
 * 4. Multi-pass Refinement
 * 5. Quality Validation
 * 6. Output
 * 
 * PHASE 1: Pipeline structure and stage definitions
 */

import { ScenePlanner } from "../orchestration/scene-planner.js";
import { SceneTransitionManager } from "../orchestration/scene-transition-manager.js";
import { SceneMemoryManager } from "../orchestration/scene-memory-manager.js";
import { ScenePayloadBuilder } from "../orchestration/scene-payload-builder.js";
import { SonnetProductionWriter } from "../orchestration/sonnet-production-writer.js";
import { ValidationObserver } from "../validation/validation-observer.js";
import { ValidationTelemetry } from "../validation/validation-telemetry.js";
import { RefinementAdvisor } from "../validation/refinement-advisor.js";

export class PipelineController {
  constructor(options = {}) {
    this.stages = [
      "framework-injection",
      "context-building",
      "story-planning",
      "scene-planning",
      "scene-transitions",
      "scene-memory",
      "scene-payload-building",
      "sonnet-production",
      "scene-generation",
      "sensory-injection",
      "prose-refinement",
      "bedtime-controller",
      "final-polish",
      "validation",
      "output"
    ];

    this.currentStage = null;
    this.stageResults = {};
    this.contextOrchestrator = options.contextOrchestrator;
    this.validationEngine = options.validationEngine;
    this.scenePlanner = options.scenePlanner || new ScenePlanner();
    this.sceneTransitionManager = options.sceneTransitionManager || new SceneTransitionManager();
    this.sceneMemoryManager = options.sceneMemoryManager || new SceneMemoryManager();
    this.scenePayloadBuilder = options.scenePayloadBuilder || new ScenePayloadBuilder();
    this.sonnetProductionWriter = options.sonnetProductionWriter || new SonnetProductionWriter();

    // Phase 1.5: passive observer + process-scoped telemetry + future-safe advisor.
    // Phase 2 will register refinement orchestration via observer.on(...).
    this.validationTelemetry = options.validationTelemetry
      || (this.validationEngine
            ? new ValidationTelemetry({ debugSampleRate: options.telemetryDebugSampleRate ?? 0 })
            : null);
    this.refinementAdvisor = options.refinementAdvisor
      || (this.validationEngine ? new RefinementAdvisor() : null);
    this.validationObserver = options.validationObserver
      || (this.validationEngine
            ? new ValidationObserver({
                engine: this.validationEngine,
                debug: options.debug,
                telemetry: this.validationTelemetry,
                advisor: this.refinementAdvisor
              })
            : null);
  }

  /**
   * Execute the complete pipeline
   */
  async execute(storyRequest) {
    console.log(`[Pipeline] Starting story generation pipeline`);

    // Open a story session on the observer so per-story state is isolated.
    // Telemetry/advisor are process-scoped collaborators and persist.
    this.stageResults = {};
    if (this.validationObserver?.startStory) {
      this.validationObserver.startStory(storyRequest?.sessionId);
    }

    try {
      // Stage 1: Initialize context frameworks
      await this.runStage("framework-injection", storyRequest);

      // Stage 2: Build runtime orchestration context
      await this.runStage("context-building", {
        request: storyRequest,
        frameworks: this.stageResults["framework-injection"]
      });

      // Stage 3: Plan the story using frameworks (Opus)
      await this.runStage("story-planning", this.stageResults["context-building"]);

      // Stage 4: Build scene-level plan from the story blueprint
      await this.runStage("scene-planning", this.stageResults["story-planning"]);

      // Stage 5: Apply scene transitions for continuity
      await this.runStage("scene-transitions", this.stageResults["scene-planning"]);

      // Stage 6: Update scene memory and continuity
      await this.runStage("scene-memory", this.stageResults["scene-transitions"]);

      // Stage 7: Build Sonnet-ready runtime payloads
      await this.runStage("scene-payload-building", this.stageResults["scene-memory"]);

      // Stage 8: Create Sonnet production payloads
      await this.runStage("sonnet-production", this.stageResults["scene-payload-building"]);

      // Stage 9: Prepare scene rendering queue
      await this.runStage("scene-generation", this.stageResults["sonnet-production"]);

      // Stage 10: Inject sensory instructions
      await this.runStage("sensory-injection", this.stageResults["scene-generation"]);

      // Stage 5: Refine prose
      await this.runStage("prose-refinement", this.stageResults["sensory-injection"]);

      // Stage 6: Apply bedtime-specific softening
      await this.runStage("bedtime-controller", this.stageResults["prose-refinement"]);

      // Stage 7: Final polish
      await this.runStage("final-polish", this.stageResults["bedtime-controller"]);

      // Stage 8: Run story-level validation (Phase 1: passive observer — never blocks).
      await this.runStage("validation", this.stageResults["final-polish"]);

      // Stage 9: Return output
      return await this.runStage("output", this.stageResults["final-polish"]);

    } catch (error) {
      console.error(`[Pipeline] Error during ${this.currentStage}:`, error.message);
      throw error;
    } finally {
      // Close the session at the story boundary regardless of success/failure.
      // If we threw mid-stream, the next startStory() call would still
      // self-heal — but closing here keeps the observer state tidy.
      if (this.validationObserver?.endStory) this.validationObserver.endStory();
    }
  }

  /**
   * Run a single pipeline stage
   */
  async runStage(stageName, input) {
    this.currentStage = stageName;
    console.log(`[Pipeline] Running stage: ${stageName}`);

    const startTime = Date.now();
    let result;

    switch (stageName) {
      case "framework-injection":
        result = await this.stageFrameworkInjection(input);
        break;
      case "story-planning":
        result = await this.stageStoryPlanning(input);
        break;
      case "scene-planning":
        result = await this.stageScenePlanning(input);
        break;
      case "scene-transitions":
        result = await this.stageSceneTransitions(input);
        break;
      case "scene-memory":
        result = await this.stageSceneMemory(input);
        break;
      case "scene-payload-building":
        result = await this.stageScenePayloadBuilding(input);
        break;
      case "sonnet-production":
        result = await this.stageSonnetProduction(input);
        break;
      case "scene-generation":
        result = await this.stageSceneGeneration(input);
        break;
      case "sensory-injection":
        result = await this.stageSensoryInjection(input);
        break;
      case "prose-refinement":
        result = await this.stageProseRefinement(input);
        break;
      case "bedtime-controller":
        result = await this.stageBedtimeController(input);
        break;
      case "final-polish":
        result = await this.stageFinalPolish(input);
        break;
      case "validation":
        result = await this.stageValidation(input);
        break;
      case "output":
        result = await this.stageOutput(input);
        break;
      default:
        throw new Error(`Unknown stage: ${stageName}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Pipeline] Stage ${stageName} completed in ${duration}ms`);

    this.stageResults[stageName] = result;
    return result;
  }

  // ========== PLACEHOLDER STAGE METHODS ==========
  // PHASE 2: Implement actual logic for each stage

  async stageFrameworkInjection(request) {
    // PHASE 2: Load frameworks based on request parameters
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

  async stageContextBuilding({ request, frameworks }) {
    // PHASE 2: Build controlled runtime payload before Sonnet generation
    if (!this.contextOrchestrator) {
      throw new Error("ContextOrchestrator is required for context-building stage.");
    }

    if (frameworks) {
      request.frameworks = frameworks;
    }

    return await this.contextOrchestrator.initializeContext(request);
  }

  async stageStoryPlanning(contextPayload) {
    // PHASE 2: Use Claude Opus to create story blueprint
    return {
      blueprint: {
        overview: "gentle bedtime story structure",
        theme: contextPayload.runtime_context.story_dna?.theme || "cozy dreams",
        beat_sequence: ["opening", "development", "peak", "closing"]
      },
      runtime_context: contextPayload.runtime_context
    };
  }

  async stageScenePlanning(storyPlanPayload) {
    return this.scenePlanner.planScenes({
      runtime_context: storyPlanPayload.runtime_context,
      storyBlueprint: storyPlanPayload.blueprint
    });
  }

  async stageSceneTransitions(scenePlanPayload) {
    return this.sceneTransitionManager.applyTransitions(scenePlanPayload, scenePlanPayload.runtime_context);
  }

  async stageSceneMemory(sceneTransitionPayload) {
    const memoryPayload = this.sceneMemoryManager.updateMemory({
      scenes: sceneTransitionPayload.scene_plan,
      previousMemory: sceneTransitionPayload.runtime_context.character_memory || {}
    });

    return {
      ...memoryPayload,
      runtime_context: sceneTransitionPayload.runtime_context,
      scene_plan: sceneTransitionPayload.scene_plan
    };
  }

  async stageScenePayloadBuilding(sceneMemoryPayload) {
    return this.scenePayloadBuilder.buildScenePayloads({
      scene_plan: sceneMemoryPayload.scene_plan,
      runtime_context: sceneMemoryPayload.runtime_context,
      scene_memory: sceneMemoryPayload
    });
  }

  async stageSonnetProduction(scenePayloadResult) {
    return this.sonnetProductionWriter.buildProductionPayloads(
      scenePayloadResult.scene_payloads,
      scenePayloadResult.runtime_context
    );
  }

  async stageSceneGeneration(sonnetProductionResult) {
    const renderQueue = sonnetProductionResult.sonnet_payloads || [];
    const runtimeContext = sonnetProductionResult.runtime_context || {};

    // Phase 1: passive per-scene observation. Each render queue item
    // *may* carry rendered prose (Phase 2 once Sonnet runs); if it does,
    // the observer scores and logs it. If not, the call is skipped.
    if (this.validationObserver) {
      const observerContext = this.buildObserverContext(runtimeContext, renderQueue);
      for (const item of renderQueue) {
        const sceneText = extractSceneProse(item);
        if (!sceneText) continue;
        this.validationObserver.observeScene({
          sceneText,
          scenePayload: item.payload || item.scene_payload || {},
          context: { ...observerContext, isClosingScene: isClosingItem(item, renderQueue) }
        });
      }
    }

    return {
      render_queue: renderQueue,
      runtime_context: runtimeContext,
      scene_payloads: sonnetProductionResult.scene_payloads
    };
  }

  buildObserverContext(runtimeContext, renderQueue) {
    return {
      characters: runtimeContext?.characters
        || runtimeContext?.story_dna?.characters
        || [],
      ageBand: runtimeContext?.story_dna?.target_age
        || runtimeContext?.target_age
        || runtimeContext?.ageBand
        || null,
      continuity_state: runtimeContext?.continuity_state || {},
      sceneCount: renderQueue.length
    };
  }

  async stageSensoryInjection(sceneRenderResult) {
    // PHASE 2: Enhance with sensory details
    return { enhancedScenes: scenes, sensoryMetadata: {} };
  }

  async stageProseRefinement(sensoryContent) {
    // PHASE 2: Refine prose rhythm and flow
    return { refinedStory: "" };
  }

  async stageBedtimeController(story) {
    // PHASE 2: Apply bedtime-specific softening and pacing
    return { bedtimeAdjusted: story };
  }

  async stageFinalPolish(story) {
    // PHASE 2: Final grammar, style, consistency check
    return { polishedStory: story };
  }

  async stageValidation(finalPolishResult) {
    // Phase 1: passive observer. Runs validateStory on the assembled scenes,
    // never throws, never blocks. Phase 2 wires refinement on top.
    if (!this.validationObserver) {
      return { passed: true, observed: false, reason: "no validation observer" };
    }

    const renderQueue = this.stageResults["scene-generation"]?.render_queue || [];
    const runtimeContext = this.stageResults["scene-generation"]?.runtime_context || {};
    const observerContext = this.buildObserverContext(runtimeContext, renderQueue);

    const scenes = collectAssembledScenes(finalPolishResult, renderQueue);
    const storyReport = this.validationObserver.observeStory({
      scenes,
      storyContext: observerContext
    });

    const aggregate = this.validationObserver.getReport();

    if (!aggregate.passed) {
      const failed = aggregate.story
        ? Object.values(aggregate.story.results || {}).filter((r) => !r.passed).map((r) => r.validator)
        : [];
      console.warn(
        `[validation] story did not pass — continuing delivery (Phase 1). overall=${aggregate.story?.overallScore ?? "n/a"} failed=${failed.join(",") || "scene-level"}`
      );
    }

    return { passed: aggregate.passed, observed: true, report: aggregate, storyReport };
  }

  async stageOutput(finalPolishResult) {
    const validationStage = this.stageResults["validation"] || {};
    const telemetrySnapshot = this.validationTelemetry?.snapshot?.() || null;
    if (this.validationTelemetry) {
      console.log(this.validationTelemetry.summarize());
    }
    return {
      story: finalPolishResult,
      metadata: {
        generatedAt: new Date().toISOString(),
        validation: validationStage.report || null,
        telemetry: telemetrySnapshot
      }
    };
  }

  /**
   * Get pipeline status
   */
  getStatus() {
    return {
      currentStage: this.currentStage,
      completedStages: Object.keys(this.stageResults),
      totalStages: this.stages.length,
      progress: `${Object.keys(this.stageResults).length}/${this.stages.length}`
    };
  }
}

/**
 * Defensively pull rendered prose out of a render-queue item.
 * Phase 2 will populate one of these fields once Sonnet renders;
 * Phase 1 returns null and the observer skips the scene cleanly.
 */
function extractSceneProse(item) {
  if (!item || typeof item !== "object") return null;
  const candidates = [
    item.prose,
    item.text,
    item.scene_text,
    item.rendered,
    item.rendered_text,
    item.output?.prose,
    item.output?.text
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c;
  }
  return null;
}

function isClosingItem(item, queue) {
  if (item?.payload?.metadata?.isClosingScene) return true;
  if (!Array.isArray(queue) || queue.length === 0) return false;
  return queue[queue.length - 1] === item;
}

/**
 * Collect assembled scene prose for story-level validation.
 * Looks at the polished story object first, then falls back to the render queue.
 */
function collectAssembledScenes(finalPolishResult, renderQueue) {
  if (Array.isArray(finalPolishResult?.scenes)) {
    return finalPolishResult.scenes
      .map((s, i) => ({ text: typeof s === "string" ? s : (s?.text || s?.prose || ""), index: i }))
      .filter((s) => s.text);
  }
  if (typeof finalPolishResult?.polishedStory === "string" && finalPolishResult.polishedStory.trim()) {
    return [{ text: finalPolishResult.polishedStory, index: 0 }];
  }
  if (Array.isArray(renderQueue)) {
    return renderQueue
      .map((item, i) => ({ text: extractSceneProse(item) || "", index: i }))
      .filter((s) => s.text);
  }
  return [];
}

export default PipelineController;
