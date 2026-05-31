/**
 * Usage Validator — NOT CURRENTLY IMPORTED
 *
 * Subscription and credit validation is handled inline by consumeStory()
 * in server.js, which reads live Firestore state atomically.
 *
 * This file is retained as a reference for future extraction if consumeStory()
 * is ever refactored into a standalone service. Delete if that never happens.
 */

import { RUNTIME_LIMITS } from "../config/runtime-limits.js";

/**
 * @param {{ storyCount: number, subscription: { limit: number, status: string } }} opts
 * @throws {Error} When the monthly story limit is reached
 * @returns {true}
 */
export function validateStoryLimits({ storyCount, subscription }) {
  const limit = subscription?.limit ?? RUNTIME_LIMITS.storiesPerMonth;
  const status = subscription?.status ?? "inactive";

  if (status === "inactive" || status === "cancelled") {
    throw new Error("No active subscription");
  }

  if (storyCount >= limit) {
    throw new Error(`Monthly story limit reached (${storyCount}/${limit})`);
  }

  return true;
}

export default validateStoryLimits;
