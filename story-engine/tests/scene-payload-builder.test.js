import { ScenePayloadBuilder } from "../orchestration/scene-payload-builder.js";
import { SonnetProductionWriter } from "../orchestration/sonnet-production-writer.js";

const builder = new ScenePayloadBuilder();
const writer = new SonnetProductionWriter();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function runTests() {
  console.log("[Test] Starting scene payload builder tests...");

  const runtime_context = {
    story_dna: {
      theme: "soft forest dreams",
      emotionalDestination: "calm",
      request_meta: { length: "medium" }
    },
    emotional_state: {
      wonder: 7,
      comfort_level: 8,
      nervousness: 2,
      trust_progression: 6,
      bedtime_softness: 8
    },
    pacing_state: {
      current_pacing_stage: "steady"
    },
    sensory_targets: {
      atmosphere: "warm lantern glow",
      sound_targets: ["soft rain tapping roof"],
      scent_targets: ["pine scent drifting indoors"],
      texture_targets: ["soft velvet blanket"]
    },
    continuity_state: {
      recurring_motifs: ["lantern warmth"],
      emotional_arc: { destination: "growing trust" }
    }
  };

  const scene_plan = [
    {
      scene_id: "scene_2",
      goal: "Build emotional trust between owl and fox",
      emotion: "steady wonder",
      pacing: "slow",
      sensory_focus: ["soft rain tapping roof", "warm lantern glow"],
      bedtime_intensity: 0.2,
      transitionIntent: "ease-in"
    }
  ];

  const payloadResult = builder.buildScenePayloads({ scene_plan, runtime_context, scene_memory: {} });
  assert(payloadResult.scene_payloads.length === 1, "Expected one scene payload");

  const payload = payloadResult.scene_payloads[0];
  assert(payload.scene_id === "scene_2", "scene_id should be preserved");
  assert(payload.emotional_state.wonder === 7, "wonder should map to emotional_state");
  assert(payload.pacing.cadence === "slow", "cadence should be set from scene pacing");
  assert(payload.sensory_targets.includes("soft rain tapping roof"), "sensory targets should include scene focus");
  assert(payload.prose_constraints.cinematic_prose === true, "prose constraints should enable cinematic prose");

  const productionResult = writer.buildProductionPayloads(payloadResult.scene_payloads);
  assert(productionResult.sonnet_payloads.length === 1, "Expected one Sonnet payload");
  assert(productionResult.sonnet_payloads[0].payload.scene_id === "scene_2", "Sonnet payload should preserve scene_id");
  assert(productionResult.sonnet_payloads[0].behavior.mode === "renderer", "Sonnet writer must set renderer mode");

  console.log("[Test] Scene payload builder tests passed.");
}

runTests();
