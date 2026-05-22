/**
 * Scene Planner
 *
 * Builds a scene-level plan for the story using controlled runtime context.
 * The planner divides the story into narrative beats and assigns scene goals.
 */

export class ScenePlanner {
  constructor(options = {}) {
    this.options = options;
  }

  planScenes({ runtime_context, storyBlueprint = null }) {
    const sceneCount = runtime_context.pacing_state?.scene_count || 5;
    const scenes = [];

    for (let i = 1; i <= sceneCount; i += 1) {
      scenes.push(this.buildScenePlan(i, sceneCount, runtime_context));
    }

    return {
      scene_plan: scenes,
      scene_count: sceneCount,
      storyBlueprint,
      runtime_context
    };
  }

  buildScenePlan(index, totalScenes, runtime_context) {
    const stage = this.resolveSceneStage(index, totalScenes);
    const emotionalGoal = this.resolveEmotionalGoal(stage, runtime_context.emotional_state);
    const pacing = this.resolvePacingLevel(stage, runtime_context.pacing_state);
    const sensory_focus = this.resolveSensoryFocus(index, runtime_context.sensory_targets);
    const bedtime_intensity = this.resolveBedtimeIntensity(index, totalScenes, runtime_context.bedtime_rules);

    return {
      scene_id: `scene_${index}`,
      goal: this.buildSceneGoal(stage, runtime_context.story_dna),
      emotion: emotionalGoal,
      pacing,
      sensory_focus,
      bedtime_intensity,
      transitionIntent: this.resolveTransitionIntent(stage, runtime_context.pacing_state),
      endingMood: this.resolveSceneEndingMood(stage, runtime_context.emotional_state)
    };
  }

  resolveSceneStage(index, totalScenes) {
    if (index === 1) return "opening";
    if (index === totalScenes) return "closing";
    if (index === Math.ceil(totalScenes / 2)) return "peak";
    return "development";
  }

  resolveEmotionalGoal(stage, emotional_state) {
    if (stage === "opening") return "gentle curiosity";
    if (stage === "development") return "steady wonder";
    if (stage === "peak") return "warm bravery";
    return "soft serenity";
  }

  resolvePacingLevel(stage, pacing_state) {
    if (stage === "opening") return pacing_state.current_pacing_stage || "settling";
    if (stage === "development") return "steady";
    if (stage === "peak") return "elevated";
    return "gentle";
  }

  resolveSensoryFocus(index, sensory_targets) {
    const pool = [
      ...(sensory_targets.sound_targets || []),
      ...(sensory_targets.scent_targets || []),
      ...(sensory_targets.texture_targets || [])
    ];

    return pool.slice((index - 1) % pool.length, ((index - 1) % pool.length) + 2);
  }

  resolveBedtimeIntensity(index, totalScenes, bedtime_rules) {
    const base = bedtime_rules.softness ?? 0.75;
    return Number(Math.max(0, Math.min(1, base - (index - 1) * (0.2 / totalScenes))).toFixed(2));
  }

  resolveTransitionIntent(stage, pacing_state) {
    if (stage === "opening") return "ease-in";
    if (stage === "development") return "smooth-bridge";
    if (stage === "peak") return "soft-crest";
    return "slow-destination";
  }

  resolveSceneEndingMood(stage, emotional_state) {
    if (stage === "closing") return "restful";
    return emotional_state.bedtime_softness > 0.8 ? "warm" : "gentle";
  }

  buildSceneGoal(stage, story_dna) {
    const prompts = {
      opening: `Introduce the world with a warm, bedtime-safe scene focused on ${story_dna.theme}.`,
      development: `Develop the narrative with gentle emotional progression and sensory immersion.`,
      peak: `Introduce the main emotional beat with calm wonder and promise.`,
      closing: `Bring the story toward a soothing resolution and bedtime comfort.`
    };

    return prompts[stage] || prompts.development;
  }
}

export default ScenePlanner;
