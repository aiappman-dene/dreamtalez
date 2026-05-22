/**
 * Comfort Reinforcement Engine
 *
 * Extracts high-priority comfort anchors from a continuity memory object
 * and returns ranked injection instructions for the story prompt.
 *
 * Comfort anchors are specific items, people, and places that carry the
 * child's safety — repeating them in story is neurologically calming.
 *
 * Returns { anchors, promptBlock }
 */

/**
 * @param {{ continuityMemory?: object }} opts
 *   continuityMemory shape: {
 *     comfortItems?: string[],
 *     familyMembers?: Array<{ relationship: string, name?: string }>,
 *     favoriteMagicalPlace?: string,
 *     favoriteCozyFeeling?: string,
 *   }
 * @returns {{ anchors: string[], promptBlock: string }}
 */
export function prioritizeComfortAnchors({ continuityMemory } = {}) {
  const mem = continuityMemory || {};
  const anchors = [];

  // Priority 1: physical comfort items (most grounding)
  const items = Array.isArray(mem.comfortItems) ? mem.comfortItems : [];
  items.slice(0, 2).forEach((item) => {
    if (item && typeof item === "string") anchors.push(`comfort item: "${item.slice(0, 60)}"`);
  });

  // Priority 2: family members (social safety)
  const members = Array.isArray(mem.familyMembers) ? mem.familyMembers : [];
  members.slice(0, 2).forEach((m) => {
    if (m && m.relationship) {
      const label = m.name ? `${m.relationship} (${m.name})` : m.relationship;
      anchors.push(`family anchor: "${label.slice(0, 60)}"`);
    }
  });

  // Priority 3: magical place (imaginative safety)
  if (mem.favoriteMagicalPlace && typeof mem.favoriteMagicalPlace === "string") {
    anchors.push(`magical place: "${mem.favoriteMagicalPlace.slice(0, 80)}"`);
  }

  // Priority 4: cozy feeling (sensory safety)
  if (mem.favoriteCozyFeeling && typeof mem.favoriteCozyFeeling === "string") {
    anchors.push(`cozy feeling: "${mem.favoriteCozyFeeling.slice(0, 80)}"`);
  }

  if (anchors.length === 0) {
    return { anchors: [], promptBlock: "" };
  }

  const promptBlock = `COMFORT REINFORCEMENT (anchor these in the ending):
${anchors.map((a) => `- Include ${a} in the closing section to ground the child in safety.`).join("\n")}
At least one comfort anchor must appear in the final scene. Do not invent new comfort objects at the end — use only those listed above.`;

  return { anchors, promptBlock };
}

export default prioritizeComfortAnchors;
