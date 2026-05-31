import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the server's own directory so the server boots correctly
// regardless of the working directory it was started from.
dotenv.config({ path: path.join(__dirname, ".env") });

function logEvent(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

const PUBLIC_DIR = path.join(__dirname, "public");
const POLISH_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const POLISH_LIMIT_MAX = 10;
// Locale validation helper
function isSupportedStoryLocale(lang) {
  const supported = [
    "en", "en-GB", "en-US",
    "fr", "es", "de", "it",
    "ja", "zh", "zh-CN", "hi",
    "pt", "ar", "ur"
  ];
  return supported.includes(lang);
}
// =============================================================================
// DreamTalez — Server
// AI-powered bedtime story generator for children aged 2–12
// =============================================================================


import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { applicationDefault, cert, getApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAppCheck } from "firebase-admin/app-check";

// ✅ Rate limiter for /generate (IP-based)
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
});

// Per-user sliding window rate limiter (in-memory, resets on restart)
const userRequests = new Map();
const activeRequests = new Set();

function isRateLimited(userId) {
  const now = Date.now();
  const windowMs = 10000;
  const maxRequests = 3;

  const timestamps = (userRequests.get(userId) || []).filter(t => now - t < windowMs);
  timestamps.push(now);
  userRequests.set(userId, timestamps);

  return timestamps.length > maxRequests;
}

