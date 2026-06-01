# Bedtalez Environment & Deployment Audit

## Purpose
This document summarizes required environment variables, production readiness checks, and secret-handling guidance for Bedtalez.

## Environment Templates
- `local.env.example` — local development defaults and safe test values.
- `deploy.env.example` — production-ready structure for Render or other cloud deployments.
- `.env.example` — legacy general template for reference.

## Key Production Requirements
The server already includes a preflight guard that refuses to start in production unless:
- `NODE_ENV=production`
- `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY` is set and looks like a Claude key
- `ALLOWED_ORIGINS` is non-empty and explicitly lists production origins
- `REQUIRE_AUTH_FOR_AI_ROUTES=true`
- Firebase Admin credentials are configured via one of:
  - `GOOGLE_APPLICATION_CREDENTIALS`, or
  - `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`
- If `STRIPE_SECRET` is set, `STRIPE_WEBHOOK_SECRET` must also be set

## Required Variables
- `NODE_ENV` — should be `production` in production deploys
- `PORT` — defaults to `3001`
- `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY` — backend AI key
- `ALLOWED_ORIGINS` — comma-separated allowed app origins
- `REQUIRE_AUTH_FOR_AI_ROUTES` — production must be `true`
- `FIREBASE_PROJECT_ID` — project ID for token verification and Firestore
- `BASE_URL` — public app URL used by Stripe checkout redirect URLs

## Firebase Admin Configuration
Production supports either:
- `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`, or
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

The private key value must be stored with literal `\n` escapes if placed in an env var.

## Firebase Android Integration
- `android/app/google-services.json` is the expected Firebase config path for Android.
- `android/app/build.gradle` conditionally applies Firebase and Crashlytics only when `google-services.json` is present.
- `android/.gitignore` already excludes `*.jks`, `*.keystore`, `keystore.properties`, and comments out `google-services.json` to keep it out of source control.

## Crashlytics Integration
- `public/crashlytics.js` is a web-safe no-op bridge when the Capacitor plugin is not available.
- `public/error-boundary.js` reports only sanitized, non-identifying errors and forwards them to Crashlytics on native platforms.
- The repository now includes `@capacitor-firebase/crashlytics`, `@capacitor/core`, `@capacitor/android`, and `@capacitor/cli` so `npx cap sync android` can run locally.

## Firestore Index Required
- Create a composite index on `jobs` for `status ASC` and `createdAt ASC`.
- This index is needed by the server's stale job sweeper query.

## Stripe Configuration
- `STRIPE_SECRET` — required for payments
- `STRIPE_WEBHOOK_SECRET` — required if `STRIPE_SECRET` is configured
- `STRIPE_PRICE_SUBSCRIPTION`, `STRIPE_PRICE_ONEOFF`, `STRIPE_PRICE_PACK` — price IDs used by checkout

## Deployment Notes
- `render.yaml` already marks secret env vars as `sync: false`, which is correct.
- `RENDER_EXTERNAL_URL` should match your Render service URL or custom domain.
- `ALLOWED_ORIGINS` must include the exact HTTPS origins used by the frontend.

## Security Audit
- `.env` is currently ignored by `.gitignore` and should remain local only.
- A local untracked `.env` file was detected in the workspace; this is acceptable if it remains uncommitted.
- No secrets should be committed to the repo. Keep all API keys and private keys in deployment secret stores.
- Public frontend config in `public/firebase-init.js` is safe: Firebase client API keys are public by design.

## Recommended Workflow
1. Copy `local.env.example` to `.env` for local development.
2. Copy `deploy.env.example` into your cloud provider's secret manager for production.
3. Keep `.env` out of source control.
4. Use strong `ALLOWED_ORIGINS` and set `REQUIRE_AUTH_FOR_AI_ROUTES=true` in production.
5. If using Stripe, ensure `STRIPE_WEBHOOK_SECRET` is configured before enabling `STRIPE_SECRET`.
