/**
 * Retention Intelligence
 *
 * Extracts patterns from story generation events to support long-term
 * engagement analysis. All tracking is session-local and structural —
 * no story text is stored, no personally identifying information is retained
 * beyond what Firestore already holds for the child profile.
 *
 * Returns structured event objects suitable for logging or Firestore writes.
 */

/**
 * Build a story completion event for analytics logging.
 *
 * @param {{
 *   childName: string,
 *   mode: string,
 *   ageGroup: number,
 *   lengthType: string,
 *   qualityScores: object,
 *   hasFamilyMagic: boolean,
 *   comfortAnchorsUsed: string[],
 *   bedtimeHour: number,
 *   generationMs: number,
 *   language: string,
 * }} opts
 * @returns {object} Analytics event
 */
export function buildStoryCompletionEvent({
  childName,
  mode,
  ageGroup,
  lengthType,
  qualityScores,
  hasFamilyMagic,
  comfortAnchorsUsed,
  bedtimeHour,
  generationMs,
  language,
} = {}) {
  return {
    event:            "story_completed",
    ts:               Date.now(),
    mode:             mode || "unknown",
    ageGroup:         ageGroup || null,
    lengthType:       lengthType || "medium",
    hasFamilyMagic:   Boolean(hasFamilyMagic),
    comfortAnchorCount: Array.isArray(comfortAnchorsUsed) ? comfortAnchorsUsed.length : 0,
    bedtimeHour:      typeof bedtimeHour === "number" ? bedtimeHour : null,
    generationMs:     typeof generationMs === "number" ? generationMs : null,
    language:         language || "en-GB",
    qualityOverall:   qualityScores?.overall ?? null,
    qualityWarmth:    qualityScores?.scores?.emotionalWarmth ?? null,
    qualitySoftness:  qualityScores?.scores?.bedtimeSoftness ?? null,
    // childName is intentionally excluded from analytics payload
  };
}

/**
 * Classify a mode into a retention category for cohort analysis.
 *
 * @param {string} mode
 * @returns {string}
 */
export function classifyEngagementTier(mode) {
  const tiers = {
    "family-magic": "deep",      // highest continuity intent
    "hero":         "personal",
    "custom":       "personal",
    "today":        "reflective",
    "therapeutic":  "emotional",
    "sleepy":       "passive",
    "random":       "exploratory",
    "medium-surprise": "exploratory",
    "long-surprise":   "exploratory",
  };
  return tiers[mode] || "exploratory";
}

/**
 * Identify which comfort anchors were referenced in the story.
 * Used to track which anchors resonate for future story seeding.
 *
 * @param {string} storyText
 * @param {string[]} comfortItems
 * @returns {string[]} Items found in the story
 */
export function extractUsedComfortAnchors(storyText, comfortItems = []) {
  if (!storyText || !comfortItems.length) return [];
  const lower = storyText.toLowerCase();
  return comfortItems.filter((item) =>
    item && lower.includes(item.toLowerCase().trim())
  );
}

export default { buildStoryCompletionEvent, classifyEngagementTier, extractUsedComfortAnchors };
