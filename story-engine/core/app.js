/**
 * Story Engine Core Application
 * 
 * Main entry point for the story generation engine.
 * Orchestrates the complete pipeline from request to output.
 * 
 * PHASE 1: Application structure and initialization
 */

import ContextOrchestrator from "./core/context-orchestrator.js";
import PipelineController from "./core/pipeline-controller.js";
import ValidationEngine from "./validation/validation-engine.js";

export class StoryEngine {
  constructor(options = {}) {
    this.contextOrchestrator = new ContextOrchestrator(options);
    this.validationEngine = new ValidationEngine(options);
    this.pipelineController = new PipelineController({
      contextOrchestrator: this.contextOrchestrator,
      validationEngine: this.validationEngine,
      ...options
    });

    this.config = options.config || {};
    this.isInitialized = false;
  }

  /**
   * Initialize the engine
   */
  async initialize() {
    console.log("[StoryEngine] Initializing narrative engine");

    try {
      // PHASE 2: Load frameworks from filesystem
      // PHASE 2: Initialize model connections
      // PHASE 2: Set up memory stores

      this.isInitialized = true;
      console.log("[StoryEngine] Engine initialized successfully");

      return { status: "ready", version: "1.0.0-phase1" };
    } catch (error) {
      console.error("[StoryEngine] Initialization failed:", error.message);
      throw error;
    }
  }

  /**
   * Generate a story from a user request
   * 
   * INPUT: {
   *   childName: string,
   *   childAge: number,
   *   childGender: "boy" | "girl" | "other",
   *   theme: string,
   *   length: "short" | "medium" | "long",
   *   preferences: object
   * }
   * 
   * OUTPUT: {
   *   story: string,
   *   metadata: object
   * }
   */
  async generateStory(request) {
    if (!this.isInitialized) {
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    console.log("[StoryEngine] Story generation request received");
    console.log(`  Child: ${request.childName} (${request.childAge}y ${request.childGender})`);
    console.log(`  Theme: ${request.theme} | Length: ${request.length}`);

    try {
      // Run the pipeline
      const result = await this.pipelineController.execute(request);

      // Finalize and return
      const finalResult = this.contextOrchestrator.finalizeContext(result.story);

      console.log("[StoryEngine] Story generated successfully");
      return finalResult;

    } catch (error) {
      console.error("[StoryEngine] Story generation failed:", error.message);
      throw error;
    }
  }

  /**
   * Get engine status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      pipeline: this.pipelineController.getStatus(),
      version: "1.0.0-phase1"
    };
  }
}

// Export for use in server.js
export default StoryEngine;
