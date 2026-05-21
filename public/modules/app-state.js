// =============================================================================
// Shared application state — single mutable object imported by all modules.
// All modules get the same reference; property mutations are visible everywhere.
// =============================================================================

export const state = {
  // Firebase user
  currentUser: null,

  // Cached Firestore data
  cachedChildren: [],
  cachedStreaks: {},
  cachedLibrary: [],
  cachedSeries: {},         // { [childName]: { nightCount, lastTitle, lastSummary, lastSavedAt } }
  cachedTrial: null,        // { startedAt, storiesUsed, status: "active"|"expired"|"paid" }
  cachedContinuation: null, // { title, summary, childName, mode, savedAt, emotionalTone, recurringCharacters, ageBand }

  // Preferences
  cachedDialect: "en-GB",
  cachedIsPremium: false,
  cachedStoriesRemaining: 0,

  // Session
  guestOneoffSessionId: null,
  selectedChildIndex: 0,

  // Navigation
  currentPage: "home",
  previousPage: "home",

  // Current story
  currentStoryTitle: "",
  currentStoryText: "",
  currentStoryChildName: "",
  currentStoryMode: "",
  currentStoryAgeBand: "",
  currentStoryIsOneoff: false, // true when generated using a 99p one-off credit (blocks continuation)

  // Generation guards
  isGenerating: false,
  generationInProgress: false,
  lastGenerationTime: 0,
};
