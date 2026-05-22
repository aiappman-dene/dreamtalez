/**
 * Prose Rhythm Engine
 *
 * Light post-processing pass that adds lullaby-like cadence to specific
 * prose patterns. Applied after story generation — only touches exact
 * matches, never rewrites surrounding content.
 *
 * Patterns chosen because they commonly appear in AI-generated bedtime
 * prose and benefit from a gentler, more rhythmic form.
 *
 * Runs BEFORE polishStory() so whitespace normalisation doesn't disrupt
 * the ellipsis spacing intentionally introduced here.
 */

const RHYTHM_MAP = [
  [/rain fell softly\b/gi,           "rain whispered softly… drip-drip… against the windows"],
  [/\bthe lantern glowed\b/gi,        "the lantern glowed gently… slowly… beneath the sleepy stars"],
  [/\bthe stars twinkled\b/gi,        "the stars twinkled… softly… like tiny night-lights"],
  [/\bthe wind blew softly\b/gi,      "the wind breathed softly… whoosh… through the sleepy leaves"],
  [/\bshe fell asleep\b/gi,           "she drifted… slowly… softly… into the sweetest sleep"],
  [/\bhe fell asleep\b/gi,            "he drifted… slowly… softly… into the sweetest sleep"],
  [/\bthey fell asleep\b/gi,          "they drifted… slowly… softly… into the sweetest sleep"],
  [/\bthe moon shone\b/gi,            "the moon glowed… quietly… above the sleeping rooftops"],
  [/\beverything was quiet\b/gi,      "everything grew quiet… very quiet… like a long, slow breath"],
  [/\bthe night was still\b/gi,       "the night lay still… soft and warm… around every sleeping thing"],
];

export function applyRhythm(text = "") {
  let result = String(text);
  for (const [pattern, replacement] of RHYTHM_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Returns a prompt instruction block that teaches Claude to write
 * rhythmically — without the post-processor needing to rewrite after.
 */
export function buildRhythmPromptBlock() {
  return `PROSE RHYTHM (lullaby cadence):
- Let long sentences breathe with soft pauses: "the lantern glowed gently… slowly… beneath the sleepy stars."
- Short sentences carry weight. Use them after emotional moments.
- The final paragraph should physically slow down — sentences getting shorter, softer, quieter.
- Read aloud rule: the last page should slow your voice naturally.`;
}

export default applyRhythm;
