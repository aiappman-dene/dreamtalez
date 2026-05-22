/**
 * Scene Transition Manager
 *
 * Ensures emotional, pacing, and sensory continuity between scenes.
 */

export class SceneTransitionManager {
  constructor(options = {}) {
    this.options = options;
  }

  applyTransitions(scenePlan, runtimeContext) {
    const adjustedScenes = scenePlan.scene_plan.map((scene, index, scenes) => {
      const nextScene = scenes[index + 1];
      return {
        ...scene,
        transitionNotes: this.buildTransitionNotes(scene, nextScene, runtimeContext)
      };
    });

    return {
      scene_plan: adjustedScenes,
      runtime_context: runtimeContext,
      transition_summary: {
        scenes: adjustedScenes.length,
        continuity: "smoothed"
      }
    };
  }

  buildTransitionNotes(scene, nextScene, runtimeContext) {
    if (!nextScene) {
      return "Settles the story gently toward rest.";
    }

    const emotionalSmoothing = this.smoothEmotionalTransition(scene, nextScene);
    const sensoryBridge = this.buildSensoryBridge(scene, nextScene, runtimeContext.sensory_targets);
    const pacingLink = this.buildPacingLink(scene, nextScene);

    return `${emotionalSmoothing} ${sensoryBridge} ${pacingLink}`;
  }

  smoothEmotionalTransition(scene, nextScene) {
    if (scene.emotion === nextScene.emotion) {
      return "Maintains a calm emotional flow.";
    }
    return `Gently shifts from ${scene.emotion} to ${nextScene.emotion}.`;
  }

  buildSensoryBridge(scene, nextScene, sensoryTargets) {
    const firstTarget = scene.sensory_focus[0] || sensoryTargets.atmosphere;
    const nextTarget = nextScene.sensory_focus[0] || sensoryTargets.atmosphere;
    return `Connects ${firstTarget} to ${nextTarget} with soft sensory detail.`;
  }

  buildPacingLink(scene, nextScene) {
    if (scene.pacing === nextScene.pacing) {
      return "Keeps the pacing consistent.";
    }
    return `Shifts pacing from ${scene.pacing} to ${nextScene.pacing} smoothly.`;
  }
}

export default SceneTransitionManager;
