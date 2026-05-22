/**
 * Queue Guard
 *
 * Global concurrent-request cap. Prevents overloading the generation
 * pipeline when traffic spikes. Complements the per-user activeRequests
 * guard already in server.js.
 *
 * Counter is decremented on response finish — leaked connections are
 * handled via the request-timeout middleware.
 */

import { RUNTIME_LIMITS } from "../config/runtime-limits.js";

let activeRequests = 0;

export function getActiveRequests() {
  return activeRequests;
}

/**
 * Express middleware — apply to API routes only.
 */
export function queueGuard(req, res, next) {
  if (activeRequests >= RUNTIME_LIMITS.maxConcurrentRequests) {
    return res.status(503).json({
      error: "Server is busy. Please try again in a moment.",
      reason: "queue_full",
    });
  }

  activeRequests++;

  const release = () => {
    activeRequests = Math.max(0, activeRequests - 1);
  };
  res.on("finish", release);
  res.on("close",  release);

  next();
}

export default queueGuard;
