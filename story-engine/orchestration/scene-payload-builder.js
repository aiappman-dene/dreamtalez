/**
 * Scene Payload Builder
 *
 * Converts scene plans and runtime context into controlled Sonnet-ready payloads.
 * This module does not render prose; it ensures the renderer receives a deterministic payload.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { buildCozyCallbacks } from "./cozy-callback-engine.js";
import { balanceFamilyPresence, warmthGuidance } from "./family-warmth-balancer.js";
import { buildBedtimeAtmosphere } from "./bedtime-atmosphere-engine.js";

export class ScenePayloadBuilder {
  constructor(options = {}) {
    this.options = options;
    this.schema = this.loadSchema();
  }

  loadSchema() {
    const currentFile = fileURLToPath(import.meta.url);
    const schemaPath = resolve(dirname(currentFile), "../schemas/scene-runtime-schema.json");
    const file = readFileSync(schemaPath, "utf-8");
    return JSON.parse(file);
  }

  buildScenePayloads({ scene_plan = [], runtime_context = {}, scene_memory = {} } = {}) {
    const scenePayloads = scene_plan.map((scene) => {
      const payload = {
        scene_id: scene.scene_id,
        narrative_goal: scene.goal,
        emotional_state: this.buildEmotionalState(scene, runtime_context),
        pacing: this.buildPacing(scene, runtime_context),
        sensory_targets: this.buildSensoryTargets(scene, runtime_context),
        prose_constraints: this.buildProseConstraints(runtime_context),
        continuity_state: this.buildContinuityState(scene, runtime_context, scene_memory),
        metadata: {
          source: "scene-payload-builder",
          generatedAt: new Date().toISOString()
        },
        scene_objectives: this.buildSceneObjectives(scene, runtime_context)
      };

      this.validatePayload(payload);
      return payload;
    });

    return {
      scene_payloads: scenePayloads,
      runtime_context,
      scene_memory
    };
  }

  buildEmotionalState(scene, runtime_context) {
    const base = runtime_context.emotional_state || {};
    return {
      wonder: this.normalizeScore(base.wonder ?? 6),
      comfort: this.normalizeScore(base.comfort_level ?? 7),
      nervousness: this.normalizeScore(base.nervousness ?? 2),
      trust: this.normalizeScore(base.trust_progression ?? 5),
      softness: this.normalizeScore(base.bedtime_softness ?? 7)
    };
  }

  buildPacing(scene, runtime_context) {
    const scenePacing = scene.pacing || {};
    const cadence = typeof scenePacing === "string" ? scenePacing : scenePacing?.cadence || "steady";
    const energy = this.normalizeEnergy(cadence, scenePacing?.energy);
    const bedtimeIntensity = Number((scene.bedtime_intensity * 10).toFixed(0));

    return {
      cadence,
      energy,
      bedtime_intensity: bedtimeIntensity,
      notes: scene.transitionIntent || "maintain a gentle flow"
    };
  }

  buildSensoryTargets(scene, runtime_context) {
    const baseTargets = Array.isArray(scene.sensory_focus) ? scene.sensory_focus : [];
    const runtimeTargets = runtime_context.sensory_targets || {};
    const extras = [
      runtimeTargets.atmosphere,
      ...(runtimeTargets.sound_targets || []),
      ...(runtimeTargets.scent_targets || []),
      ...(runtimeTargets.texture_targets || [])
    ].filter(Boolean);

    return Array.from(new Set([...baseTargets, ...extras]));
  }

  buildProseConstraints(runtime_context) {
    const constraints = {
      show_dont_tell: true,
      cinematic_prose: true,
      calming_language_bias: true,
      limit_wordiness: runtime_context.story_dna?.request_meta?.length !== "long",
      avoid_cliffhangers: true
    };

    return constraints;
  }

  buildContinuityState(scene, runtime_context, scene_memory) {
    const recurringMotif = runtime_context.continuity_state?.recurring_motifs?.[0] || "gentle light";
    const relationshipProgress = runtime_context.continuity_state?.emotional_arc?.destination || "growing trust";
    const sceneHistory = (scene_memory.scene_memory?.recurring_motifs || []).slice(0, 3).map((item) => `${item}`);

    return {
      recurring_motif: recurringMotif,
      relationship_progress: relationshipProgress,
      scene_history: sceneHistory
    };
  }

  buildFamilyMagicPayload(runtimeContext = {}) {
    const fm = runtimeContext.familyMagic || {};
    if (!fm.enabled) return null;

    return {
      familyMagic: {
        enabled:              true,
        familyMembers:        fm.familyMembers        || [],
        comfortItems:         fm.comfortItems         || [],
        favoriteCozyFeeling:  fm.favoriteCozyFeeling  || "",
        favoriteMagicalPlace: fm.favoriteMagicalPlace || "",
      },
      instructions: [
        "Child remains the hero — always",
        "Family members appear lightly and warmly, never as problem-solvers",
        "Weave in comfort items as recurring motifs",
        "Maintain bedtime-safe atmosphere and slow pacing",
      ],
    };
  }

  buildSceneObjectives(scene, runtime_context) {
    return [
      scene.goal,
      `Advance the emotional state toward ${runtime_context.story_dna?.emotionalDestination || "peace"}`,
      `Keep pacing aligned to bedtime intensity ${scene.bedtime_intensity}`
    ];
  }

  normalizeScore(value) {
    const normalized = Number(value ?? 5);
    return Math.max(0, Math.min(10, normalized));
  }

  normalizeEnergy(cadence, providedEnergy) {
    if (providedEnergy) return providedEnergy;
    if (cadence === "slow" || cadence === "gentle" || cadence === "settling") return "low";
    if (cadence === "elevated" || cadence === "dynamic") return "medium";
    return "low";
  }

  validatePayload(payload) {
    const schema = this.schema;

    if (typeof payload !== "object" || payload === null) {
      throw new Error("Scene payload must be an object.");
    }

    const requiredKeys = schema.required || [];
    for (const key of requiredKeys) {
      if (!(key in payload)) {
        throw new Error(`Scene payload is missing required key: ${key}`);
      }
    }

    if (typeof payload.scene_id !== "string") {
      throw new Error("scene_id must be a string.");
    }

    if (typeof payload.narrative_goal !== "string") {
      throw new Error("narrative_goal must be a string.");
    }

    const emotional = payload.emotional_state;
    if (typeof emotional !== "object" || emotional === null) {
      throw new Error("emotional_state must be an object.");
    }

    ["wonder", "comfort", "nervousness"].forEach((field) => {
      if (typeof emotional[field] !== "number") {
        throw new Error(`emotional_state.${field} must be a number.`);
      }
    });

    const pacing = payload.pacing;
    if (typeof pacing !== "object" || pacing === null) {
      throw new Error("pacing must be an object.");
    }

    ["cadence", "energy"].forEach((field) => {
      if (typeof pacing[field] !== "string") {
        throw new Error(`pacing.${field} must be a string.`);
      }
    });

    if (typeof pacing.bedtime_intensity !== "number") {
      throw new Error("pacing.bedtime_intensity must be a number.");
    }

    if (!Array.isArray(payload.sensory_targets) || payload.sensory_targets.length === 0) {
      throw new Error("sensory_targets must be a non-empty array.");
    }

    const prose = payload.prose_constraints;
    if (typeof prose !== "object" || prose === null) {
      throw new Error("prose_constraints must be an object.");
    }

    ["show_dont_tell", "cinematic_prose", "calming_language_bias"].forEach((field) => {
      if (typeof prose[field] !== "boolean") {
        throw new Error(`prose_constraints.${field} must be boolean.`);
      }
    });

    const continuity = payload.continuity_state;
    if (typeof continuity !== "object" || continuity === null) {
      throw new Error("continuity_state must be an object.");
    }

    ["recurring_motif", "relationship_progress"].forEach((field) => {
      if (typeof continuity[field] !== "string") {
        throw new Error(`continuity_state.${field} must be a string.`);
      }
    });

    return true;
  }
}

/**
 * Inject Family Magic continuity data into a scene payload.
 * Called once per story (not per scene) to augment the runtime context
 * that flows into buildScenePayloads.
 */
export function injectFamilyMagicContinuity({ runtimeContext, continuityMemory }) {
  const cozyCallbacks = buildCozyCallbacks({ runtimeContext, continuityMemory });

  const sceneStages = ["opening", "adventure", "emotional-moment", "ending"];
  const warmthByStage = Object.fromEntries(
    sceneStages.map((stage) => {
      const level = balanceFamilyPresence({ sceneStage: stage });
      return [stage, { level, guidance: warmthGuidance(level) }];
    })
  );

  const atmosphere = buildBedtimeAtmosphere();

  return {
    recurringComfort:  continuityMemory?.getContinuityContext() ?? {},
    cozyCallbacks,
    warmthByStage,
    atmosphere,
    familyMagicInstructions: [
      "Keep family warmth subtle — background love, not foreground presence",
      "Child remains the hero at every stage",
      "Reuse comfort items naturally, maximum twice per story",
      "Maintain emotional softness and decelerating pacing toward the ending",
    ],
  };
}

export default ScenePayloadBuilder;
