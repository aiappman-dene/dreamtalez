/**
 * Prose Rhythm Validator
 *
 * Read-aloud cadence checks. DreamTalez stories should feel like a cozy
 * bedtime narrator — short calming sentences, medium narrative sentences,
 * occasional softly lyrical lines, all woven together with breathing room.
 *
 * Detects:
 *  - sentence-length distribution (global variety)
 *  - consecutive same-length sentences (local monotony)
 *  - repeated syntactic openers (4+ pronoun starts in a row)
 *  - single-sentence length spikes against their neighbors
 *  - run-on sentences and comma chains
 *  - awkward read-aloud phonetic clusters
 *
 * Pure inspection. No prose mutation. No model calls.
 */

// Sentence-length buckets for local-monotony detection.
//   short:  ≤ 7 words   (a hush, a beat)
//   medium: 8-18 words  (the bedtime baseline)
//   long:   ≥ 19 words  (a lyrical breath)
const LEN_SHORT  = 7;
const LEN_LONG   = 19;

const PRONOUN_OPENERS = new Set([
  "she", "he", "they", "it",
  "her", "his", "their",
  "i",   "we",  "you"
]);

import { splitSentences, tokenize, buildResult, flag } from "./validator-utils.js";
import { READ_ALOUD_AWKWARD } from "../config/lexicons.js";

export class ProseRhythmValidator {
  constructor(config = {}) {
    this.runOnWordLimit = config.runOnWordLimit ?? 32;
    this.maxCommasPerSentence = config.maxCommasPerSentence ?? 4;
    this.minVarietyRatio = config.minVarietyRatio ?? 0.45; // share of sentences within ±30% of mean — high = monotone
    this.sceneThreshold = config.thresholds?.scene ?? 76;
    this.storyThreshold = config.thresholds?.story ?? 78;
  }

