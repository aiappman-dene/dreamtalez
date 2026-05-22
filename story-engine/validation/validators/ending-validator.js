/**
 * Ending Validator
 *
 * Validates the ending section — the sleep transition. Held to the highest
 * standard because this is the last thing the child hears before sleep.
 *
 * Score: 1–10. Threshold is 9.0 — stricter than all other sections.
 */

const BEDTIME_SIGNALS = [
  "sleep", "blanket", "stars", "dream", "warm", "moonlight", "closed",
  "drifted", "hush", "still", "safe", "quiet", "rest", "peaceful",
  "goodnight", "heavy", "soft", "settled", "breathed",
];

const STIMULATION_WORDS = [
  "exploded", "screamed", "terrified", "suddenly", "crashed", "burst",
  "shouted", "rushed", "danger", "shocked", "roared", "alarm",
];

const EMOTIONAL_LANDING_SIGNALS = [
  "safe", "calm", "soft", "quiet", "warm", "loved", "home", "belong",
  "gentle", "peace", "still", "hush", "together",
];

const MIN_ENDING_LENGTH  = 200; // characters
const MIN_BEDTIME_HITS   = 3;
const MIN_EMOTIONAL_HITS = 2;

export class EndingValidator {
  /**
   * @param {string} text - Ending section text
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate(text = "") {
    let score = 10;
    const warnings = [];
    const lower = text.toLowerCase();

    // Length — ending must be substantive
    if (text.length < MIN_ENDING_LENGTH) {
      score -= 2;
      warnings.push(`Ending too short (${text.length} chars) — sleep transition needs more space`);
    }

    // Bedtime signals
    const bedtimeHits = BEDTIME_SIGNALS.filter((s) => lower.includes(s)).length;
    if (bedtimeHits < MIN_BEDTIME_HITS) {
      score -= 3;
      warnings.push(`Ending lacks bedtime softness — only ${bedtimeHits} sleep signals (need ${MIN_BEDTIME_HITS}+)`);
    }

    // Stimulation words — hard penalty
    const stimulationFound = STIMULATION_WORDS.filter((s) => lower.includes(s));
    if (stimulationFound.length > 0) {
      score -= 4;
      warnings.push(`Ending overstimulating — found: "${stimulationFound.slice(0, 3).join('", "')}"`);
    }

    // Emotional landing
    const emotionalHits = EMOTIONAL_LANDING_SIGNALS.filter((s) => lower.includes(s)).length;
    if (emotionalHits < MIN_EMOTIONAL_HITS) {
      score -= 2;
      warnings.push(`Weak emotional landing — only ${emotionalHits} safety/warmth signals (need ${MIN_EMOTIONAL_HITS}+)`);
    }

    // Exclamation marks — banned in ending
    const exclamations = (text.match(/!/g) || []).length;
    if (exclamations > 0) {
      score -= 1;
      warnings.push(`${exclamations} exclamation mark(s) in ending — disrupts sleep-readiness`);
    }

    // Final sentence length — must be short
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
    if (sentences.length > 0) {
      const finalWords = sentences[sentences.length - 1].split(/\s+/).length;
      if (finalWords > 12) {
        score -= 1;
        warnings.push(`Final sentence too long (${finalWords} words) — should be ≤10 words, like a lullaby line`);
      }
    }

    // Abrupt ending check — must end with terminal punctuation
    if (!/[.!?'"]?\s*$/.test(text.trimEnd())) {
      score -= 2;
      warnings.push("Story appears to end abruptly — no terminal punctuation");
    }

    return {
      section:  "ending",
      score:    Math.max(score, 1),
      warnings,
    };
  }
}

export default EndingValidator;
