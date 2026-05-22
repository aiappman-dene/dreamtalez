/**
 * Reading Level Validator
 *
 * Computes a Flesch-Kincaid grade-level approximation and compares it
 * against the age-band target from lexicons. Bedtime is read aloud,
 * so the target is intentionally lower than a child's solo-reading band.
 *
 * Pure inspection. No prose mutation. No model calls.
 */

import {
  splitSentences,
  tokenize,
  syllableCount,
  buildResult,
  flag
} from "./validator-utils.js";
import { AGE_BAND_READING_LEVEL } from "../config/lexicons.js";

export class ReadingLevelValidator {
  constructor(config = {}) {
    this.bands = AGE_BAND_READING_LEVEL;
    this.sceneThreshold = config.thresholds?.scene ?? 78;
    this.storyThreshold = config.thresholds?.story ?? 80;
  }

  validateScene(sceneText, scenePayload = {}, context = {}) {
    const ageBand = resolveAgeBand(scenePayload, context);
    const target = this.bands[ageBand] || this.bands.default;
    const stats = readingStats(sceneText);

    const flags = [];

    if (stats.sentenceCount === 0) {
      return buildResult({
        validator: "reading-level",
        level: "scene",
        score: 0,
        threshold: this.sceneThreshold,
        flags: [flag("empty_scene", "high", "no sentences detected", "Scene has no prose to evaluate.")],
        metrics: { ageBand, target, ...stats }
      });
    }

    if (stats.gradeLevel > target.max) {
      flags.push(
        flag(
          "too_complex",
          stats.gradeLevel > target.max + 1.5 ? "high" : "medium",
          `grade level ${stats.gradeLevel.toFixed(1)} above max ${target.max} for age band ${ageBand}`,
          "Simplify vocabulary and shorten clauses; bedtime favors clarity."
        )
      );
    } else if (stats.gradeLevel < target.min) {
      flags.push(
        flag(
          "too_simple",
          "low",
          `grade level ${stats.gradeLevel.toFixed(1)} below min ${target.min} for age band ${ageBand}`,
          "Allow occasional richer phrasing; emotional sophistication is welcome."
        )
      );
    }

    let score = 100;
    if (stats.gradeLevel > target.max) {
      score -= clampPenalty((stats.gradeLevel - target.max) * 12, 0, 30);
    }
    if (stats.gradeLevel < target.min) {
      score -= clampPenalty((target.min - stats.gradeLevel) * 8, 0, 14);
    }

    return buildResult({
      validator: "reading-level",
      level: "scene",
      score,
      threshold: this.sceneThreshold,
      flags,
      metrics: { ageBand, target, ...stats }
    });
  }

  validateStory(scenes = [], storyContext = {}) {
    const sceneTexts = scenes.map((s) => (typeof s === "string" ? s : s.text || ""));
    const fullText = sceneTexts.join("\n\n");
    const ageBand = resolveAgeBand(null, storyContext);
    const target = this.bands[ageBand] || this.bands.default;
    const stats = readingStats(fullText);
    const flags = [];

    if (stats.sentenceCount === 0) {
      return buildResult({
        validator: "reading-level",
        level: "story",
        score: 0,
        threshold: this.storyThreshold,
        flags: [flag("empty_story", "high", "no sentences", "Story has no prose.")],
        metrics: { ageBand, target, ...stats }
      });
    }

    if (Math.abs(stats.gradeLevel - target.target) > 1.5) {
      flags.push(
        flag(
          "story_grade_drift",
          Math.abs(stats.gradeLevel - target.target) > 2.5 ? "medium" : "low",
          `story grade ${stats.gradeLevel.toFixed(1)} drifts from target ${target.target} for age band ${ageBand}`,
          "Calibrate overall reading level toward the target band."
        )
      );
    }

    let score = 100 - clampPenalty(Math.abs(stats.gradeLevel - target.target) * 8, 0, 22);

    return buildResult({
      validator: "reading-level",
      level: "story",
      score,
      threshold: this.storyThreshold,
      flags,
      metrics: { ageBand, target, ...stats }
    });
  }
}

function readingStats(text) {
  const sentences = splitSentences(text);
  const tokens = tokenize(text);
  const wordCount = tokens.length;
  const sentenceCount = sentences.length;
  if (!wordCount || !sentenceCount) {
    return { sentenceCount, wordCount, syllableTotal: 0, gradeLevel: 0 };
  }
  let syllableTotal = 0;
  for (const t of tokens) syllableTotal += syllableCount(t);

  // Flesch-Kincaid Grade Level
  const fkgl =
    0.39 * (wordCount / sentenceCount)
    + 11.8 * (syllableTotal / wordCount)
    - 15.59;

  return {
    sentenceCount,
    wordCount,
    syllableTotal,
    gradeLevel: round(fkgl)
  };
}

function resolveAgeBand(scenePayload, context) {
  const fromPayload = scenePayload?.metadata?.ageBand
    || scenePayload?.metadata?.age_band
    || scenePayload?.target_age;
  const fromContext = context?.ageBand
    || context?.age_band
    || context?.story_dna?.target_age
    || context?.target_age;
  const candidate = fromPayload || fromContext;
  if (typeof candidate === "string" && /^\d+(-\d+)?$/.test(candidate)) return candidate;
  if (typeof candidate === "number") return `${candidate}-${candidate + 1}`;
  return "default";
}

function round(n) {
  return Math.round(n * 10) / 10;
}

function clampPenalty(value, min, max) {
  if (Number.isNaN(value) || value < min) return min;
  if (value > max) return max;
  return value;
}

export default ReadingLevelValidator;
