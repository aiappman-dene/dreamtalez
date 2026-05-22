/**
 * Pacing Validator
 *
 * Inspects:
 *  - sentence-length variance and average per scene
 *  - action-verb density vs payload's pacing.energy
 *  - scene-to-scene energy curve (must descend toward the ending)
 *
 * Pure inspection. No prose mutation. No model calls.
 */

import { splitSentences, tokenize, buildResult, flag } from "./validator-utils.js";

const ACTION_VERBS = new Set([
  "ran", "running", "rushed", "raced", "raced", "leapt", "jumped",
  "dashed", "sprinted", "spun", "shoved", "grabbed", "snatched",
  "burst", "slammed", "tumbled", "darted"
]);

const ENERGY_TARGETS = {
  // Target action density (action verbs per word) by payload energy label.
  low: 0.005,
  medium: 0.012,
  high: 0.022
};

export class PacingValidator {
  constructor(config = {}) {
    this.maxAvgWordsPerSentence = config.maxAvgWordsPerSentence ?? 22;
    this.minAvgWordsPerSentence = config.minAvgWordsPerSentence ?? 7;
    this.maxClosingActionDensity = config.maxClosingActionDensity ?? 0.006;
    this.sceneThreshold = config.thresholds?.scene ?? 78;
    this.storyThreshold = config.thresholds?.story ?? 80;
  }

  validateScene(sceneText, scenePayload = {}, context = {}) {
    const sentences = splitSentences(sceneText);
    const tokens = tokenize(sceneText);
    const flags = [];

    const lengths = sentences.map((s) => tokenize(s).length);
    const avg = mean(lengths);
    const variance = stdev(lengths);
    const wc = tokens.length || 1;

    let actionCount = 0;
    for (const t of tokens) if (ACTION_VERBS.has(t)) actionCount += 1;
    const actionDensity = actionCount / wc;

    const energyLabel = scenePayload?.pacing?.energy || "low";
    const targetDensity = ENERGY_TARGETS[energyLabel] ?? ENERGY_TARGETS.low;
    const tolerance = Math.max(0.004, targetDensity * 0.6);

    if (actionDensity > targetDensity + tolerance) {
      flags.push(
        flag(
          "pacing_overdrive",
          actionDensity > targetDensity * 2 ? "high" : "medium",
          `action density ${actionDensity.toFixed(3)} above target ${targetDensity.toFixed(3)} (energy=${energyLabel})`,
          "Slow the verbs; trade action for observation and breath."
        )
      );
    }

    if (avg > this.maxAvgWordsPerSentence) {
      flags.push(
        flag(
          "long_sentences",
          avg > this.maxAvgWordsPerSentence + 6 ? "medium" : "low",
          `avg ${avg.toFixed(1)} words/sentence`,
          "Break long sentences with a softer beat; bedtime needs room to breathe."
        )
      );
    } else if (avg < this.minAvgWordsPerSentence) {
      flags.push(
        flag(
          "choppy_sentences",
          "low",
          `avg ${avg.toFixed(1)} words/sentence is staccato`,
          "Lengthen a few sentences to restore flow."
        )
      );
    }

    if (variance > 14) {
      flags.push(
        flag(
          "uneven_rhythm",
          "low",
          `sentence-length stdev ${variance.toFixed(1)}`,
          "Smooth pacing — interleave shorter sentences with mid-length ones."
        )
      );
    }

    // Closing-scene specific check.
    const isClosing = Boolean(scenePayload?.metadata?.isClosingScene || context?.isClosingScene);
    if (isClosing && actionDensity > this.maxClosingActionDensity) {
      flags.push(
        flag(
          "ending_acceleration",
          "high",
          `closing scene action density ${actionDensity.toFixed(3)} > ${this.maxClosingActionDensity}`,
          "Closing scene must settle; trade motion for stillness — a held breath, a soft glow."
        )
      );
    }

    // Intra-scene settling: even within the closing scene, the second half
    // should be calmer than the first. The story should be tucking itself in.
    let intraSceneDelta = 0;
    if (isClosing && sentences.length >= 4) {
      const halves = splitInHalves(sentences);
      const firstDensity  = actionDensityOf(halves.first);
      const secondDensity = actionDensityOf(halves.second);
      intraSceneDelta = secondDensity - firstDensity;
      if (intraSceneDelta > 0.004) {
        flags.push(
          flag(
            "intra_scene_acceleration",
            intraSceneDelta > 0.010 ? "medium" : "low",
            `closing scene's second half is busier than its first (Δ=${intraSceneDelta.toFixed(3)})`,
            "Let the scene wind down — softer, slower verbs as the story settles."
          )
        );
      }
    }

    let score = 100;
    score -= clampPenalty((actionDensity - targetDensity - tolerance) * 1500, 0, 30);
    score -= clampPenalty((avg - this.maxAvgWordsPerSentence) * 1.4, 0, 12);
    score -= clampPenalty((this.minAvgWordsPerSentence - avg) * 1.4, 0, 10);
    if (variance > 14) score -= Math.min(8, (variance - 14) * 0.6);
    if (isClosing && actionDensity > this.maxClosingActionDensity) score -= 18;
    if (isClosing && intraSceneDelta > 0.004) {
      score -= clampPenalty(intraSceneDelta * 1000, 0, 12);
    }

    return buildResult({
      validator: "pacing",
      level: "scene",
      score,
      threshold: this.sceneThreshold,
      flags,
      metrics: {
        sentenceCount: sentences.length,
        avgWordsPerSentence: round(avg),
        sentenceStdev: round(variance),
        actionDensity: Number(actionDensity.toFixed(4)),
        targetDensity,
        energyLabel,
        isClosingScene: isClosing,
        intraSceneDelta: Number(intraSceneDelta.toFixed(4))
      }
    });
  }

