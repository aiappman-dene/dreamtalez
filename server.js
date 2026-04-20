// =============================================================================
// DreamTalez — Server
// AI-powered bedtime story generator for children aged 2–12
// =============================================================================

import express from "express";
import cors from "cors";
import "dotenv/config";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { applicationDefault, cert, getApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { body, validationResult } from "express-validator";
import fs from "fs";
import https from "https";
import crypto from "crypto";
import path from "path";
import {
  STORY_SYSTEM_PROMPT,
  EDITOR_SYSTEM_PROMPT,
  VALIDATOR_SYSTEM_PROMPT,
  DELIVERY_QA_SYSTEM_PROMPT,
  REWRITE_SYSTEM_PROMPT,
  buildStoryPrompt,
  buildGrammarPrompt,
  buildValidationPrompt,
  buildDeliveryQaPrompt,
  buildTitlePrompt,
  resolveLanguageCode,
} from "./prompts.js";
import {
  normalizeStoryLocale,
  isSupportedStoryLocale,
  normalizeStoryOutput,
  detectStoryQualityIssues,
  assertStoryQuality,
  isStoryValid,
} from "./story-quality.js";
import { createCheckoutSession } from "./stripe.js";

// =============================================================================
// Config
// =============================================================================

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const AI_ENABLED = !!API_KEY;
const NODE_ENV = process.env.NODE_ENV || "development";
const AI_PIPELINE_PROFILE = process.env.AI_PIPELINE_PROFILE === "full" ? "full" : "lean";
const USE_FULL_AI_PIPELINE = AI_PIPELINE_PROFILE === "full";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());
const REQUIRE_AUTH_FOR_AI_ROUTES = process.env.REQUIRE_AUTH_FOR_AI_ROUTES === "true";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "";
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || "";
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : "";
const GENERATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const GENERATE_LIMIT_MAX = Number(process.env.GENERATE_RATE_LIMIT_MAX || 20);
const POLISH_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const POLISH_LIMIT_MAX = Number(process.env.POLISH_RATE_LIMIT_MAX || 20);
const PUBLIC_DIR = path.join(process.cwd(), "public");

function hasFirebaseAdminConfig() {
  const hasServiceAccount = FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY;
  const hasApplicationDefault = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasProjectIdOnly = !!FIREBASE_PROJECT_ID;
  return hasServiceAccount || hasApplicationDefault || hasProjectIdOnly;
}

if (!AI_ENABLED) {
  console.warn("AI key not configured. Server will start in procedural-only mode until ANTHROPIC_API_KEY or CLAUDE_API_KEY is set.");
}

if (REQUIRE_AUTH_FOR_AI_ROUTES) {
  if (!hasFirebaseAdminConfig()) {
    console.error("FATAL: REQUIRE_AUTH_FOR_AI_ROUTES=true requires Firebase Admin configuration via GOOGLE_APPLICATION_CREDENTIALS, full service-account env vars, or FIREBASE_PROJECT_ID for token verification.");
    process.exit(1);
  }
}

