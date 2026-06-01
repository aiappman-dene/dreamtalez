# RELEASE — Bedtalez Cutover & Launch Runbook

Scope: concise, sequential operational checklist to launch Bedtalez without code changes. Follow steps in order.

1) Preflight — required before any build
- Confirm `.env` local secrets are NOT committed and `deploy.env.example` is copied to your host secrets store.
- Confirm `android/.gitignore` excludes keystore and `google-services.json`.
- Confirm `android/app/packageId` is `com.bedtalez.app` (see `capacitor.config.json`).

2) Android signing (create & secure keystore)
- Generate release keystore (example):

```bash
keytool -genkeypair -v \
  -keystore bedtalez-release.jks \
  -alias bedtalez \
  -keyalg RSA -keysize 2048 -validity 10000
```

- Move the JKS to a secure vault (e.g., `~/secrets/bedtalez/`), never commit.
- Create `android/keystore.properties` with `storeFile`, `storePassword`, `keyAlias`, `keyPassword`.
- Backup the JKS and `keystore.properties` in an encrypted backup (1Password/Bitwarden/secure S3 with KMS).

3) Compute SHA256 fingerprint (for Firebase & assetlinks)
- Use provided helpers or keytool directly:

```bash
./scripts/compute_sha256.sh path/to/bedtalez-release.jks bedtalez
# or on Windows PowerShell
./scripts/compute_sha256.ps1 -KeystorePath path\to\bedtalez-release.jks -Alias bedtalez
```

- Place the resulting colon-separated SHA256 string into your deploy secrets as `ANDROID_SHA256_FINGERPRINT`.

4) Firebase Android setup
- In Firebase Console, add an Android app with package `com.bedtalez.app`.
- Upload `google-services.json` to `android/app/google-services.json` (do not commit).
- Register the SHA-256 fingerprint in Firebase project settings for that Android app.

5) Render deployment — secrets & env vars
- Required secrets (copy into Render / host):

```
NODE_ENV=production
PORT=3001
BASE_URL=https://bedtalez.onrender.com
RENDER_EXTERNAL_URL=https://bedtalez.onrender.com
ALLOWED_ORIGINS=https://bedtalez.onrender.com,https://www.bedtalez.com
ANTHROPIC_API_KEY (or CLAUDE_API_KEY)
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY  # newlines escaped per deploy.env.example
STRIPE_SECRET
STRIPE_WEBHOOK_SECRET
ANDROID_SHA256_FINGERPRINT
```

- Set Render `build` to `npm install --omit=dev` and `start` to `node server.js` (already in `render.yaml`).
- Set the Render health check to `/health`.

6) Stripe webhook setup
- Add webhook in Stripe: `https://<RENDER_EXTERNAL_URL>/stripe/webhook` and copy the signing secret to `STRIPE_WEBHOOK_SECRET`.

7) Deploy flow
- Push `main` to GitHub, trigger Render deploy.
- Monitor logs from Render for startup lines: CORS origins, AI configured, Firebase credentials present.

8) Post-deploy verification
- Check health endpoint:

```bash
curl -sS https://bedtalez.onrender.com/health | jq .
```

- Expected: `{"status":"ok", ...}` and `aiEnabled` `true` if AI key present.
- Run a smoke test: generate one story end-to-end from an internal test account.
- Confirm Stripe webhook events are received (check logs for `/stripe/webhook` handling).

9) Crashlytics validation (privacy-safe)
- Ensure `android/app/google-services.json` is present during release build.
- Build a signed release AAB: `./gradlew bundleRelease`.
- Install to internal test device / internal test track.
- Trigger synthetic native crash (see `docs/CRASHLYTICS_VALIDATION.md`) on a test device.
- Verify crash appears in Firebase Console → Crashlytics within a few minutes.

10) Play Console prep & internal testing
- Create Play Console listing (title, description, assets). Use `scripts/generate-icons.html` for Play assets.
- Complete Data Safety & Content rating forms.
- Upload AAB to internal testing track; invite testers.
- Run internal test checklist: install, sign in, generate story, make purchase flow (if applicable), verify logs and crash reports.

11) Release verification & cutover checks
- Confirm production logs show healthy requests and AI responses.
- Confirm no PII sent to Crashlytics (check sampling logs & error-boundary behaviour).
- Verify analytics, retention events, and billing flows (Stripe) for a sample action.

12) Rollout & monitoring
- Promote from internal to open testing / staged rollout.
- Monitor Crashlytics, logs, and Stripe for 24–72 hours.
- Keep rollback plan ready (Render rollback or Play Console deactivation).

Appendix — quick command references
- Build release (Android): `./gradlew bundleRelease`
- Compute SHA256: `./scripts/compute_sha256.sh path/to/jks alias`
- Health check: `curl -sS https://bedtalez.onrender.com/health`

Keep this runbook as the canonical cutover checklist. Avoid making app code changes during the cutover; perform configuration and secret updates only.
