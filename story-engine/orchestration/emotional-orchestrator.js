/**
 * Emotional Orchestrator
 *
 * Assembles runtime emotional state for each story.
 * This layer converts story intent into controlled emotional signals.
 */

export class EmotionalOrchestrator {
  constructor(options = {}) {
    this.options = options;
  }

  async assembleEmotionalState({ request, storyDNA, previousContext = {} }) {
    const baseMood = this.getBaseMood(request.theme, storyDNA.bedtimeIntensity);
    const trustProgression = this.buildTrustProgression(previousContext.emotional_state, request.preferences);

    return {
      current_wonder_level: this.calculateWonderLevel(request.theme, baseMood),
      comfort_level: this.calculateComfortLevel(request.preferences, baseMood),
      nervousness_level: this.calculateNervousnessLevel(request.theme, request.childAge),
      emotional_warmth: this.calculateEmotionalWarmth(request.preferences, baseMood),
      trust_progression: trustProgression,
      bedtime_softness: this.calculateBedtimeSoftness(storyDNA.bedtimeIntensity),
      emotional_destination: storyDNA.emotionalDestination,
      emotional_tags: this.buildEmotionalTags(request.theme, request.preferences)
    };
  }

  getBaseMood(theme, bedtimeIntensity) {
    const moodMap = {
      adventure: 0.65,
      comfort: 0.92,
      discovery: 0.78,
      emotional: 0.84,
      magical: 0.81
    };
    const base = moodMap[theme] ?? 0.80;
    return Math.max(0, Math.min(1, base - (bedtimeIntensity - 0.5) * 0.2));
  }

  calculateWonderLevel(theme, baseMood) {
    const wonderBase = theme === "magical" || theme === "adventure" ? 0.9 : 0.7;
    return Number((wonderBase * baseMood).toFixed(2));
  }

  calculateComfortLevel(preferences, baseMood) {
    const comfortBoost = preferences?.comfortFocus ? 0.15 : 0;
    return Number(Math.min(1, baseMood + comfortBoost).toFixed(2));
  }

  calculateNervousnessLevel(theme, childAge) {
    const ageFactor = childAge >= 8 ? 0.15 : 0.07;
    const themeFactor = theme === "adventure" ? 0.25 : theme === "emotional" ? 0.18 : 0.1;
    return Number(Math.max(0, Math.min(1, themeFactor * ageFactor + 0.05)).toFixed(2));
  }

  calculateEmotionalWarmth(preferences, baseMood) {
    const warmthBoost = preferences?.warmthPreference ? 0.12 : 0;
    return Number(Math.min(1, baseMood + warmthBoost).toFixed(2));
  }

  calculateBedtimeSoftness(bedtimeIntensity) {
    return Number(Math.max(0, Math.min(1, 1 - bedtimeIntensity * 0.5)).toFixed(2));
  }

  buildTrustProgression(previousEmotionalState = {}, preferences = {}) {
    const previousTrust = previousEmotionalState.trust_progression || 0.35;
    const trustBoost = preferences?.trustFocus ? 0.18 : 0.08;
    return Number(Math.min(1, previousTrust + trustBoost).toFixed(2));
  }

  buildEmotionalTags(theme, preferences) {
    const tags = [];
    if (theme === "comfort") tags.push("soothing", "safe", "home");
    if (theme === "adventure") tags.push("curious", "brave", "wonder");
    if (preferences?.focusOnFriendship) tags.push("friendship", "kindness");
    return tags;
  }
}

export default EmotionalOrchestrator;
