/**
 * Story Quality Engine
 *
 * Scores a completed story across five emotional and structural dimensions.
 * Scores are 0–100. This engine runs AFTER generation — it is an analytics
 * and monitoring tool, not a quality gate (that's the validators' job).
 *
 * Dimensions:
 *   emotionalWarmth    — density of warm, comforting language
 *   bedtimeSoftness    — quality of the ending deceleration
 *   cinematicFlow      — transition smoothness and arc integrity
 *   repetitionRisk     — over-use of repeated words or phrases (lower = better)
 *   comfortContinuity  — presence and placement of comfort anchors
 *
 * Returns { scores, overall, flags }
 */

// ── Warm language signals ──────────────────────────────────────────────────
const WARMTH_SIGNALS = [
  "warm", "cozy", "cosy", "gentle", "soft", "golden", "glow", "glowing",
  "safe", "loved", "love", "snug", "dear", "kind", "caring", "sweet",
  "peaceful", "tender", "quiet", "calm", "home", "together", "comfort",
  "brave", "wonder", "magical", "shimmer", "hushed",
];

// ── Bedtime ending signals ─────────────────────────────────────────────────
const ENDING_SIGNALS = [
  "sleep", "dream", "drifted", "closed", "goodnight", "quiet",
  "moonlight", "stars", "blanket", "rest", "still", "hush",
];

// ── Disruptors that damage bedtime softness ────────────────────────────────
const SOFTNESS_DISRUPTORS = [
  "suddenly", "crashed", "screamed", "danger", "terrified", "rushed",
  "alarm", "roared", "burst", "shocked",
];

// ── Cinematic transition markers ───────────────────────────────────────────
const TRANSITION_MARKERS = [
  "carried", "followed", "drifted", "floated", "led", "wound", "wove",
  "as the", "through the", "beyond the",
];

function countMatches(text, terms) {
  const lower = text.toLowerCase();
  return terms.filter((t) => lower.includes(t)).length;
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * @param {string} story - Full story text
 * @param {{ comfortItems?: string[], familyMagic?: boolean }} opts
 * @returns {{ scores: object, overall: number, flags: string[] }}
 */
export function calculateStoryQuality(story = "", { comfortItems = [], familyMagic = false } = {}) {
  const flags = [];
  const words = wordCount(story);
  const lower = story.toLowerCase();

  if (words < 100) {
    return {
      scores: { emotionalWarmth: 0, bedtimeSoftness: 0, cinematicFlow: 0, repetitionRisk: 100, comfortContinuity: 0 },
      overall: 0,
      flags: ["story_too_short_to_score"],
    };
  }

  // ── 1. Emotional Warmth (0–100) ──────────────────────────────────────────
  const warmthHits = countMatches(story, WARMTH_SIGNALS);
  // Target: ~1 warmth signal per 50 words = ideal density
  const idealWarmth = Math.max(1, Math.round(words / 50));
  const warmthRatio = Math.min(warmthHits / idealWarmth, 1.5);
  const emotionalWarmth = Math.round(Math.min(100, warmthRatio * 70 + 30));

  // ── 2. Bedtime Softness (0–100) ──────────────────────────────────────────
  const endingStart = Math.floor(story.length * 0.75);
  const endingText  = story.slice(endingStart).toLowerCase();
  const endingHits  = ENDING_SIGNALS.filter((s) => endingText.includes(s)).length;
  const disruptorHits = SOFTNESS_DISRUPTORS.filter((s) => endingText.includes(s)).length;

  const endingScore = Math.min(100, endingHits * 15);
  const disruptorPenalty = disruptorHits * 12;
  const bedtimeSoftness = Math.max(0, Math.round(endingScore - disruptorPenalty));

  if (bedtimeSoftness < 40) flags.push("weak_bedtime_ending");
  if (disruptorHits > 0) flags.push(`disruptors_in_ending_x${disruptorHits}`);

  // ── 3. Cinematic Flow (0–100) ────────────────────────────────────────────
  const transitionHits = countMatches(story, TRANSITION_MARKERS);
  const paragraphs = story.split(/\n\n+/).filter((p) => p.trim().length > 20);
  const paraCount  = Math.max(1, paragraphs.length);
  const transitionDensity = transitionHits / paraCount;
  const cinematicFlow = Math.round(Math.min(100, transitionDensity * 120 + 30));

  // ── 4. Repetition Risk (0–100, lower = better) ──────────────────────────
  const allWords = lower.split(/\s+/).filter((w) => w.length > 4);
  const freq = {};
  for (const w of allWords) freq[w] = (freq[w] || 0) + 1;
  const overusedCount = Object.values(freq).filter((c) => c > 5).length;
  const repetitionRisk = Math.min(100, overusedCount * 8);

  if (repetitionRisk > 40) flags.push("high_repetition_risk");

  // ── 5. Comfort Continuity (0–100) ────────────────────────────────────────
  let comfortContinuity = 50; // baseline — any story has some comfort

  if (comfortItems.length > 0) {
    const comfortHits = comfortItems.filter((item) =>
      lower.includes(item.toLowerCase())
    ).length;
    comfortContinuity = Math.round((comfortHits / comfortItems.length) * 100);
    if (comfortHits === 0 && familyMagic) flags.push("comfort_anchors_missing");
  }

  // ── Overall (weighted average) ────────────────────────────────────────────
  const overall = Math.round(
    (emotionalWarmth * 0.30) +
    (bedtimeSoftness * 0.30) +
    (cinematicFlow   * 0.20) +
    ((100 - repetitionRisk) * 0.10) +
    (comfortContinuity * 0.10)
  );

  if (overall < 60) flags.push("below_quality_threshold");

  return {
    scores: {
      emotionalWarmth,
      bedtimeSoftness,
      cinematicFlow,
      repetitionRisk,
      comfortContinuity,
    },
    overall,
    flags,
  };
}

export default calculateStoryQuality;
