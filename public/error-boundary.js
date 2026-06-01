// Bedtalez — Frontend Error Boundary
// Captures uncaught JS errors and unhandled promise rejections.
//
// Privacy rules:
//   - Never log story text or child names
//   - Never log auth tokens or Firebase credentials
//   - Strip URL params before reporting (may contain session data)
//   - Crash data stays in the console; structured reporting hooks
//     into Crashlytics when the Capacitor bridge is available.

(function () {
  "use strict";

  // Patterns that indicate sensitive content — skip reporting if matched.
  const SENSITIVE_PATTERNS = [
    /firebase.*token/i,
    /Bearer\s+\S+/i,
    /sk-ant/i,
    /password/i,
  ];

  // Deduplication: prevent flooding Crashlytics when a single bug causes
  // many rapid errors (e.g. render loops, recursive rejections).
  // Tracks fingerprints of recently reported errors in insertion order.
  const _recentFingerprints = new Set();
  const MAX_DEDUP_WINDOW = 10;   // evict oldest when window is full
  let _sessionErrorCount = 0;
  const MAX_ERRORS_PER_SESSION = 50; // hard cap per page lifetime

  function fingerprint(type, message) {
    return `${type}:${String(message).slice(0, 120)}`;
  }

  function isDuplicate(type, message) {
    const key = fingerprint(type, message);
    if (_recentFingerprints.has(key)) return true;
    _recentFingerprints.add(key);
    if (_recentFingerprints.size > MAX_DEDUP_WINDOW) {
      // Set iteration is insertion-ordered — evict the oldest entry.
      _recentFingerprints.delete(_recentFingerprints.values().next().value);
    }
    return false;
  }

  function isSensitive(str) {
    if (!str) return false;
    return SENSITIVE_PATTERNS.some((p) => p.test(str));
  }

  function sanitizeMessage(msg) {
    if (!msg) return "Unknown error";
    return String(msg).slice(0, 300).replace(/Bearer\s+\S+/gi, "[token]");
  }

  function sanitizeStack(stack) {
    if (!stack) return null;
    // Keep first 3 frames, strip query strings that may carry tokens.
    return stack
      .split("\n")
      .slice(0, 4)
      .map((l) => l.replace(/\?[^\s)]+/g, "?[params]"))
      .join("\n");
  }

  function report(type, message, stack, source) {
    if (isSensitive(message)) return;
    if (_sessionErrorCount >= MAX_ERRORS_PER_SESSION) return;
    if (isDuplicate(type, message)) return;

    _sessionErrorCount++;

    const entry = {
      type,
      message: sanitizeMessage(message),
      stack:   sanitizeStack(stack),
      source:  source ? String(source).split("?")[0] : null, // strip query params
      ts:      new Date().toISOString(),
    };

    console.error("[Bedtalez] Uncaught error:", entry);

    // Forward to Crashlytics bridge when running inside the Capacitor app.
    // Works on Android now; iOS uses the same call path when added later.
    if (window.DreamCrash?.recordError) {
      window.DreamCrash.recordError(entry).catch(() => {});
    }
  }

  window.addEventListener("error", (event) => {
    // Ignore cross-origin script errors — no useful diagnostic info.
    if (!event.error && event.message === "Script error.") return;
    report(
      "uncaught_error",
      event.error?.message || event.message,
      event.error?.stack,
      event.filename
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error
      ? reason.message
      : String(reason || "Unhandled rejection");
    report(
      "unhandled_rejection",
      message,
      reason instanceof Error ? reason.stack : null,
      null
    );
    // Suppress the browser's default "Uncaught (in promise)" console noise.
    event.preventDefault();
  });
})();
