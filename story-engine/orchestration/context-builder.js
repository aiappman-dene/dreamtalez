/**
 * Context Builder
 *
 * Builds the controlled runtime payload that Sonnet uses.
 * The result is a single runtime_context object.
 */

import EmotionalOrchestrator from "./emotional-orchestrator.js";
import PacingOrchestrator from "./pacing-orchestrator.js";
import MemoryOrchestrator from "./memory-orchestrator.js";

export class ContextBuilder {
  constructor(options = {}) {
    this.emotionalOrchestrator = new EmotionalOrchestrator(options);
    this.pacingOrchestrator = new PacingOrchestrator(options);
    this.memoryOrchestrator = new MemoryOrchestrator(options);
    this.options = options;
  }

  async buildRuntimeContext({ request, frameworks = {}, previousContext = {} } = {}) {
    const story_dna = this.buildStoryDNA(request, frameworks);
    const emotional_state = await this.emotionalOrchestrator.assembleEmotionalState({
      request,
      storyDNA: story_dna,
      previousContext
    });

    const pacing_state = this.pacingOrchestrator.buildPacingState({
      request,
      storyDNA: story_dna,
      previousContext
    });

    const character_memory = this.memoryOrchestrator.compileCharacterMemory({
      request,
      storyDNA: story_dna,
      previousContext
    });

    const sensory_targets = this.buildSensoryTargets(request, story_dna, frameworks);
    const scene_goal = this.buildSceneGoal(story_dna, emotional_state, pacing_state);
    const bedtime_rules = this.buildBedtimeRules(story_dna, request, frameworks);
    const continuity_state = this.buildContinuityState(previousContext);

    return {
      runtime_context: {
        story_dna,
        scene_goal,
        emotional_state,
        bedtime_rules,
        pacing_state,
        character_memory,
        sensory_targets,
        continuity_state
      }
    };
  }

  buildStoryDNA(request, frameworks) {
    const bedtimeIntensity = this.resolveBedtimeIntensity(request.length, request.preferences);
    const emotionalDestination = this.resolveEmotionalDestination(request.theme, request.preferences);
    const pacingProfile = this.buildPacingProfile(request.length, request.preferences);
    const sensoryProfile = this.buildSensoryProfile(request.preferences);

    return {
      story_id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      theme: request.theme || "comfort",
      moral: request.preferences?.moral || this.inferMoralFromTheme(request.theme),
      bedtimeIntensity,
      emotionalDestination,
      pacingProfile,
      sensoryProfile,
      characterFocus: request.preferences?.characterFocus || "child-centered",
      constraints: request.preferences?.constraints || ["bedtime_safe", "positive_resolution", "age_appropriate"],
      request_meta: {
        length: request.length || "medium",
        mode: request.mode || "adventure",
        language: request.preferences?.language || "en"
      },
      frameworks: {
        narrative: frameworks.narrative ?? {},
        scene: frameworks.scene ?? {},
        character: frameworks.character ?? {},
        refinement: frameworks.refinement ?? {}
      }
    };
  }

  resolveBedtimeIntensity(length = "medium", preferences = {}) {
    const base = length === "long" ? 0.75 : length === "short" ? 0.45 : 0.6;
    return Number(Math.max(0, Math.min(1, base + (preferences?.bedtimeSoftness ? 0.1 : 0) - (preferences?.excitementLevel || 0) * 0.1)).toFixed(2));
  }

  resolveEmotionalDestination(theme = "comfort", preferences = {}) {
    if (preferences?.emotionalGoal) return preferences.emotionalGoal;
    if (theme === "comfort") return "calm";
    if (theme === "adventure") return "courage";
    if (theme === "emotional") return "understanding";
    return "peace";
  }

  buildPacingProfile(length = "medium", preferences = {}) {
    return {
      length,
      targetSceneCount: length === "long" ? 7 : length === "short" ? 3 : 5,
      tempo: preferences?.pace === "slow" ? "slow" : preferences?.pace === "fast" ? "dynamic" : "steady"
    };
  }

  buildSensoryProfile(preferences = {}) {
    return {
      visual: preferences?.visualFocus ? true : true,
      auditory: preferences?.auditoryFocus ?? true,
      tactile: preferences?.tactileFocus ?? false,
      olfactory: preferences?.olfactoryFocus ?? false,
      atmosphere: preferences?.atmosphere || "gentle glow"
    };
  }

