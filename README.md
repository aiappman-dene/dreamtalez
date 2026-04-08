# DreamTalez

A Node.js + Express app for generating calming, personalised bedtime stories for children, with Anthropic on the backend and a stronger procedural fallback when AI is unavailable.

## Project Structure

```
AI-Dene-Bedtime-Stories
│
├ server.js
├ package.json
├ .env.example
│
├ public
│   ├ index.html
│   ├ style.css
│   ├ app.js
│   └ images
│
├ prompts.js
├ story-quality.js
├ scripts
│   ├ qa-backend-quality.mjs
│   ├ qa-procedural-regressions.mjs
│   └ qa-story-samples.mjs
│
└ README.md
```

### Explanation:

- **server.js**: Runs the backend, applies security middleware, and calls Anthropic.
- **package.json**: Node project configuration.
- **.env.example**: Template for local environment variables.
- **public/**: Everything the user sees in the browser or Android WebView.
  - **index.html**: The UI for the app.
  - **style.css**: Design and layout.
  - **app.js**: Handles all frontend interactivity and logic.
  - **images/**: (Optional) Image assets for the app.
- **prompts.js**: AI system and user prompt builder logic.
- **story-quality.js**: Local output cleanup and quality guards.
- **scripts/**: QA gates used before release.

## Setup
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`
3. Set `ANTHROPIC_API_KEY` in `.env`
4. Optional: set `AI_PIPELINE_PROFILE=full` when you want the highest-quality multi-pass AI pipeline and have Anthropic credits available
5. Start the server: `npm start`
6. Open `http://localhost:3000`

## Environment

- `ANTHROPIC_API_KEY`: Required for AI story generation and AI polishing.
- `PORT`: Local server port. Defaults to `3000`.
- `NODE_ENV`: `development` or `production`.
- `AI_PIPELINE_PROFILE`: `lean` for lower Anthropic usage, `full` for the full multi-pass pipeline.
- `ALLOWED_ORIGINS`: Comma-separated list of allowed browser origins.

## Launch Checklist

1. Run `npm run qa` and confirm all three QA stages pass.
2. Start the app with `npm start` and confirm `http://localhost:3000/health` returns `status: ok`.
3. Smoke test Quick Story, Story from Today, and Hero Story in the browser.
4. If you want the best AI output quality at launch, restore Anthropic credits and set `AI_PIPELINE_PROFILE=full`.
5. For long Hero stories, use the `Long` option. The AI path now targets roughly a 10-minute read-aloud when credits are available.