// =============================
// Middleware definitions
// =============================
// Allowed origins are sourced from ALLOWED_ORIGINS (comma-separated) so we
// never deploy production with cors({ origin: "*" }) — a wildcard CORS would
// let any website on the internet trigger story generation against this
// server using a victim's stored Firebase token, draining Claude credits.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsMiddleware = cors({
  origin(origin, callback) {
    // No Origin header → same-origin browser request, curl, or a native
    // mobile app (Capacitor uses capacitor:// which omits Origin). Allow it.
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // In dev with no allowlist configured, accept anything so local testing
    // doesn't require fiddling with env. Production preflight refuses to
    // boot when the allowlist is empty, so this branch is dev-only.
    if (process.env.NODE_ENV !== "production" && ALLOWED_ORIGINS.length === 0) {
      return callback(null, true);
    }
    logEvent(`Blocked by CORS: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
});
import { body, validationResult } from "express-validator";
import fs from "fs";
import https from "https";
import crypto from "crypto";

// Cost protection & runtime safety
import { budgetGuard, addSpend }  from "./middleware/budget-guard.js";
import { requestTimeout }          from "./middleware/request-timeout.js";
import { queueGuard }              from "./middleware/queue-guard.js";
import { getCachedProfile, setCachedProfile, invalidateProfile } from "./cache/profile-cache.js";
import RUNTIME_LIMITS              from "./config/runtime-limits.js";




import {
  STORY_SYSTEM_PROMPT,
  EDITOR_SYSTEM_PROMPT,
  VALIDATOR_SYSTEM_PROMPT,
  DELIVERY_QA_SYSTEM_PROMPT,
  BLUEPRINT_SYSTEM_PROMPT,
  buildStoryPrompt,
  buildBlueprintPrompt,
  buildGrammarPrompt,
  buildValidationPrompt,
  buildDeliveryQaPrompt,
  buildTitlePrompt,
  resolveLanguageCode,
  getDialectInstruction,
} from "./prompts.js";
import { applyBedtimeSoftness } from "./story-engine/orchestration/bedtime-softness-balancer.js";
import { applyRhythm } from "./story-engine/orchestration/prose-rhythm-engine.js";
import { buildAdaptiveStoryflow } from "./story-engine/orchestration/adaptive-storyflow-orchestrator.js";
// Phase 5 — Global Scaling & Premiumization
import { frameworkLoader } from "./story-engine/runtime/framework-loader.js";
import { getLockedSystemPrompt } from "./story-engine/runtime/runtime-pipeline.js";
import { calculateStoryQuality } from "./story-engine/analytics/story-quality-engine.js";
import { buildStoryCompletionEvent, extractUsedComfortAnchors } from "./story-engine/analytics/retention-intelligence.js";
import { PremiumQualityValidator } from "./story-engine/validation/premium-quality-validator.js";
import { GlobalLocalizationValidator } from "./story-engine/validation/global-localization-validator.js";
import { runStoryRuntime, applyPostProcessing } from "./story-engine/runtime/story-runtime.js";
import { runValidationPipeline, splitStoryIntoSections } from "./story-engine/validation/validation-pipeline.js";

import {
  normalizeStoryOutput,
  detectStoryQualityIssues,
  assertStoryQuality,
  isStoryValid,
} from "./story-quality.js";
import { createCheckoutSession, handleWebhook, validateAndConsumeGuestOneoff, cancelSubscription } from "./stripe.js";

// =============================================================================
// Environment / config
// =============================================================================
// Accept either ANTHROPIC_API_KEY (canonical) or CLAUDE_API_KEY (alias),
// matching what .env.example documents. Trim whitespace because copy/paste
// from dashboards often appends a stray newline that silently breaks auth.
const API_KEY = (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "").trim();
const AI_ENABLED = API_KEY.startsWith("sk-ant-");
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || "";
const FIREBASE_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const REQUIRE_AUTH_FOR_AI_ROUTES = process.env.REQUIRE_AUTH_FOR_AI_ROUTES !== "false";
const REQUIRE_APP_CHECK = process.env.REQUIRE_APP_CHECK === "true";
// Force full AI pipeline for Disney-quality stories (8-10 rating)
const USE_FULL_AI_PIPELINE = true;

// Developer accounts — credit gate is always bypassed for these emails
const DEVELOPER_EMAILS = new Set([
  "dene2012@hotmail.co.uk",
]);


// =============================
// App init
// =============================
const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://www.gstatic.com", 
        "https://apis.google.com",
        "https://www.google.com",
        "https://*.firebaseapp.com",
        "https://*.googleapis.com",
        "https://recaptchaenterprise.googleapis.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https://*.stripe.com", "https://*.googleusercontent.com", "https://*.gstatic.com", "https://www.google.com"],
      connectSrc: [
        "'self'", 
        "https://*.googleapis.com", 
        "https://*.firebaseio.com", 
        "https://*.firebaseapp.com",
        "https://*.firebasestorage.app",
        "https://www.gstatic.com",
        "https://api.anthropic.com",
        "https://fonts.gstatic.com",
        "https://www.google.com",
        "https://content-firebaseappcheck.googleapis.com"
      ],
      frameSrc: ["'self'", "https://*.stripe.com", "https://*.firebaseapp.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Gzip compression for faster asset delivery
app.use(compression());

app.use(corsMiddleware);

// Request ID
app.use((req, _res, next) => {
  req.requestId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  next();
});

app.use(budgetGuard);




function normalizeGenerateMode(mode) {
  switch (mode) {
    case "sleepy":
    case "long-surprise":
    case "medium-surprise":
      return "random";
    case "therapeutic":
    case "custom":
      return "hero";
    case "family-magic":
      return "family-magic";
    default:
      return mode;
  }
}

// Helper: Hash an IP address for rate-limit key generation
function ipKeyGenerator(ip) {
  return crypto.createHash("sha256").update(ip || "").digest("hex").substring(0, 16);
}

// Helper: Return token budget based on story length and pipeline stage
function getStoryTokenBudget(length, stage, dialect, storyType) {
  const isNonEnglish = dialect && !["en", "en-GB", "en-US", "en-gb", "en-us"].includes(dialect);
  const budgets = {
    sample:   { story: 600,  editor: 600,  validator: 600,  title: 40,  delivery: 500 },
    short:    { story: 700,  editor: 700,  validator: 700,  title: 40,  delivery: 600 },
    medium:   { story: 1800, editor: 1800, validator: 1800, title: 40,  delivery: 1600 },
    long:     { story: 3200, editor: 3200, validator: 3200, title: 40,  delivery: 2800 },
    keepsake: { story: 2400, editor: 2400, validator: 2400, title: 60,  delivery: 2200 },
  };
  // Route by storyType overrides first
  const key = storyType === "oneoff-sample" ? "sample"
            : storyType === "keepsake" ? "keepsake"
            : (length in budgets ? length : "medium");
  const row = budgets[key] ?? budgets.medium;
  const base = row[stage] ?? 1400;
  return isNonEnglish ? Math.ceil(base * 1.15) : base;
}

// Helper: Get Firestore instance
function getFirestoreDb() {
  if (!getApps().length) getAdminAuth(); // ensure admin initialized
  return getFirestore();
}

// =============================================================================
// Subscription helpers
// =============================================================================

function addOneMonth(ts) {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + 1);
  return d.getTime();
}

// Idempotent monthly reset — safe to call on every generate request.
// Returns the (possibly updated) user data so callers avoid a second DB read.
async function ensureSubscriptionFresh(uid, userData, db) {
  if (!userData.isSubscribed) return userData;
  if (Date.now() < (userData.subscriptionEndDate || 0)) return userData;

  const now = Date.now();
  const reset = {
    storiesRemaining: 40,
    subscriptionStartDate: now,
    subscriptionEndDate: addOneMonth(now),
  };
  await db.collection("users").doc(uid).set(reset, { merge: true });
  logEvent(`[SUBSCRIPTION] Monthly reset for ${uid}`);
  return { ...userData, ...reset };
}

// Total paid credits a user has right now — sum, not nullish-coalesce.
// The previous `??` chain hid extras and one-offs whenever storiesRemaining
// was 0 (a real value, not null), so a subscribed user with both buckets
// only saw the first number. Always sum.
function getTotalCredits(userData = {}) {
  const subBucket = Number(userData.storiesRemaining || 0);
  const extras   = Number(userData.extraStoryCredits || 0);
  const oneOff   = userData.oneOffAvailable ? 1 : 0;
  return subBucket + extras + oneOff;
}

// Consume one story credit — checks access and deducts atomically.
// Returns { ok, consumed, message }.
async function consumeStory(uid, userData, db) {
  if (!userData.isSubscribed) {
    if (userData.oneOffAvailable) {
      await db.collection("users").doc(uid).update({ oneOffAvailable: false });
      return { ok: true, consumed: "oneOff" };
    }
    return { ok: false, message: "✨ Unlock a story to begin your child's adventure" };
  }

  if ((userData.storiesRemaining || 0) > 0) {
    await db.collection("users").doc(uid).update({ storiesRemaining: FieldValue.increment(-1) });
    return { ok: true, consumed: "storiesRemaining" };
  }

  if ((userData.extraStoryCredits || 0) > 0) {
    await db.collection("users").doc(uid).update({ extraStoryCredits: FieldValue.increment(-1) });
    return { ok: true, consumed: "extraStoryCredits" };
  }

  return {
    ok: false,
    message: "🌙 Tonight's stories are complete. Continue the magic with 10 more stories, or rest until tomorrow.",
  };
}

// Reverse a consumption on pipeline failure so users aren't charged for broken generations.
async function refundStory(uid, consumed, db) {
  if (!consumed) return;
  if (consumed === "oneOff") {
    await db.collection("users").doc(uid).update({ oneOffAvailable: true });
  } else {
    await db.collection("users").doc(uid).update({ [consumed]: FieldValue.increment(1) });
  }
  logEvent(`[REFUND] ${consumed} refunded for ${uid}`);
}



  // Story generation endpoint
  app.post(
    "/generate",
    corsMiddleware,
    express.json({ limit: "10kb" }),
    requireAppCheck,
    requireAiAuth,
    generateLimiter,
    queueGuard,                         // global concurrent cap
    requestTimeout(RUNTIME_LIMITS.maxGenerationSeconds * 1000), // 30 s hard timeout
    [
      body("name").isString().isLength({ min: 1, max: 50 }).trim(),
      body("age").isString().isLength({ min: 1, max: 10 }).trim(),
      body("interests").isString().isLength({ min: 1, max: 200 }).trim(),
      body("length").isIn(["short", "medium", "long"]),
      body("mode").isIn(["random", "hero", "today", "sleepy", "long-surprise", "therapeutic", "custom", "medium-surprise", "family-magic"]),
      body("dialect").optional().custom(isSupportedStoryLocale),
      body("customIdea").optional().isString().isLength({ max: 200 }).trim(),
      body("therapeuticSituation").optional().isString().isLength({ max: 200 }).trim(),
      body("seriesContext").optional().isString().isLength({ max: 700 }).trim(),
      body("childWish").optional().isString().isLength({ max: 120 }).trim(),
      body("appearance").optional().isString().isLength({ max: 200 }).trim(),
      body("dayBeats").optional().isString().isLength({ max: 400 }).trim(),
      body("dayMood").optional().isString().isLength({ max: 40 }).trim(),
      body("language").optional().isString().isLength({ max: 10 }).trim(),
      body("globalInspiration").optional().isArray({ max: 10 }),
      body("gender").optional().isString().isLength({ max: 20 }).trim(),
      body("siblings").optional().isString().isLength({ max: 100 }).trim(),
      body("family").optional().isString().isLength({ max: 100 }).trim(),
      body("cultural_world").optional().isString().isLength({ max: 100 }).trim(),
      body("recurring_character").optional().isString().isLength({ max: 100 }).trim(),
      body("last_story_summary").optional().isString().isLength({ max: 400 }).trim(),
      body("familyMagic").optional(),
      body("bedtimeHour").optional().isInt({ min: 0, max: 23 }),
      body("previousStoryIntensity").optional().isInt({ min: 1, max: 5 }),
    ],
    async (req, res) => {
      // Hoisted so the outer catch can release activeRequests if anything
      // throws after we acquired the lock but before the pipeline starts.
      let uid = null;
      let db = null;
      let jobId = null;
      let hasPersistentLock = false;
      try {
        // Fail fast and visibly when AI is unconfigured, instead of accepting
        // the request, creating a job, and letting the client poll a doomed
        // pipeline for ~10 seconds before discovering it. This is the only
        // path that the user-facing UI presents — silent failure here looked
        // like a generic "story didn't generate" with no diagnostic.
        if (!AI_ENABLED) {
          logEvent("Rejecting /generate: AI provider not configured");
          return res.status(503).json({
            error: "Story generation is temporarily unavailable. Please try again shortly.",
            reason: "ai_unconfigured",
          });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          logEvent("Validation error: " + JSON.stringify(errors.array()));
          return res.status(400).json({ error: "Please check your input and try again." });
        }

        const { name, age, interests, length, mode, dialect, language, customIdea, therapeuticSituation, seriesContext, childWish, appearance, dayBeats, dayMood, globalInspiration, storyType, gender, siblings, family, cultural_world, recurring_character, last_story_summary, familyMagic: rawFamilyMagic, bedtimeHour: rawBedtimeHour, previousStoryIntensity: rawPreviousIntensity } = req.body;
        const cleanName = sanitizeInput(name);
        const cleanAge = sanitizeInput(age);
        const cleanInterests = sanitizeInput(interests);
        const incomingMode = mode;
        const normalizedMode = normalizeGenerateMode(incomingMode);
        // `language` takes priority over legacy `dialect`.
        // Resolve to a canonical code (e.g. "ja", "ar", "en-GB").
        const cleanLanguage = language
          ? resolveLanguageCode(String(language).trim().substring(0, 10))
          : resolveLanguageCode(dialect);
        const cleanDialect = cleanLanguage; // keep existing references working
        const cleanTherapeuticSituation = therapeuticSituation ? sanitizeInput(therapeuticSituation) : null;
        const cleanIdea = customIdea ? sanitizeInput(customIdea) : cleanTherapeuticSituation;
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
        const cleanGender = gender ? sanitizeInput(gender) : null;
        const cleanSiblings = siblings ? sanitizeInput(siblings) : null;
        const cleanFamily = family ? sanitizeInput(family) : null;
        const cleanCulturalWorld = cultural_world ? sanitizeInput(cultural_world) : null;
        const cleanRecurringCharacter = recurring_character ? sanitizeInput(recurring_character) : null;
        const cleanLastStorySummary = last_story_summary
          ? String(last_story_summary).replace(/[<>{}\[\]]/g, "").trim().substring(0, 400)
          : null;

        // Sanitize familyMagic — only accept safe scalar values, no nested code
        const cleanFamilyMagic = (() => {
          if (!rawFamilyMagic || typeof rawFamilyMagic !== "object") return null;
          const fm = rawFamilyMagic;
          const sanitizeStr = (s, max) => s ? String(s).replace(/[<>{}\[\]]/g, "").trim().substring(0, max) : "";
          return {
            enabled: Boolean(fm.enabled),
            familyMembers: Array.isArray(fm.familyMembers)
              ? fm.familyMembers.slice(0, 6).map((m) => ({
                  relationship: sanitizeStr(m.relationship, 30),
                  name: sanitizeStr(m.name, 30),
                })).filter((m) => m.name && m.relationship)
              : [],
            comfortItems: Array.isArray(fm.comfortItems)
              ? fm.comfortItems.slice(0, 4).map((s) => sanitizeStr(s, 40)).filter(Boolean)
              : [],
            favoriteCozyFeeling:  sanitizeStr(fm.favoriteCozyFeeling,  100),
            favoriteMagicalPlace: sanitizeStr(fm.favoriteMagicalPlace, 100),
          };
        })();

        const SAFE_MSG = "Let's keep stories kind and magical ✨";

        // XSS / script injection check (name, interests)
        if (containsSuspiciousContent(cleanName) || containsSuspiciousContent(cleanInterests)) {
          logEvent(`Blocked suspicious input from ${req.ip}: ${cleanName}`);
          return res.status(400).json({ error: "Invalid input detected." });
        }

        // Child name must not contain banned words (e.g. user tries to name child a slur)
        if (isUnsafeForChildren(cleanName)) {
          logEvent(`Blocked unsafe name from ${req.ip}`);
          return res.status(400).json({ error: SAFE_MSG, unsafe: true });
        }

        // Child-safety content check on all free-text story input fields
        const freeTextFields = [
          cleanIdea, cleanTherapeuticSituation, cleanWish, cleanBeats,
          cleanAppearance, cleanMood, cleanInterests, cleanSeriesContext,
          cleanLastStorySummary,
        ];
        const unsafeField = freeTextFields.filter(Boolean).find(isUnsafeForChildren);
        if (unsafeField) {
          logEvent(`Blocked unsafe content from ${req.ip}`);
          return res.status(400).json({ error: SAFE_MSG, unsafe: true });
        }

        // Prompt injection check — prevents attempts to override AI system prompts
        const injectionFields = [
          cleanIdea, cleanTherapeuticSituation, cleanWish, cleanBeats,
          cleanSeriesContext, cleanLastStorySummary,
        ];
        const injectionAttempt = injectionFields.filter(Boolean).find(containsPromptInjection);
        if (injectionAttempt) {
          logEvent(`Blocked prompt injection attempt from ${req.ip}`);
          return res.status(400).json({ error: SAFE_MSG, unsafe: true });
        }

        // familyMagic free-text fields safety check
        if (cleanFamilyMagic) {
          const fmTexts = [
            cleanFamilyMagic.favoriteCozyFeeling,
            cleanFamilyMagic.favoriteMagicalPlace,
            ...cleanFamilyMagic.familyMembers.map((m) => m.name),
            ...(cleanFamilyMagic.comfortItems || []),
          ].filter(Boolean);
          if (fmTexts.find(isUnsafeForChildren)) {
            logEvent(`Blocked unsafe family magic content from ${req.ip}`);
            return res.status(400).json({ error: SAFE_MSG, unsafe: true });
          }
        }

        if (cleanSeriesContext && containsSuspiciousContent(cleanSeriesContext)) {
          logEvent(`Blocked suspicious series context from ${req.ip}`);
          return res.status(400).json({ error: "Invalid input detected." });
        }

        // PAYMENT GATE
        // When REQUIRE_AUTH_FOR_AI_ROUTES is off (local dev) requireAiAuth sets
        // req.authUser to null. Synthesize a stable dev uid so the rate limiter
        // and active-request guard still work without rejecting the request.
        uid = req.authUser?.uid || (REQUIRE_AUTH_FOR_AI_ROUTES ? null : "dev-anon");
        if (!uid) {
          return res.status(401).json({ error: "Please log in to generate stories." });
        }

        const isDevAccount = req.authUser?.email && DEVELOPER_EMAILS.has(req.authUser.email);
        const isAnonDev = uid === "dev-anon";

        // Duplicate request guard — one active generation per user at a time
        if (activeRequests.has(uid)) {
          return res.status(429).json({ error: "✨ Your story is already being created" });
        }

        // Per-user rate limit — max 3 requests per 10s window (skipped for devs)
        if (!isDevAccount && !isAnonDev && isRateLimited(uid)) {
          return res.status(429).json({ error: "🌙 Let the story settle before creating another" });
        }

        activeRequests.add(uid);
        // Bypass the paid-credit check ONLY for:
        //   1. The anonymous local dev user (no Firebase, no real account)
        //   2. Explicitly listed developer emails (DEVELOPER_EMAILS)
        // We deliberately do NOT bypass for "any signed-in user when NODE_ENV
        // is not production" — that previously handed free stories to anyone
        // testing against a dev server, which contradicts the paywall promise.
        const bypassPayment = isAnonDev || isDevAccount;

        // Skip Firestore entirely for the anonymous dev user — Firebase Admin
        // may not even be configured in pure-local development, so the lookup
        // would throw before the pipeline gets a chance to run.
        let userData = {};
        if (!isAnonDev) {
          db = getFirestoreDb();

          // Persisted per-user throttle (survives restarts and scales across instances).
          // Skipped for developer accounts — unlimited generation.
          if (!isDevAccount) {
            const persistentRate = await enforcePersistentUserRateLimit(uid, db);
            if (persistentRate.limited) {
              activeRequests.delete(uid);
              const msg = persistentRate.reason === "daily"
                ? "🌙 You've created lots of magic today — come back tonight for more adventures"
                : "🌙 Let the story settle before creating another";
              return res.status(429).json({ error: msg });
            }
          }

          // Profile cache — avoids redundant Firestore reads on rapid requests
          let cachedUser = getCachedProfile(uid);
          if (cachedUser) {
            userData = cachedUser;
          } else {
            const userSnap = await db.collection("users").doc(uid).get();
            userData = userSnap.exists ? userSnap.data() : {};
            // Monthly subscription reset (idempotent — no-op if still in window)
            userData = await ensureSubscriptionFresh(uid, userData, db);
            setCachedProfile(uid, userData);
          }
        }

        // Consume story credit (checks access, deducts atomically).
        // Real users without a paid credit get a 403 below — never a free story.
        const consumption = bypassPayment
          ? { ok: true, consumed: null }
          : await consumeStory(uid, userData, db);
        if (!consumption.ok) {
          activeRequests.delete(uid);
          return res.status(403).json({ error: consumption.message });
        }
        // Invalidate cached profile — credit count just changed
        if (consumption.consumed) invalidateProfile(uid);

        logEvent(`[GENERATE] start rid=${req.requestId} uid=${uid} mode=${incomingMode}→${normalizedMode} length=${length} dialect=${cleanDialect}`);

        const cleanGlobalInspiration = Array.isArray(globalInspiration)
          ? globalInspiration
              .slice(0, 5)
              .map((s) => sanitizeInput(String(s || "").trim().substring(0, 100)))
              .filter(Boolean)
          : [];

        // Bedtime hour — accept from client (local device time) or fall back to server hour
        const cleanBedtimeHour = (() => {
          const h = parseInt(rawBedtimeHour, 10);
          return !isNaN(h) && h >= 0 && h <= 23 ? h : new Date().getHours();
        })();
        const cleanPreviousIntensity = (() => {
          const v = parseInt(rawPreviousIntensity, 10);
          return !isNaN(v) && v >= 1 && v <= 5 ? v : 2;
        })();

        const storyInputs = {
          name: cleanName,
          age: cleanAge,
          gender: cleanGender,
          interests: cleanInterests,
          siblings: cleanSiblings,
          family: cleanFamily,
          cultural_world: cleanCulturalWorld,
          recurring_character: cleanRecurringCharacter,
          last_story_summary: cleanLastStorySummary,
          language: cleanLanguage,
          familyMagic: cleanFamilyMagic || undefined,
          bedtimeHour: cleanBedtimeHour,
          previousStoryIntensity: cleanPreviousIntensity,
        };

        // Create the job record BEFORE responding. The record stores the
        // credit bucket we just consumed, so a server restart mid-pipeline
        // can be refunded by the sweeper from the durable record alone.
        try {
          if (db) {
            const provisionalJobId = crypto.randomUUID();
            const lock = await acquireGenerationLock(uid, provisionalJobId, db);
            if (!lock.ok) {
              await refundStory(uid, consumption.consumed, db).catch(refundErr =>
                logEvent(`[REFUND] lock conflict refund failed uid=${uid}: ${refundErr.message}`)
              );
              activeRequests.delete(uid);
              return res.status(429).json({ error: "✨ Your story is already being created" });
            }
            hasPersistentLock = true;
            jobId = provisionalJobId;
          }

          jobId = await createJob({
            uid,
            db,
            consumed: consumption.consumed,
            jobId,
            ctx: {
              mode: normalizedMode,
              rawMode: incomingMode,
              length,
              cleanName,
              payload: {
                storyInputs,
                pipeline: {
                  mode: normalizedMode,
                  rawMode: incomingMode,
                  cleanName,
                  cleanDialect,
                  cleanInterests,
                  cleanIdea,
                  cleanWish,
                  cleanSeriesContext,
                  cleanBeats,
                  length,
                },
              },
            },
          });

          if (db && hasPersistentLock) {
            await db.collection(USER_LOCKS_COLLECTION).doc(uid).set({
              uid,
              jobId,
              createdAt: Date.now(),
              expiresAt: Date.now() + GENERATION_LOCK_TTL_MS,
            }, { merge: true });
          }
        } catch (e) {
          // Job creation failed → refund inline (we never told the user we'd
          // generate anything) and surface a 500.
          logEvent(`[GENERATE] createJob failed for uid=${uid}: ${e.message}`);
          activeRequests.delete(uid);
          if (db && hasPersistentLock && uid && jobId) {
            await releaseGenerationLock(uid, jobId, db);
          }
          await refundStory(uid, consumption.consumed, db).catch(refundErr =>
            logEvent(`[REFUND] inline refund after createJob fail: ${refundErr.message}`)
          );
          return res.status(500).json({ error: "Something went wrong. Please try again." });
        }

        // Respond immediately so the client connection can close. Phone can
        // sleep — the pipeline keeps running on the server. The polling
        // endpoint reads the durable job state.
        res.json({ jobId });
        logEvent(`[GENERATE] job=${jobId} rid=${req.requestId} uid=${uid} consumed=${consumption.consumed || "none"} mode=${incomingMode} length=${length}`);

        // Source of truth is now Firestore jobs for real users. We process
        // from persisted payload so restart recovery can resume in-flight work.
        if (db) {
          processFirestoreJob(jobId, db)
            .catch((err) => {
              logEvent(`[JOBS] process dispatch failed job=${jobId}: ${err.message}`);
            })
            .finally(() => {
              activeRequests.delete(uid);
            });
        } else {
          runStoryPipeline(storyInputs, { mode: normalizedMode, rawMode: incomingMode, cleanName, cleanDialect, cleanInterests, cleanIdea, cleanWish, cleanSeriesContext, cleanBeats, length })
            .then(async ({ story, title }) => {
              await resolveJob(jobId, story, title, db);
              logEvent(`[GENERATE] job=${jobId} done uid=${uid}`);
            })
            .catch(async (err) => {
              logEvent(`[GENERATE] job=${jobId} failed uid=${uid}: ${err.message}`);
              let refunded = false;
              try {
                await refundStory(uid, consumption.consumed, db);
                refunded = true;
                logEvent(`[REFUND] job=${jobId} uid=${uid} bucket=${consumption.consumed || "none"}`);
              } catch (refundErr) {
                logEvent(`[REFUND] job=${jobId} uid=${uid} FAILED: ${refundErr.message}`);
              }
              await failJob(jobId, "story_failed", db, { refunded });
            })
            .finally(() => {
              activeRequests.delete(uid);
            });
        }

      } catch (error) {
        logEvent(`Generate endpoint error: ${error.message}`);
        // If we made it past activeRequests.add but failed before the pipeline
        // started, the .finally above won't fire — clean up here.
        if (uid) activeRequests.delete(uid);
        if (db && hasPersistentLock && uid && jobId) {
          await releaseGenerationLock(uid, jobId, db);
        }
        res.status(500).json({ error: "Something went wrong. Please try again." });
      }
    }
  );

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

async function requireAppCheck(req, res, next) {
  if (!REQUIRE_APP_CHECK) return next();
  const token = req.headers["x-firebase-appcheck"];
  const ua = req.headers['user-agent'] || '';

  // If token present: verify normally and proceed
  if (token) {
    try {
      // Ensure Firebase Admin is initialized before calling getAppCheck()
      getFirebaseAdminInstance();
      await getAppCheck().verifyToken(token);
      const masked = String(token).slice(0, 8) + '...';
      logEvent(`[AppCheck] Valid token on ${req.path} from ${req.ip} ua=${ua} token_prefix=${masked}`);
      return next();
    } catch (err) {
      logEvent(`[AppCheck] Invalid token on ${req.path}: ${err.message} ua=${ua}`);
      // fall through to fallback below
    }
  } else {
    logEvent(`[AppCheck] Missing token on ${req.path} from ${req.ip} ua=${ua}`);
  }

  // FALLBACK: Some native WebViews (Capacitor/Android System WebView) do not
  // attach App Check tokens reliably. If a valid Firebase ID token is present
  // in Authorization header we accept the request after verifying it. This
  // preserves security (must be an authenticated user) while avoiding a hard
  // outage for mobile clients. App Check remains the preferred protection.
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) {
    try {
      const decoded = await getFirebaseAdminInstance().verifyIdToken(match[1]);
      logEvent(`[AppCheck] Fallback allowed on ${req.path} for uid=${decoded.uid} from ${req.ip} ua=${ua}`);
      // attach the verified auth info for downstream middleware
      req.authUser = decoded;
      return next();
    } catch (e) {
      logEvent(`[AppCheck] Fallback idToken verify failed on ${req.path}: ${e.message} ua=${ua}`);
      return res.status(401).json({ error: "App integrity check failed. Please refresh and try again." });
    }
  }

  // No token and no valid id token — enforce App Check
  return res.status(401).json({ error: "App integrity check failed. Please refresh and try again." });
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

// Normalise common leet-speak / character substitutions before safety checks.
// This catches "f*ck", "sh1t", "a$$hole", "b!tch", "@ss" etc.
function normalizeLeetSpeak(text) {
  return String(text || "")
    .replace(/[@4]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[5\$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/\*/g, "")     // "f*ck" → "fck" (close enough for boundary match)
    .replace(/\./g, "");    // "f.u.c.k" → "fuck"
}

// Child-safety word list — checked on every user-supplied input field and
// on every AI-generated story before it is sent to the client.
const CHILD_SAFETY_BANNED = [
  // profanity — English
  "fuck","shit","bitch","bastard","asshole","cunt","dick","cock","pussy","piss","crap","ass",
  // profanity — UK-specific
  "arse","arsehole","bollocks","wank","wanker","twat","shite","tosser","prick","bellend","twatface",
  // sexual
  "porn","nude","naked","boob","breast","penis","vagina","rape","molest","masturbat",
  "paedo","pedophile","paedophile","trafficking","groomer","nonce",
  // violence / weapons
  "kill","murder","gun","knife","stab","shoot","bomb","gore","terror","suicide",
  "torture","mutilate","decapitate","strangle","noose","slaughter",
  // drugs / alcohol
  "cocaine","heroin","meth","weed","drunk","cigarette","vape","overdose",
  // horror / occult
  "satan","devil","horror","nightmare","lucifer",
  // hate speech
  "nigger","faggot","retard","nazi","hitler","racist","slut","whore","chink","spastic",
];

// Word-boundary pattern. Stems ending in common suffixes get a wildcard
// so "masturbation", "paedophilia", "fucking" etc. are all caught.
const STEM_WORDS = new Set(["masturbat","paedo","pedophil","paedophil","wank","fuck","shit","arse","bolloc"]);

const SAFETY_PATTERN = new RegExp(
  CHILD_SAFETY_BANNED
    .map((w) => STEM_WORDS.has(w) ? `\\b${w}\\w*` : `\\b${w}\\b`)
    .join("|"),
  "i"
);

// Prompt injection patterns — prevents users trying to hijack the AI system prompt.
const INJECTION_PATTERN = /ignore\s+(previous|your|all|prior)\s+(instructions?|prompt|rules?|guidelines?)|forget\s+(everything|your|all)|your\s+new\s+instructions|act\s+as\s+(an?\s+)?(ai|assistant|chatgpt|gpt|claude)|pretend\s+(you\s+are|to\s+be)|you\s+are\s+now\s+|jailbreak|dan\s+mode|new\s+persona|disregard\s+(all|previous|your)|override\s+(your|all|previous)|system\s+prompt|bypass\s+(safety|filter|rules?)|roleplay\s+as\b/i;

function isUnsafeForChildren(text) {
  if (!text) return false;
  const normalized = normalizeLeetSpeak(text);
  return SAFETY_PATTERN.test(text) || SAFETY_PATTERN.test(normalized);
}

function containsPromptInjection(text) {
  if (!text) return false;
  return INJECTION_PATTERN.test(text);
}

function getSafeFallbackStory(name) {
  return `${name} snuggled into bed as the stars twinkled softly above.\n\nTonight was a peaceful night filled with gentle dreams, kind thoughts, and a quiet sense of magic.\n\nAs the moon smiled down, ${name} drifted into a calm and happy sleep, ready for a new adventure tomorrow.`;
}

// Returns { min, max } word bounds for a given age string — aligned with age-band tiers.
// These mirror getAgeWordTarget() in prompts.js but stay server-side
// so we don't import the ES module into the validator / enforcer.
function getAgeWordBounds(age, storyType) {
  // One-off sample stories are intentionally shorter — a preview of premium
  if (storyType === "oneoff-sample") return { min: 300, max: 450 };
  // Keepsake stories get the richest word budget
  if (storyType === "keepsake") return { min: 800, max: 1100 };
  const n = parseInt(age, 10);
  if (!isNaN(n) && n <= 5) return { min: 400, max: 650 };
  if (!isNaN(n) && n <= 8) return { min: 600, max: 850 };
  return { min: 700, max: 950 };
}

function countWords(text = "") {
  return String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function getPremiumWordFloor(length = "medium") {
  if (length === "long") return 1100;
  if (length === "short") return 500;
  return 700;
}

function enforceLength(text, age) {
  const words = text.split(" ");
  const { max } = getAgeWordBounds(age);
  if (words.length > max) {
    return words.slice(0, max).join(" ");
  }
  return text;
}

function cleanStory(text) {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function polishStory(text) {
  return text
    .replace(/^\s*---+\s*$/gm, "") // strip markdown dividers that break story flow
    .replace(/[ \t]{2,}/g, " ")   // collapse multiple spaces/tabs (preserve newlines)
    .replace(/\n{3,}/g, "\n\n")   // collapse triple+ newlines to double
    .trim();
}

function enhanceStoryFlow(text) {
  // Collapse horizontal whitespace only — \s+ would also flatten newlines and
  // destroy paragraph structure that polishStory() carefully preserves.
  return String(text || "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\. {2,}/g, ". ")
    .replace(/, {2,}/g, ", ")
    .trim();
}

const ENDING_CLOSERS = [
  "And as the stars kept gentle watch, sleep came softly.",
  "And the night held them close, warm and still.",
  "The world grew quiet around them, soft as a whispered goodnight.",
  "And somewhere in the stillness, a dream was already beginning.",
  "The lantern glowed softly. Everything was safe. Everything was good.",
];

function strengthenEnding(text) {
  const story = String(text || "").trim();
  if (!story) return story;
  if (!/sleep|dream|goodnight|good night|drift|still|quiet|peaceful/i.test(story.slice(-250))) {
    // Pick a closer deterministically based on story length so reruns are stable
    const closer = ENDING_CLOSERS[story.length % ENDING_CLOSERS.length];
    return `${story}\n\n${closer}`;
  }
  return story;
}

function validateStoryQuality(text, age) {
  if (!text) return false;

  const wordCount = text.split(" ").length;
  const wt = getAgeWordBounds(age);

  // Too short = weak or incomplete story
  if (wordCount < wt.min - 50) return false;

  // Too long = padding / runaway generation
  if (wordCount > wt.max + 50) return false;

  // Must contain paragraph structure
  if (!text.includes("\n")) return false;

  // Weak ending detection — check last 300 chars
  const lastPart = text.slice(-300).toLowerCase();
  const weakEndings = [
    "the end",
    "and then they went home",
    "it was all a dream",
  ];
  if (weakEndings.some(p => lastPart.includes(p))) return false;

  // DISNEY QUALITY GATE: Strict 8-10 enforcement
  // Check for bedtime softness (no harsh words)
  const harshWords = ["shouted", "crashed", "terrified", "violent", "screamed", "exploded", "danger", "monster", "nightmare", "evil"];
  if (harshWords.some(w => text.toLowerCase().includes(w))) {
    logEvent(`Quality gate rejected: harsh word detected in story for age ${age}`);
    return false;
  }

  // Check for child-as-hero signals (for family magic mode)
  const heroSignals = ["decided", "discovered", "figured out", "chose", "led", "solved", "helped", "noticed"];
  const heroCount = heroSignals.filter(s => text.toLowerCase().includes(s)).length;
  if (heroCount < 1) {
    logEvent(`Quality gate rejected: insufficient child-as-hero agency signals (${heroCount} found)`);
    return false;
  }

  // Check for emotional warmth (bedtime tone)
  const warmthWords = ["warm", "gentle", "soft", "loved", "safe", "calm", "peaceful", "cozy"];
  const warmthCount = warmthWords.filter(w => text.toLowerCase().includes(w)).length;
  if (warmthCount < 2) {
    logEvent(`Quality gate rejected: insufficient emotional warmth (${warmthCount} signals found)`);
    return false;
  }

  return true;
}

function isStoryOutputSafe(story) {
  if (!story) return false;
  return !SAFETY_PATTERN.test(story);
}

// Lightweight Disney-quality scoring — runs locally, replaces the editor API
// call in the lean pipeline. Score is out of 10. Threshold for "good enough"
// is 6; below that we trigger a single re-polish (still local, no API cost).
function hasRepetition(text) {
  // Catch back-to-back duplicate words and repeated 3-grams — a much better
  // smell test than "any word appears twice", which triggers on common words.
  const tokens = String(text).toLowerCase().match(/[a-z']+/g) || [];
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].length > 3 && tokens[i] === tokens[i - 1]) return true;
  }
  const trigrams = new Set();
  for (let i = 0; i + 2 < tokens.length; i++) {
    const key = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
    if (trigrams.has(key)) return true;
    trigrams.add(key);
  }
  return false;
}

function hasClearBeginning(text) {
  const opener = String(text).slice(0, 200).toLowerCase();
  if (!opener.trim()) return false;
  // Penalise generic openings; reward sensory / present-action openings.
  if (/^once upon a time|^there (was|once)/i.test(opener.trim())) return false;
  return opener.length > 40;
}

function hasClearEnding(text) {
  const tail = String(text).slice(-220).toLowerCase();
  return /goodnight|good night|sleep|dream|safe|warm|home|smile|peaceful|quiet|drift/i.test(tail);
}

function hasEmotionalArc(text) {
  const t = String(text).toLowerCase();
  const tension = /worried|curious|unsure|wondered|shy|nervous|hoped|wished|brave/i.test(t);
  const release = /happy|safe|smile|brave|warm|loved|proud|peaceful|gentle/i.test(t);
  return tension && release;
}

function readsNaturally(text) {
  const t = String(text);
  if (/\.{3,}/.test(t)) return false;
  if (/\?{2,}|!{2,}/.test(t)) return false;
  if (/\bTODO\b|\bDRAFT\b|\bNOTE\b/.test(t)) return false;
  return true;
}

function hasBedtimeTone(text) {
  return /sleep|dream|goodnight|soft|quiet|gentle|cozy/i.test(String(text || ""));
}

function hasImagery(text) {
  return /glow|warm|soft|sparkle|light|gentle|magic/i.test(String(text || ""));
}

function estimateQuality(story) {
  let score = 0;
  if (!story) return 0;
  if (story.length > 500) score += 1;
  if (!hasRepetition(story)) score += 2;
  if (hasClearBeginning(story)) score += 1;
  if (hasClearEnding(story)) score += 2;
  if (hasEmotionalArc(story)) score += 2;
  if (readsNaturally(story)) score += 1;
  if (hasBedtimeTone(story)) score += 1;
  if (hasImagery(story)) score += 1;
  return score; // out of 11
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
const CLAUDE_MODEL_OPUS   = "claude-opus-4-7";
const CLAUDE_MODEL_SONNET = "claude-sonnet-4-6";
const CLAUDE_MODEL_HAIKU  = "claude-haiku-4-5-20251001";
const CLAUDE_MODEL_DEFAULT = CLAUDE_MODEL_SONNET;
const API_VERSION = "2023-06-01";

// USE_OPUS_BLUEPRINT=true → Opus designs the story structure, Sonnet writes the prose.
// This gives Opus-quality narrative architecture at a fraction of full-Opus generation cost.
// Set to false to skip the blueprint stage entirely (pure Sonnet/Haiku generation).
// Force Opus blueprinting for superior narrative architecture
const USE_OPUS_BLUEPRINT = true;

// Tiered model selection:
//   Blueprint mode: Opus designs → Sonnet writes (all modes)
//   No blueprint: hero uses Sonnet, all others use Haiku
function getModelConfig({ mode, length } = {}) {
  if (USE_OPUS_BLUEPRINT) {
    // Prose writer is always Sonnet when Opus handles the blueprint
    return { model: CLAUDE_MODEL_SONNET, temperature: 0.82 };
  }
  if (mode === "hero") {
    return { model: CLAUDE_MODEL_SONNET, temperature: 0.85 };
  }
  // Haiku for all standard stories — fast (5-8s per call), great for children's stories
  return { model: CLAUDE_MODEL_HAIKU, temperature: 0.9 };
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
// Job Store — Firestore-backed for real users (durable across restarts),
// in-memory only for the anonymous dev path (no Firebase Admin available).
//
// Durable jobs are the source of truth: the server records the credit it
// consumed before the pipeline runs, so a crash mid-pipeline can be refunded
// by the sweeper instead of leaving the user paid-but-storyless.
// =============================================================================

const JOBS_COLLECTION = "jobs";
const JOB_STALE_MS = 10 * 60 * 1000;        // pipeline considered abandoned after this
const JOB_SWEEP_INTERVAL_MS = 2 * 60 * 1000; // how often the sweeper runs
const JOB_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // keep done/failed docs for 30 days for support
const JOB_LEASE_MS = 45 * 1000; // short lease so crashed workers recover quickly
const JOB_HEARTBEAT_MS = 15 * 1000;
const JOB_DISPATCH_INTERVAL_MS = 20 * 1000;
const GENERATION_LOCK_TTL_MS = 15 * 60 * 1000;
const USER_RATE_COLLECTION = "userRateLimits";
const USER_RATE_WINDOW_MS = 10 * 1000;
const USER_RATE_MAX_REQUESTS = 3;
const USER_DAILY_MAX_STORIES = 12; // hard daily cap (credit system is the soft cap)
const USER_LOCKS_COLLECTION = "generationLocks";
const INSTANCE_ID = crypto.randomUUID();

const jobStore = new Map(); // dev-anon only: jobId → { uid, status, story, title, error, createdAt }
const processingJobs = new Set();

async function createJob({ uid, db, consumed, ctx, jobId: providedJobId }) {
  const jobId = providedJobId || crypto.randomUUID();
  const base = {
    uid,
    status: "pending",
    consumed: consumed || null,
    createdAt: Date.now(),
    mode: ctx?.mode || null,
    rawMode: ctx?.rawMode || null,
    length: ctx?.length || null,
    childName: ctx?.cleanName || null,
    payload: ctx?.payload || null,
    refundedAt: null,
    completedAt: null,
    workerId: null,
    leaseUntil: null,
    lastHeartbeatAt: null,
  };
  if (db) {
    await db.collection(JOBS_COLLECTION).doc(jobId).set(base);
  } else {
    jobStore.set(jobId, base);
    setTimeout(() => jobStore.delete(jobId), JOB_STALE_MS);
  }
  return jobId;
}

async function resolveJob(jobId, story, title, db) {
  const update = { status: "done", story, title, completedAt: Date.now() };
  if (db) {
    try {
      await db.collection(JOBS_COLLECTION).doc(jobId).update(update);
    } catch (e) {
      logEvent(`resolveJob Firestore error for ${jobId}: ${e.message}`);
    }
  } else {
    const job = jobStore.get(jobId);
    if (job) jobStore.set(jobId, { ...job, ...update });
  }
}

async function enforcePersistentUserRateLimit(uid, db) {
  const now = Date.now();
  const todayUTC = new Date(now).toISOString().slice(0, 10); // "YYYY-MM-DD"
  const rateRef = db.collection(USER_RATE_COLLECTION).doc(uid);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateRef);
      const data = snap.exists ? snap.data() : {};

      // ── Per-10s burst window ──────────────────────────────────────────
      const windowStart = Number(data.windowStart || 0);
      const count = Number(data.count || 0);
      const windowExpired = !windowStart || now - windowStart >= USER_RATE_WINDOW_MS;

      // ── Daily cap ────────────────────────────────────────────────────
      const dailyDate = data.dailyDate || "";
      const dailyCount = dailyDate === todayUTC ? Number(data.dailyCount || 0) : 0;
      if (dailyCount >= USER_DAILY_MAX_STORIES) {
        logEvent(`[RATE] daily cap hit uid=${uid} dailyCount=${dailyCount}`);
        return { limited: true, reason: "daily" };
      }

      // ── Burst window ──────────────────────────────────────────────────
      if (!windowExpired && count >= USER_RATE_MAX_REQUESTS) {
        return { limited: true, reason: "burst" };
      }

      tx.set(rateRef, {
        windowStart: windowExpired ? now : windowStart,
        count: windowExpired ? 1 : count + 1,
        dailyDate: todayUTC,
        dailyCount: dailyCount + 1,
        updatedAt: now,
        expiresAt: now + (2 * USER_RATE_WINDOW_MS),
      }, { merge: true });
      return { limited: false };
    });
  } catch (e) {
    logEvent(`[RATE] persistent limiter failed for uid=${uid}: ${e.message}`);
    return { limited: false };
  }
}

async function acquireGenerationLock(uid, jobId, db) {
  const now = Date.now();
  const lockRef = db.collection(USER_LOCKS_COLLECTION).doc(uid);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      if (snap.exists) {
        const lock = snap.data();
        if ((lock.expiresAt || 0) > now) {
          return { ok: false, existingJobId: lock.jobId || null };
        }
      }

      tx.set(lockRef, {
        uid,
        jobId,
        createdAt: now,
        expiresAt: now + GENERATION_LOCK_TTL_MS,
      }, { merge: true });
      return { ok: true };
    });
  } catch (e) {
    logEvent(`[LOCK] acquire failed uid=${uid}: ${e.message}`);
    return { ok: false };
  }
}

async function refreshGenerationLock(uid, jobId, db) {
  const lockRef = db.collection(USER_LOCKS_COLLECTION).doc(uid);
  const now = Date.now();
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      if (!snap.exists) return;
      const lock = snap.data();
      if (lock.jobId !== jobId) return;
      tx.update(lockRef, {
        expiresAt: now + GENERATION_LOCK_TTL_MS,
        updatedAt: now,
      });
    });
  } catch (e) {
    logEvent(`[LOCK] refresh failed uid=${uid} job=${jobId}: ${e.message}`);
  }
}

async function releaseGenerationLock(uid, jobId, db) {
  if (!uid || !db) return;
  const lockRef = db.collection(USER_LOCKS_COLLECTION).doc(uid);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      if (!snap.exists) return;
      const lock = snap.data();
      if (lock.jobId !== jobId) return;
      tx.delete(lockRef);
    });
  } catch (e) {
    logEvent(`[LOCK] release failed uid=${uid} job=${jobId}: ${e.message}`);
  }
}

async function claimFirestoreJob(jobId, db) {
  const now = Date.now();
  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(jobRef);
      if (!snap.exists) return { claimed: false, reason: "missing" };

      const data = snap.data();
      if (data.status === "done" || data.status === "failed") {
        return { claimed: false, reason: "terminal" };
      }

      const leaseUntil = Number(data.leaseUntil || 0);
      const heldByOther = data.status === "running"
        && leaseUntil > now
        && data.workerId
        && data.workerId !== INSTANCE_ID;

      if (heldByOther) {
        return { claimed: false, reason: "leased" };
      }

      tx.update(jobRef, {
        status: "running",
        workerId: INSTANCE_ID,
        leaseUntil: now + JOB_LEASE_MS,
        startedAt: data.startedAt || now,
        lastHeartbeatAt: now,
      });

      return {
        claimed: true,
        data: {
          ...data,
          status: "running",
          workerId: INSTANCE_ID,
          leaseUntil: now + JOB_LEASE_MS,
        },
      };
    });
  } catch (e) {
    logEvent(`[JOBS] claim failed for ${jobId}: ${e.message}`);
    return { claimed: false, reason: "error" };
  }
}

async function heartbeatFirestoreJob(jobId, db) {
  const now = Date.now();
  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(jobRef);
      if (!snap.exists) return;
      const data = snap.data();
      if (data.status !== "running") return;
      if (data.workerId !== INSTANCE_ID) return;
      tx.update(jobRef, {
        leaseUntil: now + JOB_LEASE_MS,
        lastHeartbeatAt: now,
      });
    });
  } catch (e) {
    logEvent(`[JOBS] heartbeat failed for ${jobId}: ${e.message}`);
  }
}

async function processFirestoreJob(jobId, db) {
  if (!jobId || !db || processingJobs.has(jobId)) return;
  processingJobs.add(jobId);

  let heartbeat = null;
  let claimed = null;
  let uid = null;
  let consumed = null;

  try {
    claimed = await claimFirestoreJob(jobId, db);
    if (!claimed?.claimed) return;

    const data = claimed.data || {};
    uid = data.uid || null;
    consumed = data.consumed || null;
    const payload = data.payload || null;

    if (!payload?.storyInputs || !payload?.pipeline) {
      throw new Error("job payload missing");
    }

    heartbeat = setInterval(() => {
      heartbeatFirestoreJob(jobId, db).catch((e) => {
        logEvent(`[JOBS] heartbeat timer error for ${jobId}: ${e.message}`);
      });
      if (uid) {
        refreshGenerationLock(uid, jobId, db).catch((e) => {
          logEvent(`[LOCK] refresh timer error uid=${uid} job=${jobId}: ${e.message}`);
        });
      }
    }, JOB_HEARTBEAT_MS);

    logEvent(`[JOBS] processing job=${jobId} uid=${uid || "unknown"}`);
    const _jobStart = Date.now();
    const { story, title } = await runStoryPipeline(payload.storyInputs, payload.pipeline);
    await resolveJob(jobId, story, title, db);
    logEvent(`[JOBS] done job=${jobId} uid=${uid || "unknown"} ms=${Date.now() - _jobStart}`);
  } catch (err) {
    logEvent(`[JOBS] failed job=${jobId}: ${err.message}`);
    let refunded = false;
    if (uid && consumed) {
      try {
        await refundStory(uid, consumed, db);
        refunded = true;
        logEvent(`[REFUND] job=${jobId} uid=${uid} bucket=${consumed}`);
      } catch (refundErr) {
        logEvent(`[REFUND] job=${jobId} uid=${uid} FAILED: ${refundErr.message}`);
      }
    }
    await failJob(jobId, "story_failed", db, { refunded });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (uid) {
      await releaseGenerationLock(uid, jobId, db);
    }
    processingJobs.delete(jobId);
  }
}

async function dispatchPendingJobs() {
  if (!hasFirebaseAdminConfigured()) return;
  let db;
  try { db = getFirestoreDb(); } catch { return; }

  try {
    const snap = await db.collection(JOBS_COLLECTION)
      .where("status", "in", ["pending", "running"])
      .limit(20)
      .get();

    for (const doc of snap.docs) {
      processFirestoreJob(doc.id, db).catch((e) => {
        logEvent(`[JOBS] dispatch error for ${doc.id}: ${e.message}`);
      });
    }
  } catch (e) {
    logEvent(`[JOBS] dispatch query error: ${e.message}`);
  }
}

async function failJob(jobId, errorMsg, db, { refunded = false } = {}) {
  const update = {
    status: "failed",
    error: errorMsg || null,
    completedAt: Date.now(),
  };
  if (refunded) update.refundedAt = Date.now();
  if (db) {
    try {
      await db.collection(JOBS_COLLECTION).doc(jobId).update(update);
    } catch (e) {
      logEvent(`failJob Firestore error for ${jobId}: ${e.message}`);
    }
  } else {
    const job = jobStore.get(jobId);
    if (job) jobStore.set(jobId, { ...job, ...update });
  }
}

// Read a job for the polling endpoint. Verifies the requesting uid owns the
// job (anyone querying someone else's jobId gets `forbidden`, never the data).
async function loadJob(jobId, requestingUid) {
  // In-memory first (cheap; covers dev-anon and freshly-created jobs).
  const mem = jobStore.get(jobId);
  if (mem) {
    if (mem.uid && requestingUid && mem.uid !== requestingUid) {
      return { status: "forbidden" };
    }
    return mem;
  }
  // Firestore lookup for real users.
  if (!hasFirebaseAdminConfigured()) return { status: "expired" };
  try {
    const db = getFirestoreDb();
    const snap = await db.collection(JOBS_COLLECTION).doc(jobId).get();
    if (!snap.exists) return { status: "expired" };
    const data = snap.data();
    if (requestingUid && data.uid && data.uid !== requestingUid) {
      return { status: "forbidden" };
    }
    return {
      status: data.status,
      story: data.story || null,
      title: data.title || null,
      error: data.error || null,
      consumed: data.consumed || null,
    };
  } catch (e) {
    logEvent(`loadJob error for ${jobId}: ${e.message}`);
    return { status: "expired" };
  }
}

function hasFirebaseAdminConfigured() {
  return !!(
    (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    FIREBASE_PROJECT_ID
  );
}

// Sweeper — finds pending jobs older than JOB_STALE_MS and refunds them.
// Runs both on startup and on a setInterval. Uses a Firestore transaction
// to be safe across multiple server instances: only one sweeper per job
// will flip status from pending → failed and trigger the refund.
async function sweepStalePendingJobs() {
  if (!hasFirebaseAdminConfigured()) return;
  let db;
  try { db = getFirestoreDb(); } catch { return; }

  const cutoff = Date.now() - JOB_STALE_MS;
  const now = Date.now();
  let stale;
  try {
    stale = await db.collection(JOBS_COLLECTION)
      .where("status", "in", ["pending", "running"])
      .where("createdAt", "<", cutoff)
      .limit(20)
      .get();
  } catch (e) {
    // Most likely a missing composite index on (status, createdAt).
    // Logged once per sweep so the operator notices and creates the index.
    logEvent(`Sweeper query error (likely missing Firestore index status+createdAt): ${e.message}`);
    return;
  }

  for (const doc of stale.docs) {
    const data = doc.data();
    let didRefund = false;
    try {
      didRefund = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        if (!fresh.exists) return false;
        const d = fresh.data();
        if (d.status !== "pending" && d.status !== "running") return false;
        if (d.status === "running" && Number(d.leaseUntil || 0) > now) return false;
        if (d.refundedAt) return false;
        tx.update(doc.ref, {
          status: "failed",
          error: "abandoned_by_server",
          completedAt: Date.now(),
          refundedAt: Date.now(),
        });
        return true;
      });
    } catch (e) {
      logEvent(`Sweeper transaction error for ${doc.id}: ${e.message}`);
      continue;
    }
    if (didRefund && data.consumed) {
      try {
        await refundStory(data.uid, data.consumed, db);
        await releaseGenerationLock(data.uid, doc.id, db);
        logEvent(`[SWEEPER] Refunded abandoned job ${doc.id} for uid=${data.uid} bucket=${data.consumed}`);
      } catch (e) {
        logEvent(`[SWEEPER] Refund failed for ${doc.id}: ${e.message}`);
      }
    } else if (didRefund) {
      await releaseGenerationLock(data.uid, doc.id, db);
      logEvent(`[SWEEPER] Marked job ${doc.id} failed (no credit consumed; nothing to refund)`);
    }
  }
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


app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// HTTPS redirect — must be first in production
if (process.env.NODE_ENV === "production") {
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
        // 'unsafe-inline' removed from scriptSrc — inline scripts moved to
        // app-bridge.js. Firebase CDN modules are ES modules loaded via
        // import() from app.js (same-origin script); gstatic hosts the SDK.
        // Hash allows the inline script Firebase SDK injects during auth redirects.
        scriptSrc: ["'self'", "https://www.gstatic.com", "https://apis.google.com", "https://www.google.com", "'sha256-MZ5pOnzzljePZPISJ/To4rVQ+wFS4PK2f4PhHmAIW7Q='"],
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://*.firebaseio.com",
          "https://*.firebaseapp.com",
          "https://*.firebasestorage.app",
          "https://www.gstatic.com",
          "https://www.google.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://firestore.googleapis.com",
          "https://firebaseinstallations.googleapis.com",
          "https://recaptchaenterprise.googleapis.com",
          "https://firebaseappcheck.googleapis.com",
        ],
        frameSrc: ["'self'", "https://*.firebaseapp.com", "https://*.firebaseauth.com", "https://www.google.com", "https://recaptcha.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);

// Request size limit
app.use(express.json({ limit: "10kb" }));
app.use(compression());

// CORS — scoped to API routes only.
// Applying CORS globally blocks same-origin static assets (app.js, CSS, fonts)
// with HTTP 500 when the request's Origin header isn't in ALLOWED_ORIGINS,
// because Express's default error handler converts the thrown CORS error to 500.
// Static file requests are same-origin and don't need CORS at all; only the
// JSON API routes below need to opt in.
// Duplicate corsMiddleware declaration removed. The global definition at the top is used.

// Duplicate generateLimiter declaration removed. The definition at the top is used.

const polishLimiter = buildAiLimiter({
  windowMs: POLISH_LIMIT_WINDOW_MS,
  max: POLISH_LIMIT_MAX,
  routeLabel: "/polish",
});

// Request logging — includes trace ID for log correlation
app.use((req, res, next) => {
  logEvent(`[${req.requestId}] ${req.method} ${req.url}`);
  next();
});

// =============================
// PRODUCTION CACHING HEADERS
// =============================
app.use((req, res, next) => {
  if (req.url === '/sw.js' || req.url === '/offline.js') {
    res.setHeader('Cache-Control', 'no-cache');
  } else if (req.url.match(/\.(js|css|png|jpg|jpeg|webp|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

// Digital Asset Links — required for Android TWA/Capacitor app verification.
// Replace SHA256_CERT_FINGERPRINT with the output of:
//   keytool -list -v -keystore dreamtalez-release.jks -alias dreamtalez
// in the "SHA256:" line (colon-separated hex pairs).
app.get("/.well-known/assetlinks.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.dreamtalez.app",
      sha256_cert_fingerprints: [
        process.env.ANDROID_SHA256_FINGERPRINT || "REPLACE_WITH_RELEASE_KEYSTORE_SHA256",
      ],
    },
  }]);
});

// Static files — ETags enabled for JS/CSS so browser caches on repeat visits.
// index.html stays no-store (set below) so new deploys are always picked up.
app.use(express.static(PUBLIC_DIR, {
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    // HTML: never cache — always fetch fresh so deploys take effect immediately
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    } else {
      // JS/CSS/images: cache for 1 day, revalidate with ETag
      // Browser sends If-None-Match; server returns 304 if unchanged (no re-download)
      res.setHeader("Cache-Control", "public, max-age=86400, must-revalidate");
    }
  },
}));

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
  requireAppCheck,
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
      const cleanDialect = resolveLanguageCode(dialect);
      const polishMode = mode === "rewrite" ? "rewrite" : "edit";

      logEvent(`Polish endpoint: ${polishMode} pass on procedural story`);

      // Rewrite mode = aggressive Disney-grade rewrite of a rough procedural
      // draft. Edit mode = conservative grammar/flow pass on an AI story.
      const polishSystem = EDITOR_SYSTEM_PROMPT;
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
// Teddy top-up / credit status endpoint
// =============================================================================
app.options("/api/teddy-topup", corsMiddleware);
app.get("/api/teddy-topup", corsMiddleware, requireAiAuth, async (req, res) => {
  const uid = req.authUser?.uid;
  const email = req.authUser?.email || "";
  const isDevAccount = DEVELOPER_EMAILS.has(email);
  // Anonymous local dev (REQUIRE_AUTH_FOR_AI_ROUTES=false) — no Firestore lookup.
  // Treat as premium so the local UI works, but never apply this branch in prod
  // (preflightCheck refuses to boot in prod when REQUIRE_AUTH_FOR_AI_ROUTES=false).
  if (!uid) return res.json({ teddies_remaining: 999, teddies_last_reset: null, is_premium: true });

  try {
    const db = getFirestoreDb();
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const remaining = getTotalCredits(userData);
    // Premium = active subscription OR an explicitly listed developer account.
    // We deliberately do NOT trust NODE_ENV here — that bypass would let any
    // signed-in user against a dev server appear premium client-side.
    const isPremium = !!(userData.isSubscribed || userData.isPremium || isDevAccount);
    return res.json({
      teddies_remaining: remaining,
      teddies_last_reset: userData.subscriptionStartDate || null,
      is_premium: isPremium,
    });
  } catch (e) {
    logEvent(`teddy-topup error: ${e.message}`);
    return res.json({ teddies_remaining: null, teddies_last_reset: null, is_premium: isDevAccount });
  }
});

// =============================================================================
// Stripe — checkout + webhook
// =============================================================================

app.options("/api/checkout", corsMiddleware);
// =============================================================================
// Account Deletion
// Cancels Stripe subscription, wipes all Firestore user data, deletes Auth
// account. Client is responsible for clearing localStorage and unregistering
// the service worker after receiving 200.
// =============================================================================

app.delete("/api/account", corsMiddleware, requireAiAuth, async (req, res) => {
  const uid = req.authUser?.uid;
  if (!uid) return res.status(401).json({ error: "Not authenticated." });

  try {
    const db = hasFirebaseAdminConfigured() ? getFirestoreDb() : null;

    // 1. Fetch user doc to get Stripe subscription ID
    let subscriptionId = null;
    if (db) {
      const userSnap = await db.collection("users").doc(uid).get();
      subscriptionId = userSnap.exists ? userSnap.data()?.subscriptionId : null;
    }

    // 2. Cancel Stripe subscription (non-fatal — don't block deletion if Stripe fails)
    if (subscriptionId) {
      try {
        await cancelSubscription(subscriptionId);
        logEvent(`[DELETE] Stripe subscription cancelled uid=${uid}`);
      } catch (stripeErr) {
        logEvent(`[DELETE] Stripe cancel warning uid=${uid}: ${stripeErr.message}`);
      }
    }

    // 3. Delete Firestore user documents (batch for atomicity)
    if (db) {
      const batch = db.batch();
      batch.delete(db.collection("users").doc(uid));
      batch.delete(db.collection(USER_RATE_COLLECTION).doc(uid));
      batch.delete(db.collection(USER_LOCKS_COLLECTION).doc(uid));
      await batch.commit();

      // Clean up job queue entries (query-based, not batchable by key)
      const jobsSnap = await db.collection(JOBS_COLLECTION)
        .where("uid", "==", uid)
        .limit(50)
        .get();
      if (!jobsSnap.empty) {
        const jobBatch = db.batch();
        jobsSnap.docs.forEach(d => jobBatch.delete(d.ref));
        await jobBatch.commit();
      }
    }

    // 4. Invalidate in-memory profile cache
    invalidateProfile(uid);

    // 5. Delete the Firebase Auth account (point of no return)
    await getFirebaseAdminInstance().deleteUser(uid);

    logEvent(`[DELETE] Account fully deleted uid=${uid}`);
    return res.json({ success: true });

  } catch (err) {
    console.error(`[DELETE] Failed uid=${uid}:`, err.message);
    return res.status(500).json({ error: "Account deletion failed. Please try again." });
  }
});

app.post("/api/checkout", corsMiddleware, express.json({ limit: "4kb" }), (req, res, next) => {
  const type = req.body?.type;
  // One-off 99p checkout can be started as a guest (no signup/login).
  if (type === "oneoff") {
    return createCheckoutSession(req, res);
  }
  return requireAiAuth(req, res, () => createCheckoutSession(req, res));
});

app.options("/api/guest/generate-oneoff", corsMiddleware);
app.post(
  "/api/guest/generate-oneoff",
  corsMiddleware,
  express.json({ limit: "8kb" }),
  requireAppCheck,
  generateLimiter,
  [
    body("checkoutSessionId").isString().isLength({ min: 10, max: 200 }).trim(),
    body("name").isString().isLength({ min: 1, max: 50 }).trim(),
    body("gender").optional().isIn(["boy", "girl", "neutral"]),
    body("language").optional().isString().isLength({ max: 10 }).trim(),
    body("dialect").optional().custom(isSupportedStoryLocale),
  ],
  async (req, res) => {
    try {
      if (!AI_ENABLED) {
        return res.status(503).json({
          error: "Story generation is temporarily unavailable. Please try again shortly.",
          reason: "ai_unconfigured",
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Please provide valid child details." });
      }

      const checkoutSessionId = String(req.body?.checkoutSessionId || "").trim();
      const purchase = await validateAndConsumeGuestOneoff(checkoutSessionId);
      if (!purchase.ok) {
        return res.status(purchase.status || 400).json({ error: purchase.error || "Purchase validation failed." });
      }

      const cleanName = sanitizeInput(req.body?.name || "").slice(0, 50) || "Little Star";
      const cleanGender = ["boy", "girl", "neutral"].includes(req.body?.gender) ? req.body.gender : "neutral";
      const cleanDialect = resolveLanguageCode(req.body?.dialect || req.body?.language || "en-GB");
      const cleanInterests =
        cleanGender === "boy"
          ? "adventure, friendship, stars, kindness"
          : cleanGender === "girl"
            ? "magic, friendship, stars, kindness"
            : "imagination, friendship, stars, kindness";

      const storyInputs = {
        name: cleanName,
        age: "5",
        interests: cleanInterests,
        length: "short",
        mode: "medium-surprise",
        storyType: "oneoff-sample",
        language: cleanDialect,
        dialect: cleanDialect,
        customIdea: "A short, magical bedtime sample story — warm, cozy, and complete. 350-420 words only. No continuation hooks.",
        therapeuticSituation: "",
        seriesContext: "",
        childWish: "",
        dayBeats: "",
        dayMood: "",
        globalInspiration: undefined,
        appearance: undefined,
        personalWorld: undefined,
        gender: cleanGender,
        siblings: undefined,
        family: undefined,
        cultural_world: undefined,
        recurring_character: undefined,
        last_story_summary: undefined,
      };

      const { story, title } = await runStoryPipeline(storyInputs, {
        mode: "random",
        rawMode: "medium-surprise",
        cleanName,
        cleanDialect,
        cleanInterests,
        cleanIdea: "",
        cleanWish: "",
        cleanSeriesContext: "",
        cleanBeats: "",
        length: "medium",
        useFullPipeline: true,
        maxAttempts: 2,
      });

      return res.json({ story, title: title || `${cleanName}'s Bedtime Story` });
    } catch (error) {
      logEvent(`Guest one-off generation error: ${error.message}`);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  }
);

