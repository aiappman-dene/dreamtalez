/**
 * Global Localization Validator
 *
 * Checks that non-English stories preserve DreamTalez's emotional tone
 * rather than just being literal translations. A story can be grammatically
 * correct in another language but still lose its bedtime softness if the
 * translator chose clinical words over warm ones.
 *
 * Also checks for language mixing (English leaking into non-English stories)
 * and cultural comfort appropriateness.
 *
 * Returns { passed, warnings }
 */

// English words that commonly leak into non-English AI outputs
const ENGLISH_LEAK_SIGNALS = [
  "the ", " and ", " of ", " is ", " was ", " had ", " they ",
  "suddenly", "magical", "adventure", " with ",
];

// Language-specific bedtime comfort signals
// For each language code, a minimum set of calm/sleep words expected in ending.
const LANGUAGE_BEDTIME_SIGNALS = {
  "fr": ["doux", "calme", "étoile", "nuit", "rêve", "dormir", "sommeil", "chaud", "tranquille"],
  "es": ["suave", "tranquilo", "estrellas", "noche", "sueño", "dormir", "caliente", "paz", "silencio"],
  "de": ["sanft", "ruhig", "Sterne", "Nacht", "Traum", "schlafen", "warm", "stille", "leise"],
  "it": ["dolce", "quiete", "stelle", "notte", "sogno", "dormire", "caldo", "silenzio", "pace"],
  "pt": ["suave", "calmo", "estrelas", "noite", "sonho", "dormir", "quente", "silêncio", "paz"],
  "ja": ["やさしい", "しずか", "ほし", "よる", "ゆめ", "ねむる", "あたたか", "しずけ"],
  "zh": ["轻柔", "安静", "星星", "夜晚", "梦", "睡觉", "温暖", "宁静", "平和"],
  "ar": ["لطيف", "هادئ", "نجوم", "ليلة", "حلم", "نوم", "دافئ", "سكون"],
  "hi": ["कोमल", "शांत", "तारे", "रात", "सपना", "सोना", "गर्म", "मौन"],
};

const ENGLISH_CODES = new Set(["en", "en-GB", "en-US", "en-gb", "en-us"]);

function resolveBaseLanguage(languageCode) {
  if (!languageCode) return "en";
  const lower = String(languageCode).toLowerCase();
  // Strip region suffix for lookup: "zh-CN" → "zh"
  return lower.split("-")[0];
}

/**
 * @param {string} story
 * @param {{ language?: string }} opts
 * @returns {{ passed: boolean, warnings: object[] }}
 */
export class GlobalLocalizationValidator {
  validate(story = "", { language = "en-GB" } = {}) {
    const warnings = [];
    const langCode  = resolveBaseLanguage(language);

    // English stories: no localization check needed
    if (ENGLISH_CODES.has(language.toLowerCase()) || langCode === "en") {
      return { passed: true, warnings: [] };
    }

    const storyLower = story.toLowerCase();

    // 1. English leak detection — common English words in non-English story
    const leakCount = ENGLISH_LEAK_SIGNALS.filter((signal) =>
      storyLower.includes(signal.toLowerCase())
    ).length;

    if (leakCount >= 4) {
      warnings.push({
        type:     "english_language_leak",
        severity: "medium",
        evidence: `${leakCount} common English phrases detected in a non-English story (language: ${language}) — possible translation contamination`,
      });
    }

    // 2. Language-specific bedtime signal check
    const expectedSignals = LANGUAGE_BEDTIME_SIGNALS[langCode] || [];
    if (expectedSignals.length > 0) {
      const endingStart = Math.floor(story.length * 0.7);
      const endingText  = story.slice(endingStart).toLowerCase();
      const foundSignals = expectedSignals.filter((s) => endingText.includes(s));

      if (foundSignals.length === 0) {
        warnings.push({
          type:     "missing_localized_bedtime_signals",
          severity: "low",
          evidence: `No language-specific bedtime comfort words found in final 30% for language "${language}" — emotional tone may feel flat in translation`,
        });
      }
    }

    // 3. Story length preservation check
    // Non-English stories should not be significantly shorter than English equivalents
    // (a sign of truncated translation rather than full generation)
    const wordCount = story.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 400) {
      warnings.push({
        type:     "localized_story_too_short",
        severity: "medium",
        evidence: `Localized story (${language}) is only ${wordCount} words — may indicate translation truncation rather than full generation`,
      });
    }

    return {
      passed: warnings.filter((w) => w.severity === "high" || w.severity === "medium").length === 0,
      warnings,
    };
  }
}

export default GlobalLocalizationValidator;
