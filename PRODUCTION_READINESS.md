# Bedtalez Production Readiness Checklist

This checklist captures the final production wiring, deployment readiness, Android release preparation, Firebase integration, Crashlytics validation, and operational safety checks for Bedtalez.

## 1. Android release signing
- [ ] Generate Android release keystore (`bedtalez-release.jks`).
- [ ] Store keystore securely offline.
- [ ] Add `android/keystore.properties` with:
  - `storeFile`
  - `storePassword`
  - `keyAlias`
  - `keyPassword`
- [ ] Confirm `android/app/build.gradle` uses `keystore.properties` for `release` signing.
- [ ] Confirm `android/.gitignore` excludes:
  - `*.jks`
  - `*.keystore`
  - `keystore.properties`
- [ ] Confirm `google-services.json` is ignored in source control.

## 2. Firebase Android integration
- [ ] Place `android/app/google-services.json` in the Android app folder.
- [ ] Confirm `android/app/build.gradle` conditionally applies Firebase and Crashlytics only when `google-services.json` exists.
- [ ] Confirm Firebase Android identity files are not committed.

## 3. Crashlytics integration
- [x] Installed `@capacitor-firebase/crashlytics`.
- [x] Added Capacitor platform dependencies:
  - `@capacitor/core`
  - `@capacitor/android`
  - `@capacitor/cli`
- [x] `npx cap sync android` succeeded.
- [ ] Validate native crash reports on a physical Android device.
- [ ] Confirm `public/crashlytics.js` remains web-safe no-op when plugin is unavailable.
- [ ] Confirm `public/error-boundary.js` sanitizes errors and does not log sensitive data.

## 4. Render deployment readiness
- [x] Confirm `render.yaml` contains production wiring and secret env vars.
- [x] Confirm `/health` endpoint is implemented and returned healthy JSON.
- [x] Confirm production preflight checks in `server.js` cover:
  - AI key
  - Firebase admin credentials
  - explicit `ALLOWED_ORIGINS`
  - `REQUIRE_AUTH_FOR_AI_ROUTES=true`
  - Stripe webhook secret when Stripe is enabled
- [ ] Deploy to Render and verify logs show:
  - `✅ AI configured`
  - `✅ CORS origins:`
- [ ] Confirm `BASE_URL` and `RENDER_EXTERNAL_URL` are set correctly for the Render deployment URL.

## 5. Android verification + Digital Asset Links
- [x] Confirm `/.well-known/assetlinks.json` is served by `server.js`.
- [ ] Confirm `ANDROID_SHA256_FINGERPRINT` is set from the release keystore.
- [ ] Confirm assetlinks JSON response structure is valid for Android verification.

## 6. Environment separation
- [x] Confirm `local.env.example` exists.
- [x] Confirm `deploy.env.example` exists.
- [x] Confirm `ENVIRONMENT.md` documents production startup requirements.
- [x] Confirm `.env` is ignored and untracked by git.
- [ ] Confirm no secret values are committed to the repo.

## 7. Firestore operational readiness
- [x] Confirm `firestore.rules` locks server-only collections.
- [x] Confirm `jobs` collection is owner-read-only.
- [x] Confirm `stripeEvents`, `guestOneoffClaims`, `userRateLimits`, and `generationLocks` are server-only.
- [ ] Create the Firestore composite index:
  - collection: `jobs`
  - fields: `status ASC`, `createdAt ASC`

## 8. Production startup safety
- [x] Confirm production boot refuses unsafe states.
- [x] Confirm missing critical secrets fail fast.
- [ ] Confirm logs do not expose secret values in Render or production logs.

## 9. Runtime sanity review
- [ ] Confirm service worker registration works and updates cleanly.
- [ ] Confirm Firebase singleton behavior is stable across app lifecycle.
- [ ] Confirm auth synchronization is stable and respects app state.
- [ ] Confirm polling stability and `visibilitychange` recovery behavior.
- [ ] Confirm offline fallback and reconnect handling remain calm and private.
- [ ] Confirm Crashlytics initialization timing is safe on Android.

## Notes
- Preserve the existing privacy-first, backend-authoritative, calm bedtime UX.
- Do not redesign architecture, add new frameworks, or rewrite the frontend.
- Focus only on reliability, operational safety, deployment stability, and long-term maintainability.