// Webhook must use raw body — register BEFORE any global json middleware
app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
  handleWebhook(req, res);
});

// =============================================================================
// Analytics — fire-and-forget event logging
// =============================================================================

app.options("/track", corsMiddleware);
app.post("/track", corsMiddleware, requireAiAuth, express.json({ limit: "4kb" }), (req, res) => {
  const { event, data } = req.body || {};
  if (!event || typeof event !== "string") return res.json({ ok: false });
  const safe = event.replace(/[^a-z0-9_]/gi, "").slice(0, 64);
  console.log(`[TRACK] uid=${req.authUser?.uid || "anon"} event=${safe}`, JSON.stringify(data || {}).slice(0, 200));
  res.json({ ok: true });
});

app.options("/generate", corsMiddleware);

// Valid raw modes for story identity — anything outside this set falls back to "adventure"
const VALID_STORY_MODES = ["sleepy", "adventure", "therapeutic", "hero", "custom", "create", "today", "random", "medium-surprise", "long-surprise", "family-magic", "keepsake"];

async function runStoryPipeline(storyInputs, { mode, rawMode, cleanName, cleanDialect, cleanInterests, cleanIdea, cleanWish, cleanSeriesContext, cleanBeats, length, useFullPipeline, maxAttempts }) {
  const runFullPipeline = typeof useFullPipeline === "boolean" ? useFullPipeline : USE_FULL_AI_PIPELINE;
  // Lean = single generate call, scored locally. The strong system prompt is
  // the substitute for the old editor pass — burning a second 10-15s call on
  // grammar adds latency without measurable quality lift on Haiku output.
  const maxTries = Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : (runFullPipeline ? 3 : 1);
  const safeRawMode = rawMode && VALID_STORY_MODES.includes(rawMode) ? rawMode : "adventure";
  if (!rawMode || !VALID_STORY_MODES.includes(rawMode)) {
    logEvent(`[WARN] Invalid story mode received: "${rawMode}" — falling back to "adventure"`);
  }
  const modelConfig = getModelConfig({ mode, length });
  logEvent(`Model config for "${cleanName}": ${modelConfig.model} @ temp ${modelConfig.temperature}`);

  const _st = storyInputs.storyType;
  const storyMaxTokens    = getStoryTokenBudget(length, "story",     storyInputs.language, _st);
  const editorMaxTokens   = getStoryTokenBudget(length, "editor",    storyInputs.language, _st);
  const validatorMaxTokens = getStoryTokenBudget(length, "validator", storyInputs.language, _st);
  const titleMaxTokens    = getStoryTokenBudget(length, "title",     storyInputs.language, _st);

  let finalStory = null;
  let cleanTitle = null;

  // Phase 4: build adaptive intelligence block once per pipeline run
  const { promptBlock: adaptivePromptBlock } = buildAdaptiveStoryflow({
    bedtimeHour:             storyInputs.bedtimeHour,
    ageRange:                parseInt(storyInputs.age, 10) || 5,
    previousStoryIntensity:  storyInputs.previousStoryIntensity,
    continuityMemory:        storyInputs.familyMagic?.enabled ? storyInputs.familyMagic : undefined,
  });
  logEvent(`[ADAPTIVE] bedtimeHour=${storyInputs.bedtimeHour} age=${storyInputs.age} intensity=${storyInputs.previousStoryIntensity}`);

  // Opus Blueprint Stage — runs once before the generation loop.
  // Opus designs the emotional structure; Sonnet executes it as full prose.
  // Skipped when USE_OPUS_BLUEPRINT is false (env-controlled, default off).
  let storyBlueprint = null;
  if (USE_OPUS_BLUEPRINT) {
    try {
      const blueprintPrompt = buildBlueprintPrompt({
        name:           cleanName,
        age:            storyInputs.age,
        interests:      cleanInterests,
        mode:           safeRawMode,
        customIdea:     cleanIdea,
        dayBeats:       cleanBeats,
        familyMagic:    storyInputs.familyMagic,
        bedtimeHour:    storyInputs.bedtimeHour,
        adaptivePromptBlock,
      });
      storyBlueprint = await callClaudeWithRetry({
        system:    BLUEPRINT_SYSTEM_PROMPT,
        prompt:    blueprintPrompt,
        maxTokens: 300,
        temperature: 0.7,
        model:     CLAUDE_MODEL_OPUS,
      });
      logEvent(`[BLUEPRINT] Opus blueprint complete for "${cleanName}" (${storyBlueprint.split("\n").length} directives)`);
    } catch (blueprintErr) {
      // Blueprint failure is non-fatal — fall through to prose without it
      logEvent(`[BLUEPRINT] Opus blueprint failed for "${cleanName}": ${blueprintErr.message} — continuing without blueprint`);
      storyBlueprint = null;
    }
  }

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    if (attempt > 1) logEvent(`Regeneration triggered for "${cleanName}" (attempt ${attempt})`);

    const storyPrompt = buildStoryPrompt({
      ...storyInputs,
      mode: safeRawMode,
      customIdea: cleanIdea,
      childWish: cleanWish,
      dayBeats: cleanBeats,
      adaptivePromptBlock,
      storyBlueprint,
    });
    // Use Opus-authored locked system prompt when available; fall back to static
    const activeSystemPrompt = LOCKED_SYSTEM_PROMPT || STORY_SYSTEM_PROMPT;
    const _t1 = Date.now();
    const rawStory = await callClaudeWithRetry({
      system: activeSystemPrompt, prompt: storyPrompt,
      maxTokens: storyMaxTokens, temperature: modelConfig.temperature, model: modelConfig.model,
    });
    // Track estimated spend: ~$15/1M output tokens for Sonnet 4.6
    addSpend((rawStory.split(/\s+/).length / 0.75) * 0.000015);
    logEvent(`Stage 1 complete (generate) for "${cleanName}" [attempt ${attempt}] ms=${Date.now() - _t1} [system=${LOCKED_SYSTEM_PROMPT ? "locked" : "static"}]`);

    if (!runFullPipeline) {
      // Lean: single generate call → local clean → score → return. No retry
      // loop. The strong STORY_SYSTEM_PROMPT enforces structure, tone, and
      // emotional arc, replacing the editor API pass.
      let candidate = finalizeStoryLocally(rawStory, cleanDialect, `Final story for ${cleanName}`);
      candidate = polishStory(candidate);
      candidate = enhanceStoryFlow(candidate);
      let score = estimateQuality(candidate);
      if (score < 7) {
        // Borderline — one local re-polish (no API cost) and re-score.
        candidate = polishStory(candidate);
        candidate = strengthenEnding(candidate);
        candidate = enhanceStoryFlow(candidate);
        score = estimateQuality(candidate);
      }
      if (score < 4) {
        logEvent(`[WARN] Low quality score for "${cleanName}": ${score}/11 — serving anyway, no retry`);
      }
      logEvent(`story_generated ${JSON.stringify({ qualityScore: score, length: candidate.length, mode: "lean", child: cleanName })}`);
      finalStory = candidate;
      cleanTitle = `${cleanName}'s Bedtime Story`;
      break;
    }

    const _t2 = Date.now();
    const grammarPrompt = buildGrammarPrompt(rawStory, cleanDialect);
    const editedStory = await callClaudeWithRetry({
      system: EDITOR_SYSTEM_PROMPT, prompt: grammarPrompt,
      maxTokens: editorMaxTokens, temperature: 0.2, model: modelConfig.model,
    });

    const titlePrompt = buildTitlePrompt(rawStory, cleanName, cleanDialect);
    const title = await callClaudeWithRetry({
      prompt: titlePrompt, maxTokens: titleMaxTokens, temperature: 0.4, model: modelConfig.model,
    });
    logEvent(`Stage 2 complete (edit + title) for "${cleanName}" [attempt ${attempt}] ms=${Date.now() - _t2}`);

    const _t3 = Date.now();
    const validationPrompt = buildValidationPrompt(editedStory, {
      mode, dialect: cleanDialect, interests: cleanInterests, customIdea: cleanIdea,
      childWish: cleanWish, seriesContext: cleanSeriesContext, dayBeats: cleanBeats,
    });
    const validatorOutput = await callClaudeWithRetry({
      system: VALIDATOR_SYSTEM_PROMPT, prompt: validationPrompt,
      maxTokens: validatorMaxTokens, temperature: 0.1, model: modelConfig.model,
    });
    logEvent(`Stage 3 complete (validate) for "${cleanName}" [attempt ${attempt}] ms=${Date.now() - _t3}`);

    if (validatorOutput.trim() === "REGENERATE") {
      logEvent(`Validator triggered REGENERATE for "${cleanName}" [attempt ${attempt}]`);
      continue;
    }
    const validatorIssues = detectStoryQualityIssues(validatorOutput, { dialect: cleanDialect });
    if (validatorIssues.length) {
      logEvent(`Validator issues for "${cleanName}" [attempt ${attempt}]: ${validatorIssues.join(" | ")}`);
      continue;
    }

    // Premium gate: reject short/incomplete outputs even if validator text looked clean.
    if (!validateStoryQuality(validatorOutput, storyInputs.age)) {
      logEvent(`[QUALITY_GATE_FAILED] Validator output failed Disney quality bar for "${cleanName}" [attempt ${attempt}] — regenerating with stricter prompt`);
      // Inject stricter quality feedback into next attempt
      continue;
    }

    const premiumWordFloor = getPremiumWordFloor(length);
    const validatorWordCount = countWords(validatorOutput);
    if (validatorWordCount < premiumWordFloor) {
      logEvent(`Validator output too short for premium bar (got ${validatorWordCount}, need ${premiumWordFloor}) for "${cleanName}" [attempt ${attempt}]`);
      continue;
    }

    finalStory = validatorOutput;
    cleanTitle = title.replace(/["']/g, "").trim();
    break;
  }

  if (!finalStory) {
    logEvent(`[PIPELINE_EXHAUSTED] All generation attempts failed Disney quality gate for "${cleanName}" — attempting emergency premium recovery`);
    try {
      const emergencyPrompt = `${buildStoryPrompt({
        ...storyInputs,
        mode: safeRawMode,
        customIdea: cleanIdea,
        childWish: cleanWish,
        dayBeats: cleanBeats,
        adaptivePromptBlock,
        storyBlueprint,
      })}\n\nEMERGENCY QUALITY BAR (STRICT):\n- Complete, emotionally satisfying bedtime arc (beginning, middle, end).\n- No markdown dividers, no section headings, no abrupt cut-offs.\n- 900 to 1300 words.\n- Child is clearly safe and settled by the final sentence.`;

      const emergencyRaw = await callClaudeWithRetry({
        system: LOCKED_SYSTEM_PROMPT || STORY_SYSTEM_PROMPT,
        prompt: emergencyPrompt,
        maxTokens: storyMaxTokens,
        temperature: modelConfig.temperature,
        model: modelConfig.model,
      });

      const emergencyEdited = await callClaudeWithRetry({
        system: EDITOR_SYSTEM_PROMPT,
        prompt: buildGrammarPrompt(emergencyRaw, cleanDialect),
        maxTokens: editorMaxTokens,
        temperature: 0.2,
        model: modelConfig.model,
      });

      const emergencyCandidate = polishStory(finalizeStoryLocally(emergencyEdited, cleanDialect, `Emergency story for ${cleanName}`));
      if (!validateStoryQuality(emergencyCandidate, storyInputs.age)) {
        throw new Error(`Emergency premium story did not meet Disney quality bar (8-10 standard) for ${cleanName}`);
      }
      if (countWords(emergencyCandidate) < getPremiumWordFloor(length)) {
        throw new Error("Emergency premium story was below premium word floor");
      }

      finalStory = emergencyCandidate;
      cleanTitle = `${cleanName}'s Bedtime Story`;
      logEvent(`Emergency premium recovery succeeded for "${cleanName}"`);
    } catch (e) {
      logEvent(`Emergency premium recovery failed for "${cleanName}": ${e.message}`);
      finalStory = getSafeFallbackStory(cleanName);
      cleanTitle = `${cleanName}'s Bedtime Story`;
    }
  }

  finalStory = runFullPipeline
    ? await runDeliveryQaPass(finalStory, cleanDialect)
    : finalizeStoryLocally(finalStory, cleanDialect, `Final story for ${cleanName}`);

  if (runFullPipeline) {
    finalStory = assertStoryQuality(finalStory, { dialect: cleanDialect, label: `Final story for ${cleanName}` });
  }

  // Enforce word limit and polish whitespace
  finalStory = enforceLength(finalStory, storyInputs.age);
  finalStory = polishStory(finalStory);

  // Phase 3: prose rhythm pass — adds lullaby cadence to common patterns (all stories)
  finalStory = applyRhythm(finalStory);

  // Phase 2: Family Magic softness pass — catches residual sharp language
  if (storyInputs.familyMagic?.enabled) {
    finalStory = applyBedtimeSoftness(finalStory);
  }

  if (!cleanTitle) cleanTitle = `${cleanName}'s Bedtime Story`;

  if (!isStoryOutputSafe(finalStory)) {
    logEvent(`UNSAFE output detected for "${cleanName}" — using safe fallback`);
    finalStory = getSafeFallbackStory(cleanName);
    cleanTitle = `${cleanName}'s Peaceful Night`;
  }

  // Post-processing: deterministic fixes (no LLM) — prose breathing, child clarity,
  // word-cap trim, ending descent. Non-fatal: if it throws we keep the unmodified story.
  try {
    const storyMode = safeRawMode === "family-magic" ? "familyMagic"
                    : safeRawMode === "sleepy"        ? "sleepy"
                    : safeRawMode === "hero"           ? "hero"
                    : "default";
    const { story: postStory, structuralValidation } = await applyPostProcessing({
      story:     finalStory,
      childName: cleanName,
      mode:      storyMode,
    });
    finalStory = postStory;
    const ppPassed = structuralValidation.passed;
    logEvent(`[POST_PROCESS] "${cleanName}" structural=${ppPassed ? "pass" : "fail"} overall=${structuralValidation.overall}`);
  } catch (ppErr) {
    logEvent(`[POST_PROCESS] non-fatal error for "${cleanName}": ${ppErr.message}`);
  }

  // Phase 5: quality scoring + validation (async analytics — never blocks delivery)
  setImmediate(() => {
    try {
      const comfortItems = storyInputs.familyMagic?.comfortItems || [];
      const hasFamilyMagic = Boolean(storyInputs.familyMagic?.enabled);

      // Quality score — logged for monitoring and A/B tuning
      const qualityResult = calculateStoryQuality(finalStory, { comfortItems, familyMagic: hasFamilyMagic });
      logEvent(`[QUALITY] "${cleanName}" overall=${qualityResult.overall} warmth=${qualityResult.scores.emotionalWarmth} softness=${qualityResult.scores.bedtimeSoftness} flow=${qualityResult.scores.cinematicFlow} flags=${qualityResult.flags.join(",") || "none"}`);

      // Section-level validation pipeline — granular quality report
      const familyMagicEnabled = hasFamilyMagic;
      const familyMembers = storyInputs.familyMagic?.familyMembers || [];
      const validationReport = runValidationPipeline(finalStory, {
        childName: cleanName, comfortItems, familyMembers, familyMagicEnabled,
      });
      const failedLog = validationReport.failedSections.length
        ? `failed=[${validationReport.failedSections.join(",")}]`
        : "all-passed";
      logEvent(`[VALIDATION] "${cleanName}" passed=${validationReport.passed} overall=${validationReport.overall.toFixed(1)} ${failedLog}`);

      // Premium quality validator — logs warnings, does not block
      const premiumValidator = new PremiumQualityValidator();
      const premiumResult = premiumValidator.validate(finalStory, { hasFamilyMagic, childName: cleanName });
      if (!premiumResult.passed) {
        logEvent(`[PREMIUM_QUALITY] score=${premiumResult.score} warnings=${premiumResult.warnings.map(w => w.type).join(",")}`);
      }

      // Localization validator — warns on English leak in non-English stories
      const locValidator = new GlobalLocalizationValidator();
      const locResult = locValidator.validate(finalStory, { language: storyInputs.language });
      if (!locResult.passed) {
        logEvent(`[LOCALIZATION] warnings=${locResult.warnings.map(w => w.type).join(",")}`);
      }

      // Retention analytics event
      const usedAnchors = extractUsedComfortAnchors(finalStory, comfortItems);
      const completionEvent = buildStoryCompletionEvent({
        childName:           cleanName,
        mode:                rawMode,
        ageGroup:            parseInt(storyInputs.age, 10) || 5,
        lengthType:          length,
        qualityScores:       qualityResult,
        hasFamilyMagic,
        comfortAnchorsUsed:  usedAnchors,
        bedtimeHour:         storyInputs.bedtimeHour,
        generationMs:        null,
        language:            storyInputs.language,
      });
      logEvent(`[RETENTION] ${JSON.stringify(completionEvent)}`);
    } catch (analyticsErr) {
      // Analytics must never crash story delivery
      logEvent(`[ANALYTICS_ERROR] ${analyticsErr.message}`);
    }
  });

  logEvent(`Pipeline complete for "${cleanName}": "${cleanTitle}"`);
  return { story: finalStory, title: cleanTitle };
}

// =============================================================================
// Job polling endpoint — client calls this after phone wakes to collect result
// =============================================================================

app.options("/api/job/:jobId", corsMiddleware);
app.get("/api/job/:jobId", corsMiddleware, requireAiAuth, async (req, res) => {
  const { jobId } = req.params;
  if (!/^[0-9a-f-]{36}$/.test(jobId)) return res.status(400).json({ status: "invalid" });
  // requestingUid is null in pure-anon dev (REQUIRE_AUTH_FOR_AI_ROUTES=false).
  // loadJob enforces uid match when both are present, so a real user can
  // never read another user's job — they get { status: "forbidden" }.
  const requestingUid = req.authUser?.uid || null;
  const job = await loadJob(jobId, requestingUid);
  if (job.status === "forbidden") return res.status(403).json({ status: "forbidden" });
  res.json(job);
});

// =============================
// SERVER START (PRODUCTION SAFE + AUTO PORT)
// =============================

// Pre-flight: refuse to boot in production without the things that would
// silently break the product — Claude key, Firebase Admin credentials,
// allowed origins, and (if Stripe is wired) the webhook secret. Each of
// these has a "looks fine, fails for users" mode that's worse than crashing.
function preflightCheck() {
  const isProd = process.env.NODE_ENV === "production";
  const fatal = [];
  const warn = [];

  // Claude key — required everywhere; in dev we warn instead of exit so the
  // rest of the app still boots for UI work.
  if (!AI_ENABLED) {
    const reason = !API_KEY
      ? "ANTHROPIC_API_KEY (or CLAUDE_API_KEY) is missing from the environment"
      : "ANTHROPIC_API_KEY does not look like a valid Claude key (expected sk-ant-…)";
    (isProd ? fatal : warn).push(`AI: ${reason}`);
  }

  // Firebase Admin — needed for token verification and credit accounting.
  // Production must have one of: full service-account triple, GOOGLE_APPLICATION_CREDENTIALS,
  // or at minimum FIREBASE_PROJECT_ID. Without any of these, /generate cannot
  // verify tokens and consumeStory cannot read user docs.
  const hasFirebaseAdmin =
    (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) ||
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    !!FIREBASE_PROJECT_ID;
  if (isProd && !hasFirebaseAdmin) {
    fatal.push("Firebase Admin: set FIREBASE_PROJECT_ID (+ FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY) or GOOGLE_APPLICATION_CREDENTIALS");
  }

  // CORS — production must restrict origins. Wide-open CORS lets any site
  // burn your Claude credits using a victim's stored Firebase token.
  if (isProd && ALLOWED_ORIGINS.length === 0) {
    fatal.push("CORS: ALLOWED_ORIGINS is empty — production must list explicit HTTPS origins");
  }

  // Stripe webhook — if Stripe secret is set we MUST also have the webhook
  // signing secret, otherwise anyone can POST a forged checkout.session.completed
  // and grant themselves credits.
  if (process.env.STRIPE_SECRET && !process.env.STRIPE_WEBHOOK_SECRET) {
    (isProd ? fatal : warn).push("Stripe: STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET is set");
  } else if (!process.env.STRIPE_SECRET) {
    warn.push("Stripe: STRIPE_SECRET not set — payments disabled");
  }

  // Auth — production must require authenticated requests on AI routes.
  if (isProd && !REQUIRE_AUTH_FOR_AI_ROUTES) {
    fatal.push("Auth: REQUIRE_AUTH_FOR_AI_ROUTES is false in production — every request would be treated as anonymous dev");
  }

  // App Check — warn if not enabled in production; not fatal since it requires
  // reCAPTCHA Enterprise domain registration before it can be safely enforced.
  if (isProd && !REQUIRE_APP_CHECK) {
    warn.push("AppCheck: REQUIRE_APP_CHECK is not enabled — set to true after registering dreamtalez.onrender.com in reCAPTCHA Enterprise console");
  }

  if (warn.length) {
    for (const w of warn) console.warn(`⚠️  ${w}`);
  }
  if (fatal.length) {
    for (const f of fatal) console.error(`❌ FATAL: ${f}`);
    console.error(`\nRefusing to start. Fix the items above and redeploy.\n`);
    process.exit(1);
  }

  if (AI_ENABLED) {
    console.log(`✅ AI configured (key ends …${API_KEY.slice(-6)}, pipeline=${USE_FULL_AI_PIPELINE ? "full" : "lean"})`);
  }
  console.log(`✅ CORS origins: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(", ") : "(open — dev only)"}`);
}

preflightCheck();

// Refund sweeper: catch jobs whose pipeline never finished (server crash,
// OOM, deploy mid-flight) and return the credit to the user. Runs once on
// boot, then on a 2-minute interval. Multi-instance safe via Firestore tx.
dispatchPendingJobs().catch(e => logEvent(`Initial job dispatch error: ${e.message}`));
setInterval(() => {
  dispatchPendingJobs().catch(e => logEvent(`Job dispatch error: ${e.message}`));
}, JOB_DISPATCH_INTERVAL_MS);

sweepStalePendingJobs().catch(e => logEvent(`Initial sweeper run error: ${e.message}`));
setInterval(() => {
  sweepStalePendingJobs().catch(e => logEvent(`Sweeper run error: ${e.message}`));
}, JOB_SWEEP_INTERVAL_MS);

// Phase 5: preload Opus-authored production frameworks at boot — zero latency at request time
frameworkLoader.preload();
// Resolve locked system prompt once — used by Sonnet at runtime instead of static STORY_SYSTEM_PROMPT
const LOCKED_SYSTEM_PROMPT = getLockedSystemPrompt();
if (LOCKED_SYSTEM_PROMPT) {
  logEvent(`[FRAMEWORK] Locked production framework system active (${LOCKED_SYSTEM_PROMPT.length.toLocaleString()} chars)`);
} else {
  logEvent("[FRAMEWORK] Production frameworks incomplete — using static STORY_SYSTEM_PROMPT fallback");
}

// ============================================
// LOCKED PORT — DreamTalez Production Standard
// Never increments, never falls back.
// ============================================

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`
========================================
DreamTalez Server Running
========================================

PORT: ${PORT}

LOCAL:
http://localhost:${PORT}

========================================
`);

  // Keep-warm ping: hit /health every 14 minutes so Render never spins the
  // server down mid-session. Only runs in production to avoid noise locally.
  if (process.env.NODE_ENV === "production") {
    const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    setInterval(() => {
      fetch(`${SELF_URL}/health`)
        .then(r => { if (!r.ok) logEvent(`[KEEPWARM] /health returned ${r.status}`); })
        .catch(e => logEvent(`[KEEPWARM] ping failed: ${e.message}`));
    }, 14 * 60 * 1000);
    logEvent(`[KEEPWARM] self-ping enabled → ${SELF_URL}/health every 14 min`);
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Kill the other process and retry.`);
  } else if (error.code === "EACCES") {
    console.error(`❌ Port ${PORT} requires elevated privileges.`);
  } else {
    console.error("❌ Server error:", error.message);
  }
  process.exit(1);
});
