/**
 * DreamTalez bedtime loading messages.
 *
 * Tone: cozy · sleepy · comforting · magical · premium · emotionally safe.
 *
 * Each entry has:
 *   key  — i18n lookup key (translators can fill these in via i18n.js)
 *   text — English fallback used when no translation is registered
 *
 * If you add or reorder messages here, no other file needs changes.
 * Keep wording sweet, sleepy, magical. Avoid technical/system words
 * like "processing", "generating", "loading request".
 */

export const LOADING_MESSAGES = [
  { key: "dt_load_msg_1",  text: "Gathering soft little stars for tonight's story…" },
  { key: "dt_load_msg_2",  text: "A cozy bedtime adventure is gently coming to life…" },
  { key: "dt_load_msg_3",  text: "Moonlight is dancing across the story pages…" },
  { key: "dt_load_msg_4",  text: "Tiny lanterns are glowing softly in tonight's dream…" },
  { key: "dt_load_msg_5",  text: "A sleepy little world is being prepared just for you…" },
  { key: "dt_load_msg_6",  text: "The night sky is tucking the story in with stardust…" },
  { key: "dt_load_msg_7",  text: "Quiet wishes are weaving themselves into your story…" },
  { key: "dt_load_msg_8",  text: "Warm pillows and soft pages are getting ready for bedtime…" },
  { key: "dt_load_msg_9",  text: "A little firefly is lighting the way to your story…" },
  { key: "dt_load_msg_10", text: "Sleepy clouds are drifting in to listen along…" }
];

/**
 * Resolve a message via the existing i18n helper if one is on the page.
 * Falls back to the English text otherwise. Pure function — no DOM.
 */
export function resolveLoadingMessage(entry) {
  if (!entry) return "";
  try {
    if (typeof window !== "undefined" && window.i18n && typeof window.i18n.t === "function") {
      const translated = window.i18n.t(entry.key);
      if (translated && translated !== entry.key) return translated;
    }
  } catch (_) {
    // i18n is optional; fall through to English.
  }
  return entry.text;
}

export default LOADING_MESSAGES;
