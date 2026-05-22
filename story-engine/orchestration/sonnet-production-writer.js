/**
 * Sonnet Production Writer
 *
 * Takes validated scene payloads and produces deterministic renderer payloads for Sonnet.
 * Sonnet is treated as a scene renderer and prose performer, not as the planner.
 */

export class SonnetProductionWriter {
  constructor(options = {}) {
    this.options = options;
  }

  buildProductionPayloads(scene_payloads = [], runtime_context = {}) {
    const productionPayloads = scene_payloads.map((payload) => ({
      scene_id: payload.scene_id,
      renderer: "sonnet",
      role: "cinematic_narrator",
      behavior: {
        mode: "renderer",
        avoid: [
          "planning",
          "raw user requests",
          "re-architecting the story",
          "emotional orchestration"
        ],
        emphasize: [
          "calming imagery",
          "sensory immersion",
          "bedtime safety",
          "gentle pacing"
        ]
      },
      payload,
      metadata: {
        createdAt: new Date().toISOString(),
        source: "sonnet-production-writer"
      }
    }));

    return {
      sonnet_payloads: productionPayloads,
      count: productionPayloads.length,
      runtime_context
    };
  }
}

export default SonnetProductionWriter;