if (NODE_ENV === "production") {
  if (!process.env.ALLOWED_ORIGINS) {
    console.error("FATAL: ALLOWED_ORIGINS must be set explicitly in production.");
    process.exit(1);
  }

  const invalidOrigins = ALLOWED_ORIGINS.filter((origin) => !/^https:\/\//i.test(origin));
  if (invalidOrigins.length) {
    console.error(`FATAL: Production ALLOWED_ORIGINS must use HTTPS only. Invalid entries: ${invalidOrigins.join(", ")}`);
    process.exit(1);
  }
}

function getStoryTokenBudget(length, stage = "story", language = "en-GB") {
  const normalizedLength = String(length || "medium").toLowerCase();

  // Token multiplier by script family.
  // Arabic / Hindi / Urdu scripts tokenize at roughly 2× the rate of English.
  // CJK (Japanese / Chinese) is efficient but gets a small buffer.
  // All other non-English languages get a moderate buffer.
  const lang = String(language || "en-GB").toLowerCase();
  const isEnglish = lang === "en-gb" || lang === "en-us" || lang === "british" || lang === "american";
  const isAbjad  = lang === "ar" || lang === "hi" || lang === "ur";
  const isCJK    = lang === "ja" || lang === "zh-cn";
  const multiplier = isAbjad ? 2.0 : isCJK ? 1.2 : isEnglish ? 1.0 : 1.4;

  if (normalizedLength === "short") {
    if (stage === "title") return 80;
    if (stage === "delivery") return Math.ceil(1400 * multiplier);
    return Math.ceil(1400 * multiplier);   // 300-500 words + generous internal reasoning room
  }

  if (normalizedLength === "long") {
    if (stage === "title") return 100;
    if (stage === "delivery") return Math.ceil(4800 * multiplier);
    return Math.ceil(5000 * multiplier);   // 1800-2400 words + full Pixar quality headroom
  }

  // medium (default)
  if (stage === "title") return 80;
  if (stage === "delivery") return Math.ceil(2800 * multiplier);
  return Math.ceil(3000 * multiplier);     // 900-1200 words + quality headroom
}

// =============================================================================
// Logging
// =============================================================================

function logEvent(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFile("server.log", entry, () => {});
  if (NODE_ENV === "development") console.log(entry.trim());
}

function getFirebaseAdminInstance() {
  if (!getApps().length) {
    const hasServiceAccount = FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY;
    const hasApplicationDefault = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (hasServiceAccount) {
      initializeAdminApp({
        credential: cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY,
        }),
      });
    } else if (hasApplicationDefault) {
      initializeAdminApp({
        credential: applicationDefault(),
        projectId: FIREBASE_PROJECT_ID || undefined,
      });
    } else if (FIREBASE_PROJECT_ID) {
      initializeAdminApp({
        projectId: FIREBASE_PROJECT_ID,
      });
    } else {
      throw new Error("Firebase Admin configuration is missing.");
    }
  }

  return getAdminAuth();
}

async function requireAiAuth(req, res, next) {
  if (!REQUIRE_AUTH_FOR_AI_ROUTES) {
    req.authUser = null;
    return next();
  }

  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ error: "Please log in to generate stories." });
  }

  try {
    const decodedToken = await getFirebaseAdminInstance().verifyIdToken(match[1]);
    req.authUser = decodedToken;
    return next();
  } catch (error) {
    logEvent(`Auth verification failed on ${req.path} from ${req.ip}: ${error.message}`);
    return res.status(401).json({ error: "Please log in to generate stories." });
  }
}

function buildAiLimiter({ windowMs, max, routeLabel }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator(req) {
      return req.authUser?.uid ? `uid:${req.authUser.uid}` : `ip:${ipKeyGenerator(req.ip)}`;
    },
    handler(req, res) {
      logEvent(`Rate limit hit on ${routeLabel} from ${req.ip}`);
      res.setHeader("Retry-After", "300");
      return res.status(429).json({
        error: "Too many story requests right now. Please wait a few minutes and try again.",
        retryAfter: 300,
      });
    },
  });
}

// =============================================================================
// Input safety
// =============================================================================

function sanitizeInput(input) {
  if (typeof input !== "string") return "";
  return input.replace(/[<>{}\[\]]/g, "").trim().substring(0, 200);
}

