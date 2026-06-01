/**
 * Premium Quality Validator
 *
 * Final gate: confirms the story meets Bedtalez premium output standard
 * across five dimensions. This validator is more holistic than the individual
 * Phase 3/4 validators — it looks at the story as a complete product.
 *
 * Designed to catch stories that pass individual checks but still feel
 * "off" — too generic, too flat, emotionally hollow, or poorly integrated
 * with Family Magic context.
 *
 * Returns { passed, warnings, score }
 */

const EMOTIONAL_ANCHORS = [
  "brave", "kind", "loved", "safe", "wonder", "magical", "cozy", "cosy",
  "warm", "gentle", "home", "together", "belong", "courage", "smile",
  "laugh", "comfort", "peace", "dream",
];

const GENERIC_OPENERS = [
  "once upon a time",
  "there was a child named",
  "there once was a",
  "in a land far away",
  "long long ago",
];

const PROSE_SMOOTHNESS_DISRUPTORS = [
  "suddenly",
  "all of a sudden",
  "out of nowhere",
  "without warning",
  "everything changed instantly",
];

const FAMILY_MAGIC_INTEGRATION_SIGNALS = [
  "family", "together", "home", "warm", "loved", "safe", "belong",
  "heart", "hug", "smile", "gentle", "caring",
];

/**
 * @param {string} story
 * @param {{ hasFamilyMagic?: boolean, childName?: string }} opts
 * @returns {{ passed: boolean, warnings: object[], score: number }}
 */
export class PremiumQualityValidator {
  validate(story = "", { hasFamilyMagic = false, childName = "" } = {}) {
    const warnings = [];
    const lower = story.toLowerCase();

    // 1. Generic opener check
    const genericOpener = GENERIC_OPENERS.find((g) => lower.startsWith(g.toLowerCase()));
    if (genericOpener) {
      warnings.push({
        type:     "generic_opener",
        severity: "medium",
        evidence: `Story opens with generic phrase: "${genericOpener}"`,
      });
    }

    // 2. Emotional anchor density
    const anchorHits = EMOTIONAL_ANCHORS.filter((a) => lower.includes(a)).length;
    if (anchorHits < 4) {
      warnings.push({
        type:     "low_emotional_anchor_density",
        severity: "low",
        evidence: `Only ${anchorHits} emotional anchors found — premium Bedtalez stories carry at least 4`,
      });
    }

    // 3. Prose smoothness — disruptors in second half
    const midpoint = Math.floor(story.length / 2);
    const secondHalf = story.slice(midpoint).toLowerCase();
    const disruptorsFound = PROSE_SMOOTHNESS_DISRUPTORS.filter((d) => secondHalf.includes(d));
    if (disruptorsFound.length > 1) {
      warnings.push({
        type:     "prose_smoothness_disrupted",
        severity: "low",
        evidence: `${disruptorsFound.length} abrupt transition markers in second half: "${disruptorsFound.join('", "')}"`,
      });
    }

    // 4. Child name presence — must appear at least 3 times
    if (childName) {
      const nameRegex = new RegExp(`\\b${childName.toLowerCase()}\\b`, "gi");
      const nameCount = (story.match(nameRegex) || []).length;
      if (nameCount < 3) {
        warnings.push({
          type:     "child_underrepresented",
          severity: "low",
          evidence: `Child's name appears only ${nameCount} time(s) — should feel central to the story`,
        });
      }
    }

    // 5. Family Magic integration check
    if (hasFamilyMagic) {
      const fmHits = FAMILY_MAGIC_INTEGRATION_SIGNALS.filter((s) => lower.includes(s)).length;
      if (fmHits < 3) {
        warnings.push({
          type:     "weak_family_magic_integration",
          severity: "low",
          evidence: `Family Magic story has only ${fmHits} family warmth signals — emotional integration feels thin`,
        });
      }
    }

    // 6. Ending presence check — story must end, not cut off
    const lastChars = story.slice(-200).trim();
    const hasProperEnding = /[.!?]['"]?\s*$/.test(lastChars);
    if (!hasProperEnding) {
      warnings.push({
        type:     "incomplete_ending",
        severity: "high",
        evidence: "Story appears to end mid-sentence or without terminal punctuation",
      });
    }

    const highSeverity = warnings.filter((w) => w.severity === "high").length;
    const mediumSeverity = warnings.filter((w) => w.severity === "medium").length;

    // Score: start at 100, deduct for issues
    const score = Math.max(0, 100 - (highSeverity * 30) - (mediumSeverity * 10) - (warnings.length * 3));

    return {
      passed:   highSeverity === 0 && mediumSeverity === 0,
      warnings,
      score,
    };
  }
}

export default PremiumQualityValidator;
