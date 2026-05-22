/**
 * Family Magic Context Builder
 *
 * Extracts and normalises the family warmth layer from a child profile.
 * Returns a clean, safe object ready for runtime context injection.
 * All fields are guaranteed present — callers never need to null-check.
 */

export function buildFamilyMagicContext(profile = {}) {
  const fm = profile.familyMagic || {};

  return {
    enabled:              Boolean(fm.enabled),
    familyMembers:        Array.isArray(fm.familyMembers) ? fm.familyMembers.slice(0, 6) : [],
    comfortItems:         Array.isArray(fm.comfortItems)  ? fm.comfortItems.slice(0, 4)  : [],
    favoriteCozyFeeling:  String(fm.favoriteCozyFeeling  || ""),
    favoriteMagicalPlace: String(fm.favoriteMagicalPlace || ""),
  };
}

export default buildFamilyMagicContext;
