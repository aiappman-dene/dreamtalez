/**
 * Shared utilities for validators.
 *
 * Small, deterministic, side-effect free. No model calls. No prose mutation.
 */

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z"'‘“])/g;
const WORD_RE = /[A-Za-z][A-Za-z'‘’-]*/g;

export function splitSentences(text) {
  if (!text || typeof text !== "string") return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function tokenize(text) {
  if (!text || typeof text !== "string") return [];
  return text.toLowerCase().match(WORD_RE) || [];
}

export function countMatches(tokens, lexicon) {
  if (!Array.isArray(tokens) || !Array.isArray(lexicon)) return 0;
  const set = new Set(lexicon.map((w) => w.toLowerCase()));
  let n = 0;
  for (const t of tokens) if (set.has(t)) n += 1;
  return n;
}

export function matchedTerms(tokens, lexicon) {
  if (!Array.isArray(tokens) || !Array.isArray(lexicon)) return [];
  const set = new Set(lexicon.map((w) => w.toLowerCase()));
  const found = new Set();
  for (const t of tokens) if (set.has(t)) found.add(t);
  return [...found];
}

export function syllableCount(word) {
  if (!word) return 0;
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return w.length ? 1 : 0;
  // Strip silent endings
  const cleaned = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const groups = cleaned.match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
}

export function clamp(value, min = 0, max = 100) {
  if (Number.isNaN(value) || value === undefined || value === null) return min;
  return Math.max(min, Math.min(max, value));
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Build a standard validator result envelope so the engine can aggregate.
 */
export function buildResult({
  validator,
  level,
  score,
  threshold,
  flags = [],
  metrics = {}
}) {
  const safeScore = clamp(score, 0, 100);
  return {
    validator,
    level,
    score: round1(safeScore),
    threshold,
    passed: safeScore >= threshold,
    flags,
    metrics
  };
}

export function flag(type, severity, evidence, suggestion) {
  return { type, severity, evidence, suggestion };
}
