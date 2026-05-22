/**
 * Memory Orchestrator
 *
 * Builds recurring character and continuity state to prevent drift.
 */

export class MemoryOrchestrator {
  constructor(options = {}) {
    this.options = options;
  }

  compileCharacterMemory({ request, storyDNA, previousContext = {} }) {
    const childProfile = {
      name: request.childName,
      age: request.childAge,
      gender: request.childGender,
      favoriteThings: request.preferences?.favoriteThings || [],
      comfortHabits: request.preferences?.comfortHabits || []
    };

    return {
      child_profile: childProfile,
      recurring_behaviors: this.buildRecurringBehaviors(request.preferences),
      emotional_triggers: this.buildEmotionalTriggers(request.preferences),
      relationship_progression: this.buildRelationshipProgression(previousContext.character_memory),
      speech_patterns: this.buildSpeechPatterns(request.preferences),
      comfort_habits: childProfile.comfortHabits,
      recurring_motifs: this.buildRecurringMotifs(storyDNA)
    };
  }

  buildRecurringBehaviors(preferences = {}) {
    const behaviors = [
      "tucks in their favorite toy",
      "pauses to notice the stars",
      "speaks kindly to friends"
    ];
    if (preferences?.favoriteAnimal) {
      behaviors.unshift(`notices the gentle ${preferences.favoriteAnimal}`);
    }
    return behaviors;
  }

  buildEmotionalTriggers(preferences = {}) {
    const triggers = [
      "a comforting hug",
      "a soft glow",
      "a reassuring voice"
    ];
    if (preferences?.safePlace) {
      triggers.push(`the warmth of ${preferences.safePlace}`);
    }
    return triggers;
  }

  buildRelationshipProgression(previousMemory = {}) {
    const previousStage = previousMemory?.relationship_progression || "beginning";
    const nextStage = previousStage === "beginning" ? "deepening" : "deepening";
    return {
      previous_stage: previousStage,
      current_stage: nextStage,
      notes: [
        "Emotional closeness grows gradually",
        "Support is offered through dialogue",
        "Comfort appears in small, reliable ways"
      ]
    };
  }

  buildSpeechPatterns(preferences = {}) {
    const basePatterns = [
      "gentle cadence",
      "warm, comforting tone",
      "simple, clear phrasing"
    ];

    if (preferences?.languageStyle === "poetic") {
      basePatterns.push("softly lyrical turns of phrase");
    }

    return basePatterns;
  }

  buildRecurringMotifs(storyDNA) {
    return [
      storyDNA.theme,
      storyDNA.moral,
      "moonlight comfort",
      "soft footsteps",
      "relaxed wonder"
    ].filter(Boolean);
  }
}

export default MemoryOrchestrator;