  validateScene(sceneText, scenePayload = {}, context = {}) {
    const sentences = splitSentences(sceneText);
    const flags = [];

    if (!sentences.length) {
      return buildResult({
        validator: "prose-rhythm",
        level: "scene",
        score: 0,
        threshold: this.sceneThreshold,
        flags: [flag("empty_scene", "high", "no sentences detected", "Scene has no prose to evaluate.")],
        metrics: { sentenceCount: 0 }
      });
    }

    const lengths = sentences.map((s) => tokenize(s).length);
    const avg = mean(lengths);

    const runOns = [];
    sentences.forEach((s, i) => {
      const wc = tokenize(s).length;
      const commaCount = (s.match(/,/g) || []).length;
      if (wc > this.runOnWordLimit) runOns.push({ index: i, wordCount: wc });
      if (commaCount > this.maxCommasPerSentence) {
        flags.push(
          flag(
            "comma_chain",
            commaCount > this.maxCommasPerSentence + 2 ? "medium" : "low",
            `sentence ${i} has ${commaCount} commas`,
            "Split into two sentences; comma chains break read-aloud breath."
          )
        );
      }
    });

    if (runOns.length) {
      flags.push(
        flag(
          "run_on_sentence",
          runOns.length > 1 ? "medium" : "low",
          `${runOns.length} sentence(s) over ${this.runOnWordLimit} words`,
          "Trim or split long sentences; aim for breath-sized phrases."
        )
      );
    }

    // Monotone check — too many sentences clustered around the mean.
    const lower = avg * 0.7;
    const upper = avg * 1.3;
    const inBand = lengths.filter((l) => l >= lower && l <= upper).length;
    const monotoneRatio = inBand / lengths.length;
    if (lengths.length >= 4 && monotoneRatio > 1 - this.minVarietyRatio) {
      flags.push(
        flag(
          "monotone_rhythm",
          monotoneRatio > 0.85 ? "medium" : "low",
          `${(monotoneRatio * 100).toFixed(0)}% of sentences within ±30% of mean length`,
          "Weave in a soft hush — a short calming line, then a longer breath."
        )
      );
    }

    // Local monotony — 3+ adjacent sentences in the same length bucket.
    // Catches stretches that feel mechanical even when global variety looks fine.
    const buckets = lengths.map(bucketOf);
    const longestSameRun = longestRunLength(buckets);
    if (longestSameRun.length >= 3) {
      flags.push(
        flag(
          "consecutive_same_length",
          longestSameRun.length >= 5 ? "medium" : "low",
          `${longestSameRun.length} ${longestSameRun.bucket} sentences in a row (sentences ${longestSameRun.start}-${longestSameRun.start + longestSameRun.length - 1})`,
          "Slip a shorter hush or a longer breath between them; bedtime needs room to settle."
        )
      );
    }

    // Pronoun-opener run — 4+ adjacent sentences starting with the same kind
    // of pronoun feels like a list, not a story.
    const openers = sentences.map(firstTokenOf);
    const longestOpenerRun = longestRunLength(
      openers.map((w) => (PRONOUN_OPENERS.has(w) ? "pronoun" : "other"))
    );
    if (longestOpenerRun.bucket === "pronoun" && longestOpenerRun.length >= 4) {
      flags.push(
        flag(
          "pronoun_opener_run",
          longestOpenerRun.length >= 6 ? "medium" : "low",
          `${longestOpenerRun.length} sentences in a row begin with a pronoun`,
          "Lead a few sentences with a small image — moonlight, a soft sound, a warm thought."
        )
      );
    }

    // Local length spike — one sentence wildly out of step with its neighbors.
    // We compare each sentence to a 4-sentence window mean (excluding self).
    const spikes = findLocalLengthSpikes(lengths);
    if (spikes.length) {
      const worst = spikes[0];
      flags.push(
        flag(
          "local_length_spike",
          spikes.length > 1 ? "low" : "low",
          `sentence ${worst.index} is ${worst.ratio.toFixed(1)}× its neighbors' length`,
          "Smooth the surrounding rhythm so no single sentence feels like a jolt."
        )
      );
    }

    const lowerText = sceneText.toLowerCase();
    const awkward = READ_ALOUD_AWKWARD.filter((p) => lowerText.includes(p));
    if (awkward.length) {
      flags.push(
        flag(
          "awkward_phonetics",
          "low",
          `awkward read-aloud markers: ${awkward.join(", ")}`,
          "Replace polysyllabic adverbs with simpler bedtime equivalents."
        )
      );
    }

    let score = 100;
    score -= Math.min(18, runOns.length * 9);
    score -= Math.min(15, flags.filter((f) => f.type === "comma_chain").length * 6);
    if (monotoneRatio > 1 - this.minVarietyRatio && lengths.length >= 4) {
      score -= clampPenalty((monotoneRatio - (1 - this.minVarietyRatio)) * 100, 0, 14);
    }
    score -= Math.min(8, awkward.length * 3);
    // New cadence heuristics — modest penalties so they steer rather than block.
    if (longestSameRun.length >= 3) {
      score -= Math.min(8, (longestSameRun.length - 2) * 2);
    }
    if (longestOpenerRun.bucket === "pronoun" && longestOpenerRun.length >= 4) {
      score -= Math.min(7, (longestOpenerRun.length - 3) * 2);
    }
    if (spikes.length) {
      score -= Math.min(5, spikes.length * 2);
    }

    return buildResult({
      validator: "prose-rhythm",
      level: "scene",
      score,
      threshold: this.sceneThreshold,
      flags,
      metrics: {
        sentenceCount: sentences.length,
        avgWordsPerSentence: round(avg),
        monotoneRatio: round(monotoneRatio),
        runOnCount: runOns.length,
        awkwardMarkers: awkward,
        longestSameLengthRun: longestSameRun.length,
        longestPronounOpenerRun: longestOpenerRun.bucket === "pronoun" ? longestOpenerRun.length : 0,
        localLengthSpikes: spikes.length
      }
    });
  }