  inferMoralFromTheme(theme = "comfort") {
    const map = {
      comfort: "There is safety in kindness",
      adventure: "Bravery can feel calm from within",
      emotional: "Feelings are a gentle guide",
      discovery: "Wonder can be quiet and warm",
      magical: "Magic is found in small, steady moments"
    };
    return map[theme] || "Being kind helps you rest easier";
  }

  buildSceneGoal(story_dna, emotional_state, pacing_state) {
    return {
      target: `Create a calming bedtime scene with ${story_dna.theme} energy`,
      emotionalAnchor: emotional_state.emotional_destination,
      pacingIntent: pacing_state.current_pacing_stage,
      sensoryIntent: story_dna.sensoryProfile.atmosphere,
      endingEnergy: emotional_state.bedtime_softness > 0.8 ? "soft" : "gentle"
    };
  }

  buildBedtimeRules(story_dna, request, frameworks) {
    return {
      avoid: ["sudden scares", "harsh conflict", "loud action"],
      require: ["safe closure", "calming imagery", "positive warmth"],
      softness: story_dna.bedtimeIntensity,
      sleepCue: request.preferences?.sleepCue || "starry night",
      allowedTone: frameworks.refinement?.bedtime ? "softly lyrical" : "gentle"
    };
  }

  buildSensoryTargets(request, story_dna, frameworks) {
    return {
      sound_targets: this.resolveSoundTargets(request.preferences, story_dna.theme),
      scent_targets: this.resolveScentTargets(request.preferences),
      texture_targets: this.resolveTextureTargets(request.preferences),
      atmosphere: story_dna.sensoryProfile.atmosphere,
      comfortCues: this.resolveComfortCues(request.preferences)
    };
  }

  resolveSoundTargets(preferences = {}, theme = "comfort") {
    const sounds = ["whispering leaves", "soft twinkling bells"];
    if (theme === "adventure") sounds.push("gentle footsteps");
    if (preferences?.favoriteSound) sounds.unshift(preferences.favoriteSound);
    return sounds;
  }

  resolveScentTargets(preferences = {}) {
    const scents = ["warm cinnamon", "fresh pine"];
    if (preferences?.favoriteSmell) scents.unshift(preferences.favoriteSmell);
    return scents;
  }

  resolveTextureTargets(preferences = {}) {
    const textures = ["soft blanket", "velvet night air"];
    if (preferences?.favoriteTexture) textures.unshift(preferences.favoriteTexture);
    return textures;
  }

  resolveComfortCues(preferences = {}) {
    return preferences?.comfortCues || ["glowing moonlight", "quiet heartbeat", "protective stars"];
  }

  buildContinuityState(previousContext = {}) {
    const distilledEmotionalArc = this.compressEmotionalHistory(previousContext.emotional_state);
    const distilledSceneHistory = this.compressSceneHistory(previousContext.continuity_state);

    return {
      last_scene_summary: previousContext.continuity_state?.last_scene_summary || "",
      emotional_arc: distilledEmotionalArc,
      recurring_motifs: previousContext.character_memory?.recurring_motifs || [],
      continuity_notes: previousContext.continuity_state?.continuity_notes || [],
      compressed_history: distilledSceneHistory
    };
  }

  compressEmotionalHistory(emotionalState = {}) {
    if (!emotionalState || !emotionalState.trust_progression) {
      return {
        trust_progression: 0.35,
        warmth: emotionalState.emotional_warmth || 0.7,
        destination: emotionalState.emotional_destination || "peace"
      };
    }

    return {
      trust_progression: emotionalState.trust_progression,
      warmth: emotionalState.emotional_warmth,
      current_mood: emotionalState.comfort_level,
      softness: emotionalState.bedtime_softness
    };
  }

  compressSceneHistory(continuityState = {}) {
    if (!continuityState || !continuityState.compressed_history) {
      return {
        recent_scenes: [],
        key_themes: [],
        emotional_trend: "steady"
      };
    }

    return {
      recent_scenes: continuityState.compressed_history?.recent_scenes ?? [],
      key_themes: continuityState.compressed_history?.key_themes ?? [],
      emotional_trend: continuityState.compressed_history?.emotional_trend ?? "steady"
    };
  }
}

export default ContextBuilder;
