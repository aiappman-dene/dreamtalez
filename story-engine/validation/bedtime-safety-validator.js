/**
 * Bedtime Safety Validator
 *
 * Hard-fails on violent / loud / distressing imagery anywhere in the story.
 * Soft-fails on action verbs in the closing scene.
 * Confirms the final scene resolves tension instead of leaving it open.
 *
 * Pure inspection. No prose mutation. No model calls.
 */

import {
  splitSentences,
  tokenize,
  matchedTerms,
  buildResult,
  flag
} from "./validator-utils.js";
import { BEDTIME_BANNED, TONE_LEXICON } from "../config/lexicons.js";

const VIOLENT_PENALTY = 40;
const LOUD_PENALTY = 18;
const DISTRESSING_PENALTY = 22;
const ENDING_UNSAFE_PENALTY = 12;

export class BedtimeSafetyValidator {
  constructor(config = {}) {
    this.endingResolutionFloor = config.endingResolutionFloor ?? 0.012; // reassurance density on final scene
    this.sceneThreshold = config.thresholds?.scene ?? 90;
    this.storyThreshold = config.thresholds?.story ?? 92;
  }

  validateScene(sceneText, scenePayload = {}, context = {}) {
    const isClosingScene = Boolean(
      scenePayload?.metadata?.isClosingScene
      || context?.isClosingScene
      || scenePayload?.scene_objectives?.some?.((o) => /closing|ending|final/i.test(o))
    );

    const tokens = tokenize(sceneText);
    const flags = [];
    let score = 100;

    const violent = matchedTerms(tokens, BEDTIME_BANNED.violent);
    if (violent.length) {
      flags.push(
        flag(
          "violent_imagery",
          "high",
          `banned terms: ${violent.join(", ")}`,
          "Remove violent vocabulary entirely; bedtime tolerates none of it."
        )
      );
      score -= VIOLENT_PENALTY * Math.min(2, violent.length);
    }

    const loud = matchedTerms(tokens, BEDTIME_BANNED.loud);
    if (loud.length) {
      flags.push(
        flag(
          "loud_imagery",
          loud.length > 1 ? "medium" : "low",
          `loud verbs: ${loud.join(", ")}`,
          "Replace shouted/crashed/screamed with hushed equivalents."
        )
      );
      score -= LOUD_PENALTY * Math.min(2, loud.length);
    }

    const distressing = matchedTerms(tokens, BEDTIME_BANNED.distressing);
    if (distressing.length) {
      flags.push(
        flag(
          "distressing_imagery",
          "high",
          `distressing terms: ${distressing.join(", ")}`,
          "Drop the dread; bedtime imagery should never threaten permanence of harm."
        )
      );
      score -= DISTRESSING_PENALTY * Math.min(2, distressing.length);
    }

    if (isClosingScene) {
      const action = matchedTerms(tokens, BEDTIME_BANNED.ending_unsafe);
      if (action.length) {
        flags.push(
          flag(
            "ending_action_verbs",
            "medium",
            `closing scene contains action: ${action.join(", ")}`,
            "Final scene must settle, not move; replace running/chasing with stillness."
          )
        );
        score -= ENDING_UNSAFE_PENALTY * Math.min(2, action.length);
      }

      const reassuranceCount = matchedTerms(tokens, TONE_LEXICON.reassurance).length;
      const wordCount = tokens.length || 1;
      const reassuranceDensity = reassuranceCount / wordCount;
      if (reassuranceDensity < this.endingResolutionFloor) {
        flags.push(
          flag(
            "unresolved_ending",
            "medium",
            `closing reassurance density ${reassuranceDensity.toFixed(3)} below floor ${this.endingResolutionFloor}`,
            "Name the safety: home, held, loved, here. Resolve the emotional thread."
          )
        );
        score -= 14;
      }
    }

    return buildResult({
      validator: "bedtime-safety",
      level: "scene",
      score,
      threshold: this.sceneThreshold,
      flags,
      metrics: {
        isClosingScene,
        violent,
        loud,
        distressing
      }
    });
  }

  validateStory(scenes = [], storyContext = {}) {
    const flags = [];
    let score = 100;

    const sceneTexts = scenes.map((s) => (typeof s === "string" ? s : s.text || ""));
    const lastIdx = sceneTexts.length - 1;

    sceneTexts.forEach((text, idx) => {
      const tokens = tokenize(text);
      const violent = matchedTerms(tokens, BEDTIME_BANNED.violent);
      if (violent.length) {
        flags.push(
          flag(
            "story_violent_imagery",
            "high",
            `scene ${idx}: ${violent.join(", ")}`,
            "Story-level: any violent term is a hard reject."
          )
        );
        score -= 25;
      }
    });

    // Final-scene resolution check at story level too — closing sentence should not end on tension.
    if (lastIdx >= 0) {
      const sentences = splitSentences(sceneTexts[lastIdx]);
      const finalSentence = sentences[sentences.length - 1] || "";
      if (/[?!]$/.test(finalSentence) || /\b(but|until|then)\s/i.test(finalSentence)) {
        flags.push(
          flag(
            "tension_in_final_sentence",
            "medium",
            `final sentence: "${finalSentence}"`,
            "End on a declarative, settling sentence — no questions, no cliffhangers."
          )
        );
        score -= 10;
      }
    }

    return buildResult({
      validator: "bedtime-safety",
      level: "story",
      score,
      threshold: this.storyThreshold,
      flags,
      metrics: { sceneCount: sceneTexts.length }
    });
  }
}

export default BedtimeSafetyValidator;
