# Render Deployment — Checklist (operational)

1) Pre-deploy (copy these env vars into Render secrets)

- `NODE_ENV=production`
- `PORT=3001`
- `BASE_URL=https://bedtalez.onrender.com`
- `RENDER_EXTERNAL_URL=https://bedtalez.onrender.com`
- `ALLOWED_ORIGINS=https://bedtalez.onrender.com,https://www.bedtalez.com`
- `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY` (your AI provider key)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (with newlines escaped; see `deploy.env.example`)
- `STRIPE_SECRET` (live)
- `STRIPE_WEBHOOK_SECRET` (from Stripe dashboard)
- `ANDROID_SHA256_FINGERPRINT` (from your release keystore)
- `GOOGLE_APPLICATION_CREDENTIALS` (optional if using a mounted service account file)

2) Webhook setup

- Set Stripe webhook endpoint to: `https://<RENDER_EXTERNAL_URL>/stripe/webhook`
- In Stripe, add the webhook and copy the signing secret into `STRIPE_WEBHOOK_SECRET` in Render.

3) Health & readiness

- Ensure Render `healthCheckPath` is `/health`.
- After deploy, verify:

```bash
curl -sSf https://bedtalez.onrender.com/health | jq .
```

- Expected response (example): `{"status":"ok","aiEnabled":true}` — AI-enabled will be `true` only when the AI key is set and validated by the server.

4) Deploy flow

- Push `main` branch to GitHub.
- Create or update Render service (connect GitHub repo, branch `main`).
- Fill all env secrets above. Save and deploy.
- Tail logs (`Render dashboard` or `renderctl logs`) and watch for server boot lines: CORS origins, AI configured, and successful health binding.

5) Post-deploy verification

- Check `/health` (see above).
- Test a real user flow: sign in (if auth required) and run a single story generation to ensure AI and Firebase work.
- Verify Stripe webhooks are received (use `stripe events list` or monitor logs).

6) Rollback & safety

- If deploy fails, roll back via Render dashboard to the previous revision.
- Keep a checklist of env values used; rotate any compromised keys immediately.
