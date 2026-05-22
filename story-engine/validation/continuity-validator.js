/**
 * Continuity Validator
 *
 * Tracks character names, recurring motifs, and the recurring_motif declared
 * in the payload. Detects:
 *  - characters introduced then dropped without resolution
 *  - motif drift (declared motif never appears)
 *  - pronoun-only character drift (no name anchors across scenes)
 *
 * Pure inspection. No prose mutation. No model calls.
 *
 * Note: relies on payload.continuity_state and an optional
 * `context.characters` list (provided by the orchestrator's character bible).
 */

import { tokenize, buildResult, flag } from "./validator-utils.js";

export class ContinuityValidator {
  constructor(config = {}) {
    this.maxScenesWithoutAnchor = config.maxScenesWithoutAnchor ?? 1;
    this.sceneThreshold = config.thresholds?.scene ?? 80;
    this.storyThreshold = config.thresholds?.story ?? 82;
  }

  validateScene(sceneText, scenePayload = {}, context = {}) {
    const flags = [];
    const lowerText = sceneText.toLowerCase();
    const tokens = tokenize(sceneText);

    const declaredMotif = scenePayload?.continuity_state?.recurring_motif;
    const motifPresent = declaredMotif
      ? lowerText.includes(String(declaredMotif).toLowerCase())
      : null;

    const characters = collectCharacters(scenePayload, context);
    const characterMatches = characters.map((c) => ({
      name: c.name,
      mentioned: lowerText.includes(c.name.toLowerCase()),
      tokenHits: countOccurrences(tokens, c.name.toLowerCase())
    }));

    const protagonist = characters.find((c) => c.role === "protagonist") || characters[0];
    if (protagonist) {
      const match = characterMatches.find((m) => m.name === protagonist.name);
      if (!match || !match.mentioned) {
        flags.push(
          flag(
            "protagonist_unnamed",
            "medium",
            `protagonist "${protagonist.name}" not named in scene`,
            "Anchor the scene with the protagonist's name at least once."
          )
        );
      }
    }

    if (declaredMotif && motifPresent === false) {
      flags.push(
        flag(
          "motif_missing",
          "low",
          `declared motif "${declaredMotif}" not present in scene`,
          "Weave the recurring motif into the scene to maintain continuity."
        )
      );
    }

    let score = 100;
    if (flags.find((f) => f.type === "protagonist_unnamed")) score -= 18;
    if (flags.find((f) => f.type === "motif_missing")) score -= 8;

    return buildResult({
      validator: "continuity",
      level: "scene",
      score,
      threshold: this.sceneThreshold,
      flags,
      metrics: {
        declaredMotif: declaredMotif || null,
        motifPresent,
        characterMatches
      }
    });
  }

  validateStory(scenes = [], storyContext = {}) {
    const flags = [];
    const sceneTexts = scenes.map((s) => (typeof s === "string" ? s : s.text || ""));
    const characters = collectCharacters(null, storyContext);

    // Per-character: how many scenes mention them, and longest gap.
    const charStats = characters.map((c) => {
      const scenesMentioned = sceneTexts.map((t) => t.toLowerCase().includes(c.name.toLowerCase()));
      const presentIn = scenesMentioned.reduce((acc, v, i) => (v ? [...acc, i] : acc), []);
      let longestGap = 0;
      for (let i = 1; i < presentIn.length; i += 1) {
        longestGap = Math.max(longestGap, presentIn[i] - presentIn[i - 1] - 1);
      }
      return {
        name: c.name,
        role: c.role || "supporting",
        sceneCount: presentIn.length,
        firstAppearance: presentIn[0] ?? -1,
        lastAppearance: presentIn[presentIn.length - 1] ?? -1,
        longestGap
      };
    });

    const protagonist = charStats.find((s) => s.role === "protagonist") || charStats[0];
    if (protagonist && protagonist.sceneCount < Math.ceil(sceneTexts.length * 0.7)) {
      flags.push(
        flag(
          "protagonist_underpresent",
          "medium",
          `protagonist "${protagonist.name}" named in only ${protagonist.sceneCount}/${sceneTexts.length} scenes`,
          "Anchor the protagonist by name in most scenes; pronouns alone drift."
        )
      );
    }

    for (const c of charStats) {
      if (c.longestGap > this.maxScenesWithoutAnchor && c.sceneCount > 0) {
        flags.push(
          flag(
            "character_gap",
            c.longestGap > 2 ? "medium" : "low",
            `"${c.name}" missing for ${c.longestGap} consecutive scenes`,
            "Acknowledge characters across scenes, even briefly, to maintain presence."
          )
        );
      }
      if (c.sceneCount === 1 && sceneTexts.length >= 3 && c.role !== "supporting") {
        flags.push(
          flag(
            "introduced_then_dropped",
            "low",
            `"${c.name}" appears only in scene ${c.firstAppearance}`,
            "Either bring the character back, or fold the role into someone present."
          )
        );
      }
    }

    // Motif continuity at story level — if storyContext lists a recurring motif, it should appear in 60%+ of scenes.
    const storyMotif = storyContext?.continuity_state?.recurring_motifs?.[0];
    let motifSceneShare = null;
    if (storyMotif && sceneTexts.length) {
      const hits = sceneTexts.filter((t) => t.toLowerCase().includes(String(storyMotif).toLowerCase())).length;
      motifSceneShare = hits / sceneTexts.length;
      if (motifSceneShare < 0.5) {
        flags.push(
          flag(
            "motif_underused",
            motifSceneShare < 0.25 ? "medium" : "low",
            `motif "${storyMotif}" appears in ${(motifSceneShare * 100).toFixed(0)}% of scenes`,
            "Surface the recurring motif more consistently to bind scenes together."
          )
        );
      }
    }

    let score = 100;
    if (flags.find((f) => f.type === "protagonist_underpresent")) score -= 18;
    score -= Math.min(15, flags.filter((f) => f.type === "character_gap").length * 5);
    score -= Math.min(8, flags.filter((f) => f.type === "introduced_then_dropped").length * 4);
    if (flags.find((f) => f.type === "motif_underused")) score -= 8;

    return buildResult({
      validator: "continuity",
      level: "story",
      score,
      threshold: this.storyThreshold,
      flags,
      metrics: {
        sceneCount: sceneTexts.length,
        characters: charStats,
        storyMotif: storyMotif || null,
        motifSceneShare: motifSceneShare === null ? null : Number(motifSceneShare.toFixed(2))
      }
    });
  }
}

function collectCharacters(scenePayload, context) {
  // Prefer explicit character list on context (orchestrator-supplied character bible).
  const fromContext = Array.isArray(context?.characters) ? context.characters : null;
  if (fromContext && fromContext.length) {
    return fromContext.map((c) => normalize(c));
  }
  const fromPayload = Array.isArray(scenePayload?.characters) ? scenePayload.characters : [];
  return fromPayload.map((c) => normalize(c));
}

function normalize(c) {
  if (typeof c === "string") return { name: c, role: "supporting" };
  return { name: c.name || "", role: c.role || "supporting" };
}

function countOccurrences(tokens, lowerName) {
  if (!lowerName) return 0;
  let n = 0;
  for (const t of tokens) if (t === lowerName) n += 1;
  return n;
}

export default ContinuityValidator;
