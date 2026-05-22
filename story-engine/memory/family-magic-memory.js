/**
 * Family Magic Memory
 *
 * Tracks recurring comfort items, cozy patterns, and family moments
 * within a story generation session. Populated from a child's saved
 * familyMagic profile — no new DB writes needed for Phase 2.
 *
 * Designed to be constructed fresh per story and seeded from Firestore
 * profile data, giving the appearance of cross-story continuity without
 * requiring a persistent store at this phase.
 */

export class FamilyMagicMemory {
  constructor() {
    this.recurringItems   = [];
    this.cozyPatterns     = [];
    this.familyCallbacks  = [];
  }

  /** Seed from a child's saved familyMagic profile (idempotent) */
  static fromProfile(familyMagic = {}) {
    const memory = new FamilyMagicMemory();

    (familyMagic.comfortItems || []).forEach((item) => memory.rememberComfortItem(item));

    const cozyFeeling  = familyMagic.favoriteCozyFeeling;
    const magicalPlace = familyMagic.favoriteMagicalPlace;
    if (cozyFeeling)  memory.rememberCozyPattern(cozyFeeling);
    if (magicalPlace) memory.rememberCozyPattern(magicalPlace);

    (familyMagic.familyMembers || []).forEach((m) => {
      if (m.name && m.relationship) {
        memory.rememberFamilyMoment(`${m.relationship} (${m.name})`);
      }
    });

    return memory;
  }

  rememberComfortItem(item) {
    if (item && !this.recurringItems.includes(item)) {
      this.recurringItems.push(item);
    }
  }

  rememberCozyPattern(pattern) {
    if (pattern && !this.cozyPatterns.includes(pattern)) {
      this.cozyPatterns.push(pattern);
    }
  }

  rememberFamilyMoment(moment) {
    if (moment) this.familyCallbacks.push(moment);
  }

  getContinuityContext() {
    return {
      recurringItems:  this.recurringItems,
      cozyPatterns:    this.cozyPatterns,
      familyCallbacks: this.familyCallbacks.slice(-5),
    };
  }

  /** True if enough context exists to produce meaningful continuity */
  hasContext() {
    return (
      this.recurringItems.length > 0 ||
      this.cozyPatterns.length   > 0 ||
      this.familyCallbacks.length > 0
    );
  }
}

export default FamilyMagicMemory;
