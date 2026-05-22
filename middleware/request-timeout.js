/**
 * Request Timeout
 *
 * Closes long-hanging requests before they consume a generation slot
 * indefinitely. Applied to API routes only — never to static assets.
 *
 * Default: 30 000 ms (matches RUNTIME_LIMITS.maxGenerationSeconds).
 */

import { RUNTIME_LIMITS } from "../config/runtime-limits.js";

const DEFAULT_MS = RUNTIME_LIMITS.maxGenerationSeconds * 1000;

/**
 * @param {number} [ms] - Timeout in milliseconds
 * @returns Express middleware
 */
export function requestTimeout(ms = DEFAULT_MS) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: "Story generation timed out. Please try again.",
          reason: "timeout",
        });
      }
    }, ms);

    res.on("finish", () => clearTimeout(timer));
    res.on("close",  () => clearTimeout(timer));

    next();
  };
}

export default requestTimeout;