  validateStory(scenes = [], storyContext = {}) {
    const flags = [];
    const sceneTexts = scenes.map((s) => (typeof s === "string" ? s : s.text || ""));
    const allSentences = sceneTexts.flatMap((t) => splitSentences(t));
    if (!allSentences.length) {
      return buildResult({
        validator: "prose-rhythm",
        level: "story",
        score: 0,
        threshold: this.storyThreshold,
        flags: [flag("empty_story", "high", "no sentences detected", "Story has no prose.")],
        metrics: { sentenceCount: 0 }
      });
    }

    const lengths = allSentences.map((s) => tokenize(s).length);
    const avg = mean(lengths);
    const variance = stdev(lengths);

    // Story-level rhythm: total variety should not collapse.
    const lower = avg * 0.7;
    const upper = avg * 1.3;
    const inBand = lengths.filter((l) => l >= lower && l <= upper).length;
    const monotoneRatio = inBand / lengths.length;
    if (monotoneRatio > 0.7) {
      flags.push(
        flag(
          "story_monotone",
          monotoneRatio > 0.82 ? "medium" : "low",
          `${(monotoneRatio * 100).toFixed(0)}% of all sentences cluster around mean`,
          "Introduce more rhythmic variation across scenes."
        )
      );
    }

    let score = 100 - clampPenalty((monotoneRatio - 0.7) * 100, 0, 20);

    return buildResult({
      validator: "prose-rhythm",
      level: "story",
      score,
      threshold: this.storyThreshold,
      flags,
      metrics: {
        sentenceCount: allSentences.length,
        avgWordsPerSentence: round(avg),
        sentenceStdev: round(variance),
        monotoneRatio: round(monotoneRatio)
      }
    });
  }
}

function bucketOf(wordCount) {
  if (wordCount <= LEN_SHORT) return "short";
  if (wordCount >= LEN_LONG)  return "long";
  return "medium";
}

function firstTokenOf(sentence) {
  const m = (sentence || "").toLowerCase().match(/[a-z][a-z'’]*/);
  return m ? m[0] : "";
}

/**
 * Longest run of identical labels in a sequence.
 * Returns { length, bucket, start } where start is the 0-based index of the run.
 */
function longestRunLength(labels) {
  if (!labels.length) return { length: 0, bucket: null, start: -1 };
  let best = { length: 1, bucket: labels[0], start: 0 };
  let curStart = 0;
  for (let i = 1; i < labels.length; i += 1) {
    if (labels[i] === labels[i - 1]) {
      const len = i - curStart + 1;
      if (len > best.length) {
        best = { length: len, bucket: labels[i], start: curStart };
      }
    } else {
      curStart = i;
    }
  }
  return best;
}

/**
 * Sentences whose length is wildly out of step with their immediate neighbors.
 * Returns the indices and ratio for each spike (sorted by severity desc).
 * Window: 2 sentences on each side, excluding self.
 */
function findLocalLengthSpikes(lengths) {
  const out = [];
  if (lengths.length < 5) return out; // need a real run to call a spike
  for (let i = 0; i < lengths.length; i += 1) {
    const window = [];
    for (let j = Math.max(0, i - 2); j <= Math.min(lengths.length - 1, i + 2); j += 1) {
      if (j !== i) window.push(lengths[j]);
    }
    if (window.length < 3) continue;
    const winMean = mean(window);
    if (winMean < 6) continue; // too short a baseline to call a spike
    const ratio = lengths[i] / winMean;
    const absoluteGap = Math.abs(lengths[i] - winMean);
    // Require BOTH a strong ratio and a meaningful absolute word-count gap.
    // Cozy bedtime sentences often run 5-9 words; a 5 vs 7 swing isn't a spike.
    if ((ratio >= 2.5 || ratio <= 0.30) && absoluteGap >= 8) {
      out.push({ index: i, ratio, absoluteGap });
    }
  }
  out.sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1));
  return out;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

function round(n) {
  return Math.round(n * 10) / 10;
}

function clampPenalty(value, min, max) {
  if (Number.isNaN(value) || value < min) return min;
  if (value > max) return max;
  return value;
}

export default ProseRhythmValidator;
