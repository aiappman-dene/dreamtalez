// Bedtalez — Crashlytics Bridge
// Thin wrapper around @capacitor-firebase/crashlytics.
// Falls back to console-only on web/dev — no behaviour change in browser.
//
// SETUP REQUIRED (one-time, user action):
//   npm install @capacitor-firebase/crashlytics
//   npx cap sync android
//   Place google-services.json in android/app/
//
// iOS readiness: this wrapper requires no changes when iOS support is added.
//   The Capacitor plugin handles Android/iOS routing transparently.
//   iOS steps when ready:
//     npx cap add ios
//     npx cap sync ios
//     Place GoogleService-Info.plist in ios/App/App/
//     Add Firebase Crashlytics Run Script phase in Xcode (Build Phases)
//
// Privacy rules:
//   - Never log story text, child names, prompts, or parental data
//   - Log only: error type, sanitized message, stack frame count
//   - No custom keys that could identify a family

(function () {
  "use strict";

  // Prevent double-initialization if the script is somehow loaded twice.
  if (window.DreamCrash) return;

  // Platform detection — abstracted for Android / iOS / web compatibility.
  // Capacitor.getPlatform() returns "android", "ios", or "web".
  // Both native platforms use the same FirebaseCrashlytics plugin; the
  // underlying SDK (Android/iOS Firebase SDK) is selected at build time.
  const platform = window.Capacitor?.getPlatform?.() ?? "web";
  const isNative = (platform === "android" || platform === "ios") &&
    !!window.Capacitor?.Plugins?.FirebaseCrashlytics;

  const plugin = isNative ? window.Capacitor.Plugins.FirebaseCrashlytics : null;

  const DreamCrash = {
    /**
     * Enable crash collection. Called once on app boot.
     * No-op on web. Safe to call before Crashlytics is fully ready —
     * the native plugin queues the call internally.
     * iOS: identical call — plugin routes to Firebase iOS SDK automatically.
     */
    async initialize() {
      if (!plugin) return;
      try {
        await plugin.setEnabled({ enabled: true });
      } catch {}
    },

    /**
     * Record a non-fatal error.
     * @param {{ type: string, message: string, stack?: string|null }} entry
     */
    async recordError(entry) {
      if (!plugin) return;
      try {
        await plugin.recordException({
          message: `[${entry.type}] ${entry.message || "Unknown"}`.slice(0, 512),
        });
      } catch {}
    },

    /**
     * Log a non-identifying breadcrumb for crash context.
     * Only call with static strings — never with user data.
     * @param {string} message
     */
    async log(message) {
      if (!plugin) return;
      try {
        await plugin.log({ message: String(message).slice(0, 256) });
      } catch {}
    },

    /**
     * Set crash collection enabled/disabled.
     * Call with false to honour a user opt-out if ever implemented.
     * @param {boolean} enabled
     */
    async setEnabled(enabled) {
      if (!plugin) return;
      try {
        await plugin.setEnabled({ enabled: Boolean(enabled) });
      } catch {}
    },

    /**
     * Report a Capacitor plugin bridge failure as a non-fatal error.
     * Use when a native plugin call throws unexpectedly so bridge failures
     * surface in the Firebase Console without crashing the app.
     * @param {string} pluginName
     * @param {Error|unknown} err
     */
    async reportBridgeFailure(pluginName, err) {
      if (!plugin) return;
      const message = err instanceof Error ? err.message : String(err || "unknown");
      await this.recordError({
        type:    "bridge_failure",
        message: `Plugin ${pluginName}: ${message}`.slice(0, 512),
        stack:   err instanceof Error ? err.stack : null,
      });
    },
  };

  window.DreamCrash = DreamCrash;

  // Enable crash collection immediately on boot.
  // The native plugin queues this call safely if the SDK isn't fully ready yet.
  DreamCrash.initialize();
})();
