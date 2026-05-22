/**
 * Bedtime Softness Balancer
 *
 * Light post-processing pass that softens any inadvertently sharp language
 * that slipped through generation. Applied only to Family Magic stories
 * (other modes have their own tone calibration).
 *
 * Rules: no removals, no additions — word substitutions only.
 * Runs after polishStory() in the pipeline.
 */

const SOFTNESS_MAP = [
  [/\bshouted\b/gi,        "called out softly"],
  [/\byelled\b/gi,         "said quietly"],
  [/\bscreamed\b/gi,       "gasped"],
  [/\bran quickly\b/gi,    "wandered softly"],
  [/\bterrifying\b/gi,     "mysterious"],
  [/\bterrified\b/gi,      "wide-eyed with wonder"],
  [/\bscary\b/gi,          "exciting"],
  [/\bdangerous\b/gi,      "surprising"],
  [/\bcrashed\b/gi,        "tumbled gently"],
  [/\bexploded\b/gi,       "burst open with light"],
];

export function applyBedtimeSoftness(text = "") {
  let result = String(text);
  for (const [pattern, replacement] of SOFTNESS_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export default applyBedtimeSoftness;