  validateStory(scenes = [], storyContext = {}) {
    const flags = [];
    const energies = scenes.map((s) => {
      const text = typeof s === "string" ? s : s.text || "";
      const tokens = tokenize(text);
      const wc = tokens.length || 1;
      let actionCount = 0;
      for (const t of tokens) if (ACTION_VERBS.has(t)) actionCount += 1;
      return actionCount / wc;
    });

    if (energies.length < 2) {
      return buildResult({
        validator: "pacing",
        level: "story",
        score: 100,
        threshold: this.storyThreshold,
        metrics: { energies }
      });
    }

    // Energy curve should descend (or at least not rise) into the final scene.
    const last = energies[energies.length - 1];
    const peakBeforeLast = Math.max(...energies.slice(0, -1));
    if (last > peakBeforeLast) {
      flags.push(
        flag(
          "ending_above_peak",
          "high",
          `final action density ${last.toFixed(3)} exceeds peak ${peakBeforeLast.toFixed(3)}`,
          "Story must wind down; the highest-energy beat cannot be the last."
        )
      );
    }

    // Look for ramp-up spikes between adjacent scenes.
    let maxJump = 0;
    let jumpAt = -1;
    for (let i = 1; i < energies.length; i += 1) {
      const delta = energies[i] - energies[i - 1];
      if (delta > maxJump) {
        maxJump = delta;
        jumpAt = i;
      }
    }
    if (maxJump > 0.015) {
      flags.push(
        flag(
          "energy_spike",
          maxJump > 0.025 ? "medium" : "low",
          `pacing spike at scene ${jumpAt} (+${maxJump.toFixed(3)})`,
          "Smooth the handoff between scenes; let energy fade rather than leap."
        )
      );
    }

    // Bedtime-curve check: the tail (last 25% of scenes, min 2) should not
    // re-accelerate. Each tail scene's energy should be ≤ its predecessor
    // (with a tiny tolerance). This catches "the story almost settled, then
    // got busy again" patterns that ending_above_peak misses.
    const tailLength = Math.max(2, Math.ceil(energies.length * 0.25));
    const tailStart = energies.length - tailLength;
    let tailRise = 0;
    let tailRiseAt = -1;
    for (let i = tailStart + 1; i < energies.length; i += 1) {
      const rise = energies[i] - energies[i - 1];
      if (rise > tailRise) { tailRise = rise; tailRiseAt = i; }
    }
    if (tailRise > 0.005) {
      flags.push(
        flag(
          "tail_not_descending",
          tailRise > 0.012 ? "medium" : "low",
          `final ${tailLength} scenes re-accelerate (scene ${tailRiseAt} +${tailRise.toFixed(3)})`,
          "Let the closing scenes settle gently — each one should feel a touch sleepier than the last."
        )
      );
    }

    let score = 100;
    if (last > peakBeforeLast) score -= 25;
    score -= clampPenalty((maxJump - 0.015) * 1200, 0, 15);
    if (tailRise > 0.005) score -= clampPenalty(tailRise * 1000, 0, 14);

    return buildResult({
      validator: "pacing",
      level: "story",
      score,
      threshold: this.storyThreshold,
      flags,
      metrics: {
        energies: energies.map((e) => Number(e.toFixed(4))),
        last: Number(last.toFixed(4)),
        peakBeforeLast: Number(peakBeforeLast.toFixed(4)),
        maxNeighborJump: Number(maxJump.toFixed(4)),
        maxJumpAt: jumpAt,
        tailLength,
        tailRise: Number(tailRise.toFixed(4)),
        tailRiseAt
      }
    });
  }
}

function splitInHalves(sentences) {
  const mid = Math.floor(sentences.length / 2);
  return {
    first: sentences.slice(0, mid),
    second: sentences.slice(mid)
  };
}

function actionDensityOf(sentences) {
  let words = 0;
  let actions = 0;
  for (const s of sentences) {
    const toks = tokenize(s);
    words += toks.length;
    for (const t of toks) if (ACTION_VERBS.has(t)) actions += 1;
  }
  return words ? actions / words : 0;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

function round(n) {
  return Math.round(n * 10) / 10;
}

function clampPenalty(value, min, max) {
  if (Number.isNaN(value) || value < min) return min;
  if (value > max) return max;
  return value;
}

export default PacingValidator;
