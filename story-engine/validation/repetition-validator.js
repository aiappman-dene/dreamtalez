/**
 * Repetition Validator
 *
 * Detects:
 *  - repeated sentence openings
 *  - repetitive sensory / emotional phrasing
 *  - reused n-grams across scenes
 *
 * Pure inspection. No prose mutation. No model calls.
 */

import {
  splitSentences,
  tokenize,
  buildResult,
  flag
} from "./validator-utils.js";
import { SENTENCE_OPENER_STOPWORDS, COMMON_WORDS } from "../config/lexicons.js";

export class RepetitionValidator {
  constructor(config = {}) {
    this.openerLimit = config.openerLimit ?? 0.35;     // max share of sentences starting with same opener
    this.bigramLimit = config.bigramLimit ?? 3;        // max repeats of a meaningful bigram in a scene
    this.crossSceneLimit = config.crossSceneLimit ?? 4; // max times a phrase can recur across scenes
    this.sceneThreshold = config.thresholds?.scene ?? 75;
    this.storyThreshold = config.thresholds?.story ?? 72;
  }

  validateScene(sceneText, scenePayload = {}, context = {}) {
    const sentences = splitSentences(sceneText);
    const flags = [];

    const openers = sentences.map((s) => firstContentWord(s)).filter(Boolean);
    const openerCounts = histogram(openers);
    const totalOpeners = openers.length || 1;
    let worstOpenerShare = 0;
    let worstOpener = null;

    for (const [word, count] of openerCounts.entries()) {
      const share = count / totalOpeners;
      if (share > worstOpenerShare) {
        worstOpenerShare = share;
        worstOpener = word;
      }
      if (count >= 3 && share > this.openerLimit) {
        flags.push(
          flag(
            "repeated_opener",
            share > 0.5 ? "high" : "medium",
            `"${word}" opens ${count} of ${totalOpeners} sentences`,
            "Vary sentence beginnings; lead with imagery or character action."
          )
        );
      }
    }

    const tokens = tokenize(sceneText);
    const bigrams = ngrams(tokens, 2).filter(meaningfulNgram);
    const bigramCounts = histogram(bigrams);
    const repeatedBigrams = [...bigramCounts.entries()]
      .filter(([, n]) => n > this.bigramLimit)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [phrase, count] of repeatedBigrams) {
      flags.push(
        flag(
          "repeated_phrase",
          count > this.bigramLimit + 2 ? "high" : "low",
          `"${phrase}" appears ${count} times`,
          "Replace one or two occurrences with synonymous imagery."
        )
      );
    }

    // Score: penalize per flag with diminishing weight.
    const openerPenalty = Math.min(35, Math.max(0, (worstOpenerShare - this.openerLimit) * 100));
    const bigramPenalty = Math.min(25, repeatedBigrams.length * 6);
    const score = 100 - openerPenalty - bigramPenalty;

    return buildResult({
      validator: "repetition",
      level: "scene",
      score,
      threshold: this.sceneThreshold,
      flags,
      metrics: {
        sentenceCount: sentences.length,
        worstOpener,
        worstOpenerShare: Number(worstOpenerShare.toFixed(2)),
        repeatedBigrams: repeatedBigrams.map(([p, n]) => ({ phrase: p, count: n }))
      }
    });
  }

  validateStory(scenes = [], storyContext = {}) {
    const flags = [];
    const sceneTexts = scenes.map((s) => (typeof s === "string" ? s : s.text || ""));

    // Track meaningful trigrams across scenes.
    const seen = new Map(); // trigram -> [sceneIndex...]
    sceneTexts.forEach((text, idx) => {
      const trigrams = ngrams(tokenize(text), 3).filter(meaningfulNgram);
      const uniqueInScene = new Set(trigrams);
      for (const tri of uniqueInScene) {
        if (!seen.has(tri)) seen.set(tri, []);
        seen.get(tri).push(idx);
      }
    });

    const recurring = [...seen.entries()]
      .filter(([, indices]) => indices.length > this.crossSceneLimit)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);

    for (const [phrase, indices] of recurring) {
      flags.push(
        flag(
          "cross_scene_repetition",
          indices.length > this.crossSceneLimit + 2 ? "medium" : "low",
          `"${phrase}" recurs in scenes ${indices.join(", ")}`,
          "Reserve recurring motifs for intentional callbacks; vary the rest."
        )
      );
    }

    const penalty = Math.min(30, recurring.length * 7);
    const score = 100 - penalty;

    return buildResult({
      validator: "repetition",
      level: "story",
      score,
      threshold: this.storyThreshold,
      flags,
      metrics: {
        sceneCount: sceneTexts.length,
        recurringPhrases: recurring.map(([p, idx]) => ({ phrase: p, scenes: idx }))
      }
    });
  }
}

function firstContentWord(sentence) {
  const tokens = tokenize(sentence);
  for (const t of tokens) {
    if (!SENTENCE_OPENER_STOPWORDS.has(t)) return t;
  }
  return tokens[0] || null;
}

function ngrams(tokens, n) {
  const out = [];
  for (let i = 0; i <= tokens.length - n; i += 1) {
    out.push(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

function meaningfulNgram(phrase) {
  const parts = phrase.split(" ");
  // Keep only n-grams that contain at least one non-common word.
  return parts.some((p) => !COMMON_WORDS.has(p));
}

function histogram(items) {
  const m = new Map();
  for (const it of items) m.set(it, (m.get(it) || 0) + 1);
  return m;
}

export default RepetitionValidator;
