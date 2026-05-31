/**
 * Autonomous Error Recovery & Self-Healing System
 * 
 * Handles generation failures gracefully:
 * - Automatic retry with exponential backoff
 * - Fallback to safe stories if all attempts fail
 * - Detailed logging for monitoring
 * - Cost tracking and alerts
 */

const RECOVERY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 10000,
  COST_ALERT_THRESHOLD_USD: 50, // Alert if a single generation costs more than $50
};

let totalSpendThisHour = 0;
let lastHourReset = Date.now();

/**
 * Track spending and alert if threshold exceeded
 */
export function trackGenerationCost(costUSD, userId, storyName) {
  const now = Date.now();
  if (now - lastHourReset > 3600000) {
    totalSpendThisHour = 0;
    lastHourReset = now;
  }
  
  totalSpendThisHour += costUSD;
  
  // ONLY log if it's a critical cost issue (e.g. > $50 for one story or > $500/hour)
  if (costUSD > RECOVERY_CONFIG.COST_ALERT_THRESHOLD_USD) {
    console.error(`[CRITICAL_BUG] High-cost generation detected: $${costUSD.toFixed(2)} for story "${storyName}" (user: ${userId}). This may indicate a prompt injection or runaway loop.`);
  }
  
  if (totalSpendThisHour > 500) {
    console.error(`[CRITICAL_BUG] RUNAWAY SPEND: $${totalSpendThisHour.toFixed(2)} this hour. Emergency shutdown or investigation required.`);
  }
}

/**
 * Exponential backoff retry with jitter
 */
export async function retryWithBackoff(fn, context = {}) {
  const { userId, storyName, maxRetries = RECOVERY_CONFIG.MAX_RETRIES } = context;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // SILENT SUCCESS: No logging for successful retries
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        // ONLY log if it actually breaks the app after all retries
        console.error(`[CRITICAL_BUG] Story generation permanently failed for "${storyName}" after ${maxRetries} attempts. Error: ${error.message}`);
        throw error;
      }
      
      const backoffMs = Math.min(
        RECOVERY_CONFIG.INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1) + Math.random() * 1000,
        RECOVERY_CONFIG.MAX_BACKOFF_MS
      );
      
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
}

/**
 * Autonomous health check - runs periodically to ensure system is healthy
 */
export function performHealthCheck() {
  const heapUsedRatio = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;
  
  // ONLY log if there is a critical health issue
  if (heapUsedRatio > 0.9) {
    console.error(`[CRITICAL_BUG] Memory Leak Warning: System using ${(heapUsedRatio * 100).toFixed(1)}% of heap memory.`);
  }
  
  if (totalSpendThisHour > 400) {
    console.error(`[CRITICAL_BUG] Financial Health Warning: Hourly spend is at $${totalSpendThisHour.toFixed(2)}.`);
  }
}

/**
 * Generate a safe fallback story if all generation attempts fail
 */
export function generateSafeFallbackStory(childName, age) {
  const fallbackStories = [
    {
      title: `${childName}'s Cozy Dream`,
      content: `${childName} was nestled under a soft, warm blanket when a gentle breeze carried the scent of lavender through the window. Outside, the stars twinkled like tiny lanterns guiding the way to dreamland. ${childName} felt safe and loved, surrounded by the quiet comfort of the night. As sleep began to drift in like a soft cloud, ${childName} smiled, knowing tomorrow would bring new adventures. But for now, it was time to rest, to dream, and to let the peaceful darkness wrap around like the coziest hug. The world was gentle, and ${childName} was exactly where they needed to be.`,
    },
    {
      title: `${childName}'s Peaceful Garden`,
      content: `In a quiet garden where flowers bloomed in soft colors, ${childName} walked along a path lined with gentle lights. The air was warm and sweet, and with every step, ${childName} felt more and more calm. A soft voice whispered kind words, reminding ${childName} of all the wonderful things they had done today. The flowers seemed to nod in agreement, and the stars above began to twinkle in a slow, sleepy rhythm. ${childName} found a cozy spot beneath a willow tree and settled down, feeling wrapped in love and safety. Sleep came easily, like a gentle wave carrying ${childName} to the most beautiful dreams.`,
    },
  ];
  
  const story = fallbackStories[Math.floor(Math.random() * fallbackStories.length)];
  console.log(`[FALLBACK_STORY] Generated safe fallback for ${childName} (age ${age}): "${story.title}"`);
  return story;
}

/**
 * Log autonomous actions for monitoring and debugging
 */
export function logAutonomousAction(action, details) {
  const log = {
    timestamp: new Date().toISOString(),
    action,
    details,
  };
  console.log(`[AUTONOMOUS] ${JSON.stringify(log)}`);
}

export default {
  trackGenerationCost,
  retryWithBackoff,
  performHealthCheck,
  generateSafeFallbackStory,
  logAutonomousAction,
};
