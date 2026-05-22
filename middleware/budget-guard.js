/**
 * Budget Guard
 *
 * Tracks estimated monthly AI spend in memory and blocks generation
 * if the emergency threshold is reached. Resets on server restart —
 * set a proper billing alert in Anthropic dashboard as the primary guard.
 *
 * addSpend(amount) is called by the AI service after each generation.
 */

import { RUNTIME_LIMITS } from "../config/runtime-limits.js";

let monthlySpend = 0;
let spendResetAt = startOfMonth();

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

/**
 * Add estimated spend (USD). Called after each successful generation.
 * @param {number} amount - Estimated cost in USD
 */
export function addSpend(amount) {
  // Auto-reset at month boundary
  if (Date.now() >= spendResetAt + 31 * 24 * 60 * 60 * 1000) {
    monthlySpend = 0;
    spendResetAt = startOfMonth();
  }
  monthlySpend += amount;
}

export function getMonthlySpend() {
  return monthlySpend;
}

/**
 * Express middleware. Blocks all generation requests when monthly
 * spend reaches the emergency threshold.
 */
export function budgetGuard(req, res, next) {
  if (monthlySpend >= RUNTIME_LIMITS.emergencyShutdownSpend) {
    console.error(`[BUDGET_GUARD] Emergency threshold reached: $${monthlySpend.toFixed(2)}`);
    return res.status(503).json({
      error: "Story generation temporarily unavailable. Please try again later.",
      reason: "budget_limit",
    });
  }
  next();
}

export default budgetGuard;
