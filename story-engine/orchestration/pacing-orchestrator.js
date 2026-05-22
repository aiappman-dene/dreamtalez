/**
 * Pacing Orchestrator
 *
 * Builds runtime pacing state that controls scene intensity and narrative cadence.
 */

export class PacingOrchestrator {
  constructor(options = {}) {
    this.options = options;
  }

  buildPacingState({ request, storyDNA, previousContext = {} }) {
    const lengthProfile = this.getLengthProfile(request.length);
    const bedtimeCurve = this.getBedtimeCurve(storyDNA.bedtimeIntensity);
    const sceneCount = storyDNA.pacingProfile?.sceneCount ?? lengthProfile.sceneCount;

    return {
      current_pacing_stage: this.resolvePacingStage(previousContext.pacing_state, lengthProfile),
      scene_energy: this.calculateSceneEnergy(storyDNA.emotionalDestination, bedtimeCurve),
      narrative_intensity: this.calculateNarrativeIntensity(storyDNA.theme, bedtimeCurve),
      cadence_profile: this.buildCadenceProfile(lengthProfile, bedtimeCurve),
      sentence_softness: this.computeSentenceSoftness(bedtimeCurve),
      scene_count: sceneCount,
      pacing_hint: bedtimeCurve === "soft" ? "slow and gentle" : "steady and warm"
    };
  }

  getLengthProfile(length = "medium") {
    const map = {
      short: { sceneCount: 3, tempo: "gentle", targetDuration: 5 },
      medium: { sceneCount: 5, tempo: "moderate", targetDuration: 8 },
      long: { sceneCount: 7, tempo: "measured", targetDuration: 12 }
    };
    return map[length] ?? map.medium;
  }

  getBedtimeCurve(bedtimeIntensity = 0.5) {
    if (bedtimeIntensity >= 0.85) return "soft";
    if (bedtimeIntensity >= 0.6) return "gentle";
    return "balanced";
  }

  resolvePacingStage(previousPacingState = {}, lengthProfile) {
    if (!previousPacingState.current_pacing_stage) {
      return lengthProfile.tempo === "gentle" ? "settling" : "building";
    }
    return previousPacingState.current_pacing_stage === "peak" ? "resolution" : "building";
  }

  calculateSceneEnergy(emotionalDestination, bedtimeCurve) {
    const base = emotionalDestination === "calm" ? 0.35 : 0.55;
    const softness = bedtimeCurve === "soft" ? 0.5 : bedtimeCurve === "gentle" ? 0.7 : 0.85;
    return Number(Math.min(1, base * softness).toFixed(2));
  }

  calculateNarrativeIntensity(theme, bedtimeCurve) {
    const themeFactor = theme === "adventure" ? 0.85 : theme === "comfort" ? 0.6 : 0.7;
    const curveModifier = bedtimeCurve === "soft" ? 0.7 : bedtimeCurve === "gentle" ? 0.85 : 1.0;
    return Number(Math.min(1, themeFactor * curveModifier).toFixed(2));
  }

  buildCadenceProfile(lengthProfile, bedtimeCurve) {
    return {
      tempo: lengthProfile.tempo,
      sceneShape: bedtimeCurve === "soft" ? "slow-rise-gentle-fall" : "steady-arc",
      transitionWeight: bedtimeCurve === "soft" ? "high" : "medium"
    };
  }

  computeSentenceSoftness(bedtimeCurve) {
    return bedtimeCurve === "soft" ? 0.92 : bedtimeCurve === "gentle" ? 0.82 : 0.74;
  }
}

export default PacingOrchestrator;