function containsSuspiciousContent(text) {
  const lower = text.toLowerCase();
  return /https?:\/\/|<script|javascript:|on\w+\s*=|eval\s*\(|import\s*\(/.test(lower);
}

// Child-safety word list — checked on every user-supplied input field and
// on every AI-generated story before it is sent to the client.
const CHILD_SAFETY_BANNED = [
  // profanity
  "fuck","shit","bitch","bastard","asshole","cunt","dick","cock","pussy","piss","crap",
  // sexual
  "sex","porn","nude","naked","boob","breast","penis","vagina","rape","molest","masturbat",
  // violence / weapons
  "kill","murder","gun","knife","stab","shoot","bomb","blood","gore","terror","suicide",
  // drugs / alcohol
  "drug","cocaine","heroin","meth","weed","alcohol","drunk","cigarette","vape",
  // horror / fear
  "demon","satan","devil","hell","horror","nightmare",
  // hate
  "racist","nigger","faggot","retard",
];

const SAFETY_PATTERN = new RegExp(
  CHILD_SAFETY_BANNED.map(w => `\\b${w}`).join("|"),
  "i"
);

function isUnsafeForChildren(text) {
  if (!text) return false;
  return SAFETY_PATTERN.test(text);
}

function getSafeFallbackStory(name) {
  return `${name} snuggled into bed as the stars twinkled softly above.\n\nTonight was a peaceful night filled with gentle dreams, kind thoughts, and a quiet sense of magic.\n\nAs the moon smiled down, ${name} drifted into a calm and happy sleep, ready for a new adventure tomorrow.`;
}

function isStoryOutputSafe(story) {
  if (!story) return false;
  return !SAFETY_PATTERN.test(story);
}

function finalizeStoryLocally(storyText, dialect, label) {
  const normalized = normalizeStoryOutput(storyText);

  try {
    return assertStoryQuality(normalized, { dialect, label });
  } catch (error) {
    logEvent(`${label} local quality warning: ${error.message}`);
    return normalized;
  }
}

async function runDeliveryQaPass(storyText, dialect) {
  let currentStory = normalizeStoryOutput(storyText);
  const deliveryBudget = getStoryTokenBudget(currentStory.split(/\s+/).length >= 950 ? "long" : "medium", "delivery", dialect);

  for (let attempt = 1; attempt <= 2; attempt++) {
    const issues = detectStoryQualityIssues(currentStory, { dialect });
    if (!issues.length) {
      return currentStory;
    }

    const qaPrompt = buildDeliveryQaPrompt(currentStory, {
      issues,
      dialect,
    });

    currentStory = normalizeStoryOutput(
      await callClaudeWithRetry({
        system: DELIVERY_QA_SYSTEM_PROMPT,
        prompt: qaPrompt,
        maxTokens: deliveryBudget,
        temperature: 0.1,
        model: CLAUDE_MODEL_SONNET,
      })
    );
  }

  return assertStoryQuality(currentStory, {
    dialect,
    label: "Delivery QA output",
  });
}

// =============================================================================
// Claude API
// =============================================================================

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL_SONNET = "claude-sonnet-4-6";
const CLAUDE_MODEL_HAIKU  = "claude-haiku-4-5-20251001";
const CLAUDE_MODEL_DEFAULT = CLAUDE_MODEL_SONNET;
const API_VERSION = "2023-06-01";

// Tiered model selection:
//   hero / long  → Sonnet (richest prose, worth the extra seconds)
//   medium       → Haiku  (fast, ~8–12s total, plenty for a good story)
//   short/random → Haiku  (fastest path — bedtime shouldn't make parents wait)
// In lean pipeline (default) this gives: Haiku×2 calls ≈ 8–14s end-to-end.
function getModelConfig({ mode, length } = {}) {
  if (mode === "hero") {
    return { model: CLAUDE_MODEL_SONNET, temperature: 0.85 };
  }
  switch (length) {
    case "long":
      return { model: CLAUDE_MODEL_SONNET, temperature: 0.8 };
    case "medium":
      return { model: CLAUDE_MODEL_HAIKU,  temperature: 0.85 };
    case "short":
    default:
      return { model: CLAUDE_MODEL_HAIKU,  temperature: 0.9 };
  }
}

async function callClaude({ system, prompt, maxTokens = 1200, temperature = 0.5, model, timeoutMs }) {
  if (!AI_ENABLED) {
    throw new Error("AI provider is not configured.");
  }

  // Scale timeout to token budget: long stories need 120s, short 60s
  const resolvedTimeout = timeoutMs || (maxTokens >= 4000 ? 120000 : maxTokens >= 2500 ? 90000 : 60000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolvedTimeout);

  try {
    // Build request body — system prompt is separate from messages
    const requestBody = {
      model: model || CLAUDE_MODEL_DEFAULT,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: "user", content: prompt }],
    };

    // Only include system parameter when provided
    if (system) {
      requestBody.system = system;
    }

    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Claude API ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    if (!data.content?.[0]?.text) {
      throw new Error("Empty response from Claude API");
    }

    return data.content[0].text;
  } finally {
    clearTimeout(timeout);
  }
}

