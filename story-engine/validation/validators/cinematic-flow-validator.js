/**
 * Cinematic Flow Validator
 *
 * Validates cinematic quality: atmospheric transitions, scene grounding,
 * and absence of mechanical "then they went to" scene cuts.
 *
 * Score: 1–10.
 */

const TRANSITION_SIGNALS = [
  "carried", "followed", "drifted", "floated", "wound", "wove",
  "as the ", "beyond the ", "through the ", "beneath the ", "above the ",
  "the light ", "a sound ", "the warmth ", "the glow ",
];

const ABRUPT_TRANSITION_PATTERNS = [
  /\bthen (she|he|they) went to\b/gi,
  /\bthen (she|he|they) walked to\b/gi,
  /\bnext,/gi,
  /\bafter that,/gi,
];

const SCENE_GROUNDING_SIGNALS = [
  "ground", "floor", "sky", "tree", "rock", "grass", "water", "path",
  "bridge", "door", "window", "light", "shadow", "air", "breeze",
];

const MIN_TRANSITION_SIGNALS  = 2;
const MIN_SCENE_GROUNDING     = 3;
const MAX_ABRUPT_TRANSITIONS  = 1;

export class CinematicFlowValidator {
  /**
   * @param {string} text - Full story text
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate(text = "") {
    let score = 10;
    const warnings = [];
    const lower = text.toLowerCase();

    // Atmospheric transition signals
    const transitionHits = TRANSITION_SIGNALS.filter((s) => lower.includes(s)).length;
    if (transitionHits < MIN_TRANSITION_SIGNALS) {
      score -= 2;
      warnings.push(`Weak cinematic transitions — only ${transitionHits} atmospheric thread signals (need ${MIN_TRANSITION_SIGNALS}+)`);
    }

    // Abrupt transitions
    let abruptCount = 0;
    for (const pattern of ABRUPT_TRANSITION_PATTERNS) {
      const found = text.match(pattern);
      if (found) {
        abruptCount += found.length;
        pattern.lastIndex = 0;
      }
    }
    if (abruptCount > MAX_ABRUPT_TRANSITIONS) {
      score -= 2;
      warnings.push(`${abruptCount} abrupt scene cuts detected — carry an atmospheric thread between scenes`);
    }

    // Scene grounding — story must feel physically real
    const groundingHits = SCENE_GROUNDING_SIGNALS.filter((s) => lower.includes(s)).length;
    if (groundingHits < MIN_SCENE_GROUNDING) {
      score -= 1;
      warnings.push(`Weak scene grounding — story lacks physical anchors (${groundingHits} found, need ${MIN_SCENE_GROUNDING}+)`);
    }

    // Comfort anchor return — warmth/light/safety must return in ending
    const endingSection = text.slice(Math.floor(text.length * 0.75)).toLowerCase();
    const comfortInEnding = /(warm|light|safe|blanket|glow|home|lantern|stars|moonlight)/.test(endingSection);
    if (!comfortInEnding) {
      score -= 2;
      warnings.push("Comfort anchor not returned in ending — warmth/safety must reappear in final scene");
    }

    return {
      section:  "cinematic-flow",
      score:    Math.max(score, 1),
      warnings,
    };
  }
}

export default CinematicFlowValidator;
