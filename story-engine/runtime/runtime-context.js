/**
 * Runtime Context Builder
 *
 * Assembles the lean runtime context object passed to Sonnet for story
 * generation. This is separate from the full framework system prompt —
 * the context carries per-request personalisation (child profile, family
 * magic, adaptive state). The frameworks carry the locked quality system.
 *
 * @param {{
 *   childProfile: object,
 *   storyRequest: object,
 *   adaptiveState?: object,
 * }} opts
 * @returns {object} Runtime context
 */
export function buildRuntimeContext({ childProfile = {}, storyRequest = {}, adaptiveState = {} } = {}) {
  return {
    child: {
      name:       childProfile.name       || "the child",
      age:        childProfile.age        || 5,
      pronoun:    childProfile.gender     || null,
      interests:  childProfile.interests  || null,
      appearance: childProfile.appearance || null,
    },

    favoriteThemes:    childProfile.interests    ? [childProfile.interests] : [],
    language:          childProfile.language     || "en-GB",
    dialect:           childProfile.dialect      || "en-GB",

    familyMagic: childProfile.familyMagic?.enabled
      ? {
          enabled:            true,
          familyMembers:      childProfile.familyMagic.familyMembers      || [],
          comfortItems:       childProfile.familyMagic.comfortItems       || [],
          favoriteCozyFeeling:childProfile.familyMagic.favoriteCozyFeeling || null,
          favoriteMagicalPlace:childProfile.familyMagic.favoriteMagicalPlace|| null,
        }
      : { enabled: false },

    storyRequest: {
      mode:          storyRequest.mode       || "random",
      customIdea:    storyRequest.customIdea || null,
      dayBeats:      storyRequest.dayBeats   || null,
      childWish:     storyRequest.childWish  || null,
      length:        storyRequest.length     || "medium",
    },

    adaptiveState: {
      bedtimeHour:            adaptiveState.bedtimeHour            || new Date().getHours(),
      sleepinessLevel:        adaptiveState.sleepinessLevel        || 2,
      previousIntensity:      adaptiveState.previousStoryIntensity || 2,
      ageBand:                adaptiveState.ageBand                || "preschool",
    },

    emotionalGoal: "warm_cinematic_bedtime",
    systemVersion: "1.0.0",
  };
}

export default buildRuntimeContext;
