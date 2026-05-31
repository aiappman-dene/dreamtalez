# DreamTalez TODO

## Phase 1 — Critical Production Blockers (user action required)
- [ ] Generate Android release keystore and back it up securely
- [ ] Fill android/keystore.properties from keystore output
- [ ] Download google-services.json from Firebase Console → android/app/
- [x] Place icon-192.png and icon-512.png in public/images/

> Repo validation note: Android release signing, Firebase Android wiring, Render deployment config, and Crashlytics integration wiring have been reviewed in the repo. External secret values and device-level validation are still required.
>
> Verified in code:
> - `android/app/build.gradle` conditionally applies Firebase and Crashlytics only when `google-services.json` exists.
> - `android/.gitignore` excludes `*.jks`, `*.keystore`, `keystore.properties`, and comments out `google-services.json`.
> - `render.yaml` is configured for production build/start/health and secret env var wiring.
> - `/health` endpoint exists in `server.js` and returns stable JSON.
> - `firestore.rules` locks server-only collections and owner-protects jobs.
> - `/.well-known/assetlinks.json` is implemented with `ANDROID_SHA256_FINGERPRINT`.
> - `public/crashlytics.js` is web-safe and no-op when the native plugin is unavailable.

## Crashlytics — Install & Validate (user action required)
1. [x] Install the Capacitor Crashlytics plugin:
       `npm install @capacitor-firebase/crashlytics`
       `npx cap sync android`
       (verified in repo)
   - `public/crashlytics.js` preserves web no-op behavior.
2. [ ] Ensure google-services.json is in android/app/ (already required above)
3. [ ] Build a release APK/AAB: `./gradlew assembleRelease` or `bundleRelease`
4. [ ] On a physical device, force a crash and confirm it appears in Firebase Console → Crashlytics
5. [ ] Confirm stack traces are readable (ProGuard deobfuscation enabled via mappingFileUploadEnabled)
6. [ ] Confirm no story text, child names, or tokens appear in Crashlytics reports
7. [ ] Confirm uncaught JS errors surface as non-fatal events (check error-boundary.js path)
8. [ ] Confirm unhandled promise rejections are captured and deduplicated

## Render Deployment (in order)
1. [ ] Push branch to GitHub (main)
2. [ ] Create Render web service — connect to GitHub repo, branch=main
3. [x] Set build command: `npm install --omit=dev` (verified in render.yaml)
4. [x] Set start command: `node server.js` (verified in render.yaml)
5. [x] Set health check path: `/health` (verified in render.yaml and server.js)
6. [x] Add all environment variables (see render.yaml for full list):
   - NODE_ENV=production
   - PORT=3001
   - ANTHROPIC_API_KEY=sk-ant-...
   - FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
   - STRIPE_SECRET=sk_live_..., STRIPE_WEBHOOK_SECRET=whsec_...
   - ALLOWED_ORIGINS=https://dreamtalez.onrender.com,https://dreamtalez.com
   - ANDROID_SHA256_FINGERPRINT (from release keystore)
     (render.yaml verified; secret values still required in Render dashboard)
7. [ ] Deploy — watch logs for boot validation output (should show ✅ AI configured, ✅ CORS origins)
8. [ ] Hit GET /health — should return `{"status":"ok","aiEnabled":true}` (verified in server.js code, live deployment still required)
9. [ ] Update Stripe webhook URL to Render domain + /stripe/webhook
10. [ ] Test one full story generation end-to-end in production

## Phase 2 — Remaining Code Work
- [x] Install @capacitor-firebase/crashlytics (steps above) — `npm install @capacitor-firebase/crashlytics && npx cap sync android`
- [x] Replace inline event handlers (onclick=) with addEventListener — complete (0 onclick= in production files)
- [ ] Split public/app.js into smaller modules (was ~10,870 lines → now 8,922 after i18n.js extracted)
  - [x] Phase 1: extracted i18n/translations → public/modules/i18n.js (1,955 lines)
  - [x] Phase 2: extracted story engine → public/modules/story-engine.js (4,598 lines) + utils.js (13 lines)
  - [x] Phase 3: extracted streaks, library, auth, children → 4 modules; shared state via app-state.js; toast via toast.js (app.js now ~3,464 lines)

## Phase 3 — Story Quality Audit
- [ ] Audit repetition patterns across all story modes (requires running live generations)
- [ ] Validate multilingual output quality (requires running live generations)
- [x] Benchmark generation latency by mode — timing now logged per stage (generate/edit/validate) and per job

## Phase 4 — Google Play Release
- [ ] Create Play Console listing
- [ ] Complete Data Safety form
- [ ] Complete IARC content rating
- [ ] Build signed production AAB: ./gradlew bundleRelease
- [ ] Upload to internal testing track

## iOS Foundation (future — when ready to ship iOS)
1. [ ] Initialize Capacitor iOS platform: `npx cap add ios`
2. [ ] Download GoogleService-Info.plist from Firebase Console → ios/App/App/
3. [ ] Open Xcode workspace: `npx cap open ios`
4. [ ] Add Firebase Crashlytics Run Script in Xcode Build Phases:
       `${BUILD_DIR%Build/*}SourcePackages/checkouts/firebase-ios-sdk/Crashlytics/run`
       Input Files: `$(SRCROOT)/$(BUILT_PRODUCTS_DIR)/$(INFOPLIST_PATH)`
5. [ ] Verify capacitor.config.json ios section is already populated (done)
6. [ ] Verify crashlytics.js platform detection covers "ios" (done — uses getPlatform())
7. [ ] Verify env(safe-area-inset-top) is set on .app-shell (done)
8. [ ] Test crash reporting on iOS simulator and device
9. [ ] Configure Apple App Attest for production (App Check) if required by Apple review
10. [ ] Review Stripe payment flow — App Store may require in-app purchase (IAP) for digital goods
        (web-based Stripe payments are acceptable for web-served content; native IAP rules may apply)
11. [ ] Complete App Store Connect listing, privacy labels, and age rating
12. [ ] Set up iOS signing certificates and provisioning profiles
13. [ ] Build release IPA: Product → Archive in Xcode
14. [ ] Upload to TestFlight before App Store submission

## Firestore Index Required
- jobs collection: composite index on (status, createdAt) — needed by the stale job sweeper query.
  Create at: Firebase Console → Firestore → Indexes → Composite → Add index
  Fields: status (Ascending), createdAt (Ascending)

## Known Architecture Notes
- validators/usage-validator.js: retained but not imported — see file header
- In-memory activeRequests Set: works on single instance, Firestore generationLocks handles multi-instance
- crashlytics.js: DreamCrash.reportBridgeFailure(pluginName, err) available for Capacitor plugin failures
- error-boundary.js: deduplication cap of 10 unique errors, session hard cap of 50 — prevents Crashlytics flooding
- iOS: no platform-specific code in app.js — platform abstraction is clean, iOS slots in without frontend changes
