/**
 * Opening Validator
 *
 * Validates the opening section of a DreamTalez story against the
 * Disney Quality Standard and Cinematic Prose Standard.
 *
 * Score: 1–10. Returns section, score, warnings.
 */

const BEDTIME_ATMOSPHERE_SIGNALS = [
  "moon", "stars", "lantern", "rain", "warm", "glow", "golden",
  "soft light", "candle", "fireplace", "twilight", "dusk", "evening",
];

const WONDER_HOOK_SIGNALS = [
  "wonder", "curious", "adventure", "sparkle", "shimmer", "magical",
  "mystery", "discovered", "noticed", "caught", "glimmered", "appeared",
];

const GENERIC_OPENER_PATTERNS = [
  /^once upon a time/i,
  /^there was a (child|little|girl|boy)/i,
  /^there once was/i,
  /^in a land far/i,
  /^long long ago/i,
  /^one day,/i,
];

const MIN_OPENING_LENGTH = 400; // characters

export class OpeningValidator {
  /**
   * @param {string} text - Opening section text
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate(text = "") {
    let score = 10;
    const warnings = [];
    const lower = text.toLowerCase();

    // Length check
    if (text.length < MIN_OPENING_LENGTH) {
      score -= 2;
      warnings.push(`Opening too short (${text.length} chars — aim for ${MIN_OPENING_LENGTH}+)`);
    }

    // Bedtime atmosphere
    const hasAtmosphere = BEDTIME_ATMOSPHERE_SIGNALS.some((s) => lower.includes(s));
    if (!hasAtmosphere) {
      score -= 1;
      warnings.push("Weak bedtime atmosphere — no warmth/light/night signals in opening");
    }

    // Wonder hook
    const hasWonder = WONDER_HOOK_SIGNALS.some((s) => lower.includes(s));
    if (!hasWonder) {
      score -= 1;
      warnings.push("Weak wonder hook — opening lacks curiosity or magical invitation");
    }

    // Generic opener check
    const hasGenericOpener = GENERIC_OPENER_PATTERNS.some((p) => p.test(text.trimStart()));
    if (hasGenericOpener) {
      score -= 2;
      warnings.push('Generic opener detected — must begin mid-moment, not with "Once upon a time" or character description');
    }

    // Sensory grounding — at least one physical detail
    const hasSensory = /\b(felt|smelled|heard|saw|touched|tasted|warm|cold|soft|rough|sound)\b/i.test(text);
    if (!hasSensory) {
      score -= 1;
      warnings.push("No sensory grounding in opening — child must feel physically present in the world");
    }

    return {
      section:  "opening",
      score:    Math.max(score, 1),
      warnings,
    };
  }
}

export default OpeningValidator;