async function callClaudeWithRetry(options, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await callClaude(options);
    } catch (error) {
      if (attempt === retries) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      logEvent(`Claude API attempt ${attempt + 1} failed, retrying in ${delay}ms: ${error.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Outer pipeline timeout — wraps any promise and rejects after ms with SERVER_TIMEOUT.
// This is separate from the per-call AbortController inside callClaude so we can
// cap the total pipeline time (all stages combined) independently of each call.
async function generateWithTimeout(promise, ms = 85000) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error("SERVER_TIMEOUT")), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

// =============================================================================
// Job Store — in-memory, 10-minute TTL
// Allows clients to disconnect (phone sleep) and reconnect to collect results.
// =============================================================================

const jobStore = new Map(); // jobId → { status, story, title, error, createdAt }
const JOB_TTL_MS = 10 * 60 * 1000;

function createJob() {
  const jobId = crypto.randomUUID();
  jobStore.set(jobId, { status: "pending", createdAt: Date.now() });
  setTimeout(() => jobStore.delete(jobId), JOB_TTL_MS);
  return jobId;
}

function resolveJob(jobId, story, title) {
  const job = jobStore.get(jobId);
  if (job) jobStore.set(jobId, { ...job, status: "done", story, title });
}

function failJob(jobId, errorMsg) {
  const job = jobStore.get(jobId);
  if (job) jobStore.set(jobId, { ...job, status: "failed", error: errorMsg });
}

// Retry wrapper: calls callClaudeWithRetry up to (retries+1) times, validates each
// result, and falls back to a safe story if all attempts fail or time out.
async function generateStorySafe(options, name, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const story = await generateWithTimeout(callClaudeWithRetry(options), 85000);
      if (isStoryValid(story)) return story;
    } catch (e) {
      logEvent(`generateStorySafe retry ${i}: ${e.message}`);
    }
  }
  return getSafeFallbackStory(name);
}

function isAiProviderUnavailableError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("not configured") ||
    message.includes("credit balance is too low") ||
    message.includes("rate limit") ||
    message.includes("temporarily unavailable") ||
    message.includes("overloaded") ||
    message.includes("service unavailable") ||
    message.includes("timed out") ||
    message.includes("aborterror")
  );
}

// =============================================================================
// Express app
// =============================================================================

const app = express();

app.disable("x-powered-by");

if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// HTTPS redirect — must be first in production
if (NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.redirect(301, "https://" + req.headers.host + req.url);
    }
    next();
  });
}

// Security headers — before static files so everything gets them
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://apis.google.com"],
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://*.firebaseio.com",
          "https://*.firebaseapp.com",
          "https://*.firebasestorage.app",
          "https://www.gstatic.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://firestore.googleapis.com",
          "https://firebaseinstallations.googleapis.com",
        ],
        frameSrc: ["'self'", "https://*.firebaseapp.com", "https://*.firebaseauth.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        scriptSrcAttr: ["'unsafe-inline'"],
      },
    },
  })
);

// Request size limit
app.use(express.json({ limit: "10kb" }));

// CORS — scoped to API routes only.
// Applying CORS globally blocks same-origin static assets (app.js, CSS, fonts)
// with HTTP 500 when the request's Origin header isn't in ALLOWED_ORIGINS,
// because Express's default error handler converts the thrown CORS error to 500.
// Static file requests are same-origin and don't need CORS at all; only the
// JSON API routes below need to opt in.
const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
});

// Rate limiting — applied ONLY to API routes below, never to static assets.
// Static files (app.js, CSS, HTML) must always load without limit-based throttling.
const generateLimiter = buildAiLimiter({
  windowMs: GENERATE_LIMIT_WINDOW_MS,
  max: GENERATE_LIMIT_MAX,
  routeLabel: "/generate",
});

const polishLimiter = buildAiLimiter({
  windowMs: POLISH_LIMIT_WINDOW_MS,
  max: POLISH_LIMIT_MAX,
  routeLabel: "/polish",
});

// Request logging
app.use((req, res, next) => {
  logEvent(`${req.method} ${req.url} from ${req.ip}`);
  next();
});

// Static files — after security middleware
app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    aiEnabled: AI_ENABLED,
  });
});

// =============================================================================
// Polish endpoint — runs a pre-generated story through the editor pass only
// Used as fallback when procedural stories need AI polish
// =============================================================================

app.options("/polish", corsMiddleware);
app.post(
  "/polish",
  corsMiddleware,
  requireAiAuth,
  polishLimiter,
  [
    body("story").isString().isLength({ min: 10, max: 5000 }).trim(),
    body("dialect").optional().custom(isSupportedStoryLocale),
    body("mode").optional().isIn(["edit", "rewrite"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Invalid story text." });
      }

      const { story, dialect, mode } = req.body;
      const cleanDialect = normalizeStoryLocale(dialect);
      const polishMode = mode === "rewrite" ? "rewrite" : "edit";

      logEvent(`Polish endpoint: ${polishMode} pass on procedural story`);

      // Rewrite mode = aggressive Disney-grade rewrite of a rough procedural
      // draft. Edit mode = conservative grammar/flow pass on an AI story.
      const polishSystem = polishMode === "rewrite"
        ? REWRITE_SYSTEM_PROMPT
        : EDITOR_SYSTEM_PROMPT;
      // In rewrite mode we frame the draft as a story brief so Sonnet
      // treats it as a spec to discard rather than text worth preserving.
      const polishPrompt = polishMode === "rewrite"
        ? `STORY BRIEF (ignore the prose, use only the facts below):\n\n${story}\n\nNow write a completely new bedtime story using only the character name, companion, setting, and goal from the brief above. Do not keep any sentences from the brief.`
        : buildGrammarPrompt(story, cleanDialect);
      const polishTemperature = polishMode === "rewrite" ? 1.0 : 0.2;
      const polishMaxTokens = polishMode === "rewrite" ? 2000 : 1200;

      const polished = await callClaudeWithRetry({
        system: polishSystem,
        prompt: polishPrompt,
        maxTokens: polishMaxTokens,
        temperature: polishTemperature,
        model: CLAUDE_MODEL_SONNET,
      });

      const finalStory = USE_FULL_AI_PIPELINE
        ? await runDeliveryQaPass(polished, cleanDialect)
        : finalizeStoryLocally(polished, cleanDialect, "Polish endpoint output");

      logEvent("Polish endpoint: complete");
      res.json({ story: finalStory });
    } catch (error) {
      if (isAiProviderUnavailableError(error)) {
        logEvent(`Polish endpoint: AI unavailable, returning original story unchanged. Reason: ${error.message}`);
        return res.json({ story: req.body?.story || "" });
      }

      logEvent(`Polish endpoint error: ${error.message}`);
      return res.status(422).json({ error: "Story could not be polished to quality standard." });
    }
  }
);

// =============================================================================
// Story generation endpoint
// =============================================================================

// =============================================================================
// Stripe — subscription checkout
// =============================================================================

app.options("/api/checkout", corsMiddleware);
app.post("/api/checkout", corsMiddleware, requireAiAuth, (req, res) => {
  logEvent(`Stripe checkout requested by uid:${req.authUser?.uid || "anon"}`);
  return createCheckoutSession(req, res);
});

// =============================================================================
// Analytics — fire-and-forget event logging
// =============================================================================

app.options("/track", corsMiddleware);
app.post("/track", corsMiddleware, express.json({ limit: "4kb" }), (req, res) => {
  const { event, data } = req.body || {};
  if (!event || typeof event !== "string") return res.json({ ok: false });
  const safe = event.replace(/[^a-z0-9_]/gi, "").slice(0, 64);
  console.log(`[TRACK] ${safe}`, JSON.stringify(data || {}).slice(0, 200));
  res.json({ ok: true });
});

app.options("/generate", corsMiddleware);
app.post(
  "/generate",
  corsMiddleware,
  requireAiAuth,
  generateLimiter,
  [
    body("name").isString().isLength({ min: 1, max: 50 }).trim(),
    body("age").isString().isLength({ min: 1, max: 10 }).trim(),
    body("interests").isString().isLength({ min: 1, max: 200 }).trim(),
    body("length").isIn(["short", "medium", "long"]),
    body("mode").isIn(["random", "hero", "today"]),
    body("dialect").optional().custom(isSupportedStoryLocale),
    body("customIdea").optional().isString().isLength({ max: 200 }).trim(),
    body("seriesContext").optional().isString().isLength({ max: 700 }).trim(),
    body("childWish").optional().isString().isLength({ max: 120 }).trim(),
    body("appearance").optional().isString().isLength({ max: 200 }).trim(),
    body("dayBeats").optional().isString().isLength({ max: 400 }).trim(),
    body("dayMood").optional().isString().isLength({ max: 40 }).trim(),
    body("language").optional().isString().isLength({ max: 10 }).trim(),
    body("globalInspiration").optional().isArray({ max: 10 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logEvent("Validation error: " + JSON.stringify(errors.array()));
        return res.status(400).json({ error: "Please check your input and try again." });
      }

      const { name, age, interests, length, mode, dialect, language, customIdea, seriesContext, childWish, appearance, dayBeats, dayMood, globalInspiration } = req.body;
      const cleanName = sanitizeInput(name);
      const cleanAge = sanitizeInput(age);
      const cleanInterests = sanitizeInput(interests);
      // `language` takes priority over legacy `dialect`.
      // Resolve to a canonical code (e.g. "ja", "ar", "en-GB").
      const cleanLanguage = language
        ? resolveLanguageCode(String(language).trim().substring(0, 10))
        : resolveLanguageCode(dialect);
      const cleanDialect = cleanLanguage; // keep existing references working
      const cleanIdea = customIdea ? sanitizeInput(customIdea) : null;
      const cleanSeriesContext = seriesContext
        ? String(seriesContext).replace(/[<>{}\[\]]/g, "").trim().substring(0, 700)
        : null;
      const cleanWish = childWish ? sanitizeInput(childWish) : null;
      const cleanAppearance = appearance ? sanitizeInput(appearance) : null;
      // dayBeats is up to 400 chars — use a longer sanitizer pass
      const cleanBeats = dayBeats
        ? String(dayBeats).replace(/[<>{}\[\]]/g, "").trim().substring(0, 400)
        : null;
      const cleanMood = dayMood ? sanitizeInput(dayMood) : null;

      const SAFE_MSG = "Let's keep stories kind and magical ✨";

      // XSS / injection check
      if (containsSuspiciousContent(cleanName) || containsSuspiciousContent(cleanInterests)) {
        logEvent(`Blocked suspicious input from ${req.ip}: ${cleanName}`);
        return res.status(400).json({ error: "Invalid input detected." });
      }

      // Child-safety content check on all free-text user fields
      const unsafeFields = [cleanIdea, cleanWish, cleanBeats, cleanAppearance, cleanMood]
        .filter(Boolean)
        .find(isUnsafeForChildren);

      if (unsafeFields) {
        logEvent(`Blocked unsafe content from ${req.ip}`);
        return res.status(400).json({ error: SAFE_MSG, unsafe: true });
      }

      if (cleanSeriesContext && containsSuspiciousContent(cleanSeriesContext)) {
        logEvent(`Blocked suspicious series context from ${req.ip}`);
        return res.status(400).json({ error: "Invalid input detected." });
      }

      logEvent(`Generating ${mode} story for "${cleanName}" (age ${cleanAge}), interests: "${cleanInterests}"${cleanIdea ? `, idea: "${cleanIdea}"` : ""}${cleanWish ? `, wish: "${cleanWish}"` : ""}, length: ${length}, dialect: ${cleanDialect}`);

      const cleanGlobalInspiration = Array.isArray(globalInspiration)
        ? globalInspiration
            .slice(0, 5)
            .map((s) => sanitizeInput(String(s || "").trim().substring(0, 100)))
            .filter(Boolean)
        : [];

      const storyInputs = {
        name: cleanName, age: cleanAge, interests: cleanInterests, length,
        language: cleanLanguage, dialect: cleanDialect, customIdea: cleanIdea,
        seriesContext: cleanSeriesContext, childWish: cleanWish,
        appearance: cleanAppearance, dayBeats: cleanBeats, dayMood: cleanMood,
        globalInspiration: cleanGlobalInspiration.length ? cleanGlobalInspiration : undefined,
      };

      // Create job, respond immediately so the client connection can close.
      // Phone can sleep — the pipeline keeps running on the server.
      const jobId = createJob();
      res.json({ jobId });

      // Run pipeline in background — result stored in jobStore for client to poll.
      runStoryPipeline(storyInputs, { mode, cleanName, cleanDialect, cleanInterests, cleanIdea, cleanWish, cleanSeriesContext, cleanBeats, length })
        .then(({ story, title }) => resolveJob(jobId, story, title))
        .catch((err) => {
          logEvent(`Pipeline error for job ${jobId}: ${err.message}`);
          failJob(jobId, "story_failed");
        });

    } catch (error) {
      logEvent(`Generate endpoint error: ${error.message}`);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  }
);

async function runStoryPipeline(storyInputs, { mode, cleanName, cleanDialect, cleanInterests, cleanIdea, cleanWish, cleanSeriesContext, cleanBeats, length }) {
  const modelConfig = getModelConfig({ mode, length });
  logEvent(`Model config for "${cleanName}": ${modelConfig.model} @ temp ${modelConfig.temperature}`);

  const storyMaxTokens = getStoryTokenBudget(length, "story", storyInputs.language);
  const editorMaxTokens = getStoryTokenBudget(length, "editor", storyInputs.language);
  const validatorMaxTokens = getStoryTokenBudget(length, "validator", storyInputs.language);
  const titleMaxTokens = getStoryTokenBudget(length, "title", storyInputs.language);

  const MAX_ATTEMPTS = USE_FULL_AI_PIPELINE ? 2 : 1;
  let finalStory = null;
  let cleanTitle = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) logEvent(`Regeneration triggered for "${cleanName}" (attempt ${attempt})`);

    const storyPrompt = buildStoryPrompt(storyInputs);
    const rawStory = await callClaudeWithRetry({
      system: STORY_SYSTEM_PROMPT, prompt: storyPrompt,
      maxTokens: storyMaxTokens, temperature: modelConfig.temperature, model: modelConfig.model,
    });
    logEvent(`Stage 1 complete (generate) for "${cleanName}" [attempt ${attempt}]`);

    const grammarPrompt = buildGrammarPrompt(rawStory, cleanDialect);
    const editedStory = await callClaudeWithRetry({
      system: EDITOR_SYSTEM_PROMPT, prompt: grammarPrompt,
      maxTokens: editorMaxTokens, temperature: 0.2, model: modelConfig.model,
    });

    if (!USE_FULL_AI_PIPELINE) {
      logEvent(`Stage 2 complete (edit) for "${cleanName}" [lean pipeline]`);
      finalStory = finalizeStoryLocally(editedStory, cleanDialect, `Final story for ${cleanName}`);
      cleanTitle = `${cleanName}'s Bedtime Story`;
      break;
    }

    const titlePrompt = buildTitlePrompt(rawStory, cleanName, cleanDialect);
    const title = await callClaudeWithRetry({
      prompt: titlePrompt, maxTokens: titleMaxTokens, temperature: 0.4, model: modelConfig.model,
    });
    logEvent(`Stage 2 complete (edit + title) for "${cleanName}" [attempt ${attempt}]`);

    const validationPrompt = buildValidationPrompt(editedStory, {
      mode, dialect: cleanDialect, interests: cleanInterests, customIdea: cleanIdea,
      childWish: cleanWish, seriesContext: cleanSeriesContext, dayBeats: cleanBeats,
    });
    const validatorOutput = await callClaudeWithRetry({
      system: VALIDATOR_SYSTEM_PROMPT, prompt: validationPrompt,
      maxTokens: validatorMaxTokens, temperature: 0.1, model: modelConfig.model,
    });
    logEvent(`Stage 3 complete (validate) for "${cleanName}" [attempt ${attempt}]`);

    if (validatorOutput.trim() === "REGENERATE") {
      logEvent(`Validator triggered REGENERATE for "${cleanName}" [attempt ${attempt}]`);
      continue;
    }
    const validatorIssues = detectStoryQualityIssues(validatorOutput, { dialect: cleanDialect });
    if (validatorIssues.length) {
      logEvent(`Validator issues for "${cleanName}" [attempt ${attempt}]: ${validatorIssues.join(" | ")}`);
      continue;
    }

    finalStory = validatorOutput;
    cleanTitle = title.replace(/["']/g, "").trim();
    break;
  }

  if (!finalStory) {
    logEvent(`Pipeline exhausted for "${cleanName}" — serving safe fallback story`);
    finalStory = getSafeFallbackStory(cleanName);
    cleanTitle = `${cleanName}'s Bedtime Story`;
  }

  finalStory = USE_FULL_AI_PIPELINE
    ? await runDeliveryQaPass(finalStory, cleanDialect)
    : finalizeStoryLocally(finalStory, cleanDialect, `Final story for ${cleanName}`);

  if (USE_FULL_AI_PIPELINE) {
    finalStory = assertStoryQuality(finalStory, { dialect: cleanDialect, label: `Final story for ${cleanName}` });
  }

  if (!cleanTitle) cleanTitle = `${cleanName}'s Bedtime Story`;

  if (!isStoryOutputSafe(finalStory)) {
    logEvent(`UNSAFE output detected for "${cleanName}" — using safe fallback`);
    finalStory = getSafeFallbackStory(cleanName);
    cleanTitle = `${cleanName}'s Peaceful Night`;
  }

  logEvent(`Pipeline complete for "${cleanName}": "${cleanTitle}"`);
  return { story: finalStory, title: cleanTitle };
}

// =============================================================================
// Job polling endpoint — client calls this after phone wakes to collect result
// =============================================================================

app.options("/api/job/:jobId", corsMiddleware);
app.get("/api/job/:jobId", corsMiddleware, (req, res) => {
  const { jobId } = req.params;
  if (!/^[0-9a-f-]{36}$/.test(jobId)) return res.status(400).json({ status: "invalid" });
  const job = jobStore.get(jobId);
  if (!job) return res.json({ status: "expired" });
  res.json(job);
});

// =============================================================================
// Start server
// =============================================================================

if (NODE_ENV === "production" && process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
  const sslOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH),
  };
  const server = https.createServer(sslOptions, app);
  server.on("error", handleServerStartupError);
  server.listen(PORT, () => {
    logEvent(`HTTPS server running on port ${PORT}`);
    console.log(`HTTPS server running on port ${PORT}`);
  });
} else {
  const server = app.listen(PORT, () => {
    logEvent(`Server running on port ${PORT} (${NODE_ENV})`);
    console.log(`Server running on port ${PORT}`);
  });
  server.on("error", handleServerStartupError);
}

function handleServerStartupError(error) {
  if (error?.code === "EADDRINUSE") {
    console.error(`FATAL: Port ${PORT} is already in use. Stop the other server or change PORT in .env.`);
    process.exit(1);
  }

  if (error?.code === "EACCES") {
    console.error(`FATAL: Permission denied while starting the server on port ${PORT}. Try a different PORT.`);
    process.exit(1);
  }

  console.error(`FATAL: Server startup failed: ${error?.message || error}`);
  process.exit(1);
}
