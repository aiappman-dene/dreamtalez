/**
 * Context Compression Engine
 *
 * Reduces token waste and runtime latency by trimming the full runtime context
 * to the essential fields actually needed for story generation.
 *
 * The full context object can grow large with multi-phase engine data.
 * This engine extracts only what the prompt injection layer needs — cutting
 * token overhead without losing any emotional continuity signal.
 *
 * Returns a lean context safe to pass directly into prompt builders.
 */

/**
 * @param {object} runtimeContext - Full runtime context from orchestration layers
 * @returns {object} Compressed context — only fields that affect prompt output
 */
export function compressContext(runtimeContext) {
  if (!runtimeContext || typeof runtimeContext !== "object") return {};

  return {
    // Child identity — always required
    hero: runtimeContext.hero
      ? {
          name:       runtimeContext.hero.name,
          age:        runtimeContext.hero.age,
          interests:  runtimeContext.hero.interests,
          appearance: runtimeContext.hero.appearance,
        }
      : undefined,

    // Family Magic — top comfort anchors only (max 3)
    comfortAnchors: Array.isArray(runtimeContext.familyMagic?.comfortItems)
      ? runtimeContext.familyMagic.comfortItems.slice(0, 3)
      : undefined,

    // Bedtime atmosphere — single string or object
    bedtimeAtmosphere: runtimeContext.bedtimeAtmosphere
      ? (typeof runtimeContext.bedtimeAtmosphere === "string"
          ? runtimeContext.bedtimeAtmosphere
          : runtimeContext.bedtimeAtmosphere?.atmosphere || undefined)
      : undefined,

    // Pacing profile — label + key directive only
    pacing: runtimeContext.pacing
      ? {
          label:             runtimeContext.pacing.archetypeKey || runtimeContext.pacing.label,
          cadenceDirective:  runtimeContext.pacing.cadenceDirective,
          endingNote:        runtimeContext.pacing.endingNote,
        }
      : undefined,

    // Emotional goal — single string
    emotionalGoal: typeof runtimeContext.emotionalGoal === "string"
      ? runtimeContext.emotionalGoal
      : undefined,

    // Adaptive intelligence — compressed energy profile
    adaptiveEnergy: runtimeContext.adaptiveEnergy
      ? {
          calmLevel:       runtimeContext.adaptiveEnergy.calmLevel,
          wonderLevel:     runtimeContext.adaptiveEnergy.wonderLevel,
          excitementLevel: runtimeContext.adaptiveEnergy.excitementLevel,
          label:           runtimeContext.adaptiveEnergy.label,
        }
      : undefined,
  };
}

/**
 * Estimate token count for a context object (rough: 1 token ≈ 4 chars).
 * Used for logging — not for billing.
 *
 * @param {object} ctx
 * @returns {number}
 */
export function estimateContextTokens(ctx) {
  try {
    return Math.ceil(JSON.stringify(ctx).length / 4);
  } catch {
    return 0;
  }
}

export default compressContext;
