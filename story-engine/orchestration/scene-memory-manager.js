/**
 * Scene Memory Manager
 *
 * Tracks recurring motifs, emotional callbacks, and narrative continuity.
 */

export class SceneMemoryManager {
  constructor(options = {}) {
    this.options = options;
    this.memory = {
      recurring_motifs: [],
      emotional_callbacks: [],
      object_continuity: [],
      relationship_progression: [],
      comfort_imagery: []
    };
  }

  updateMemory({ scenes = [], previousMemory = {} }) {
    this.memory = {
      recurring_motifs: this.mergeLists(previousMemory.recurring_motifs, this.extractMotifs(scenes)),
      emotional_callbacks: this.mergeLists(previousMemory.emotional_callbacks, this.extractEmotionalCallbacks(scenes)),
      object_continuity: this.mergeLists(previousMemory.object_continuity, this.extractObjectContinuity(scenes)),
      relationship_progression: this.mergeLists(previousMemory.relationship_progression, this.extractRelationshipProgression(scenes)),
      comfort_imagery: this.mergeLists(previousMemory.comfort_imagery, this.extractComfortImagery(scenes))
    };

    return {
      scene_memory: this.memory,
      snapshot: this.createSnapshot()
    };
  }

  mergeLists(previous = [], next = []) {
    return Array.from(new Set([...(previous || []), ...(next || [])]));
  }

  extractMotifs(scenes) {
    return scenes.flatMap((scene) => scene.sensory_focus || []).slice(0, 5);
  }

  extractEmotionalCallbacks(scenes) {
    return scenes.map((scene) => `${scene.scene_id}:${scene.emotion}`).slice(0, 4);
  }

  extractObjectContinuity(scenes) {
    return scenes.flatMap((scene) => scene.sensory_focus || []).filter(Boolean).slice(0, 5);
  }

  extractRelationshipProgression(scenes) {
    return scenes.map((scene) => `${scene.scene_id}:${scene.pacing}`).slice(0, 4);
  }

  extractComfortImagery(scenes) {
    return scenes.flatMap((scene) => scene.sensory_focus || []).filter((item) => item.includes("soft") || item.includes("warm")).slice(0, 4);
  }

  createSnapshot() {
    return {
      summary: {
        motifs: this.memory.recurring_motifs,
        warmth: this.memory.comfort_imagery,
        relationships: this.memory.relationship_progression
      },
      updatedAt: new Date().toISOString()
    };
  }
}

export default SceneMemoryManager;
