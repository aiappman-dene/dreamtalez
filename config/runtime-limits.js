/**
 * Runtime Limits
 *
 * Single source of truth for all server-level caps.
 * Story content limits live in story-engine/config/story-limits.js.
 */

export const RUNTIME_LIMITS = {
  // Story generation budget
  storiesPerMonth:         40,
  defaultStoryMaxWords:    900,
  familyMagicMaxWords:     900,

  // Pipeline caps — prevent infinite loops
  maxValidationPasses:     2,
  maxRefinementPasses:     1,
  maxGenerationSeconds:    30,
  maxTokensPerStory:       14000,

  // Server concurrency
  maxConcurrentRequests:   3,

  // Emergency budget shutoff (USD/month)
  emergencyShutdownSpend:  100,

  // Per-IP rate limit (requests per hour)
  rateLimitPerHour:        20,

  // Retry budget for failed generations
  retryLimit:              2,
};

export default RUNTIME_LIMITS;
