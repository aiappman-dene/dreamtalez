// =============================================================================
// DreamTalez — Server
// AI-powered bedtime story generator for children aged 2–12
// =============================================================================

import express from "express";
import cors from "cors";
import "dotenv/config";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import fs from "fs";
import https from "https";
import path from "path";
import {
  STORY_SYSTEM_PROMPT,
  EDITOR_SYSTEM_PROMPT,
  VALIDATOR_SYSTEM_PROMPT,
  DELIVERY_QA_SYSTEM_PROMPT,
  buildStoryPrompt,
  buildGrammarPrompt,
  buildValidationPrompt,
  buildDeliveryQaPrompt,
  buildTitlePrompt,
} from "./prompts.js";
import {
  normalizeStoryLocale,
  isSupportedStoryLocale,
  normalizeStoryOutput,
  detectStoryQualityIssues,
  assertStoryQuality,
} from "./story-quality.js";

// =============================================================================
// Config
// =============================================================================

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const NODE_ENV = process.env.NODE_ENV || "development";
const AI_PIPELINE_PROFILE = process.env.AI_PIPELINE_PROFILE === "full" ? "full" : "lean";
const USE_FULL_AI_PIPELINE = AI_PIPELINE_PROFILE === "full";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

if (!API_KEY) {
  console.error("FATAL: ANTHROPIC_API_KEY is not set in .env — server cannot start.");
  process.exit(1);
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

function getStoryTokenBudget(length, stage = "story") {
  const normalizedLength = String(length || "medium").toLowerCase();

  if (normalizedLength === "short") {
    if (stage === "title") return 50;
    if (stage === "delivery") return 800;
    return 800;
  }

  if (normalizedLength === "long") {
    if (stage === "title") return 60;
    if (stage === "delivery") return 2500;
    return 2600;
  }

  if (stage === "title") return 50;
  if (stage === "delivery") return 1500;
  return 1500;
}

// =============================================================================
// Logging
// =============================================================================

function logEvent(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFile("server.log", entry, () => {});
  if (NODE_ENV === "development") console.log(entry.trim());
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
  const deliveryBudget = getStoryTokenBudget(currentStory.split(/\s+/).length >= 950 ? "long" : "medium", "delivery");

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
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const API_VERSION = "2023-06-01";

async function callClaude({ system, prompt, maxTokens = 1200, temperature = 0.5 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    // Build request body — system prompt is separate from messages
    const requestBody = {
      model: CLAUDE_MODEL,
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
          "https://identitytoolkit.googleapis.com",
          "https://firestore.googleapis.com",
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

// CORS
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: { error: "Too many requests. Please try again in a few minutes." },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Request logging
app.use((req, res, next) => {
  logEvent(`${req.method} ${req.url} from ${req.ip}`);
  next();
});

// Static files — after security middleware
app.use(express.static("public", {
  etag: false,
  setHeaders(res, filePath) {
    if (/\.(html|js|css)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
    }
  },
}));

app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.sendFile(path.resolve("public/index.html"));
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// =============================================================================
// Polish endpoint — runs a pre-generated story through the editor pass only
// Used as fallback when procedural stories need AI polish
// =============================================================================

app.post(
  "/polish",
  [
    body("story").isString().isLength({ min: 10, max: 5000 }).trim(),
    body("dialect").optional().custom(isSupportedStoryLocale),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Invalid story text." });
      }

      const { story, dialect } = req.body;
      const cleanDialect = normalizeStoryLocale(dialect);

      logEvent("Polish endpoint: running editor pass on procedural story");

      const grammarPrompt = buildGrammarPrompt(story, cleanDialect);
      const polished = await callClaudeWithRetry({
        system: EDITOR_SYSTEM_PROMPT,
        prompt: grammarPrompt,
        maxTokens: 1200,
        temperature: 0.2,
      });

      const finalStory = USE_FULL_AI_PIPELINE
        ? await runDeliveryQaPass(polished, cleanDialect)
        : finalizeStoryLocally(polished, cleanDialect, "Polish endpoint output");

      logEvent("Polish endpoint: complete");
      res.json({ story: finalStory });
    } catch (error) {
      logEvent(`Polish endpoint error: ${error.message}`);
      return res.status(422).json({ error: "Story could not be polished to quality standard." });
    }
  }
);

// =============================================================================
// Story generation endpoint
// =============================================================================

app.post(
  "/generate",
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
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logEvent("Validation error: " + JSON.stringify(errors.array()));
        return res.status(400).json({ error: "Please check your input and try again." });
      }

      const { name, age, interests, length, mode, dialect, customIdea, seriesContext, childWish, appearance, dayBeats, dayMood } = req.body;
      const cleanName = sanitizeInput(name);
      const cleanAge = sanitizeInput(age);
      const cleanInterests = sanitizeInput(interests);
      const cleanDialect = normalizeStoryLocale(dialect);
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

      if (containsSuspiciousContent(cleanName) || containsSuspiciousContent(cleanInterests)) {
        logEvent(`Blocked suspicious input from ${req.ip}: ${cleanName}`);
        return res.status(400).json({ error: "Invalid input detected." });
      }

      if (cleanIdea && containsSuspiciousContent(cleanIdea)) {
        logEvent(`Blocked suspicious idea from ${req.ip}: ${cleanIdea}`);
        return res.status(400).json({ error: "Invalid input detected." });
      }

      if (cleanSeriesContext && containsSuspiciousContent(cleanSeriesContext)) {
        logEvent(`Blocked suspicious series context from ${req.ip}`);
        return res.status(400).json({ error: "Invalid input detected." });
      }

      if (cleanWish && containsSuspiciousContent(cleanWish)) {
        logEvent(`Blocked suspicious wish from ${req.ip}: ${cleanWish}`);
        return res.status(400).json({ error: "Invalid input detected." });
      }

      if (cleanAppearance && containsSuspiciousContent(cleanAppearance)) {
        logEvent(`Blocked suspicious appearance from ${req.ip}: ${cleanAppearance}`);
        return res.status(400).json({ error: "Invalid input detected." });
      }

      if (cleanBeats && containsSuspiciousContent(cleanBeats)) {
        logEvent(`Blocked suspicious day-beats from ${req.ip}`);
        return res.status(400).json({ error: "Invalid input detected." });
      }

      logEvent(`Generating ${mode} story for "${cleanName}" (age ${cleanAge}), interests: "${cleanInterests}"${cleanIdea ? `, idea: "${cleanIdea}"` : ""}${cleanWish ? `, wish: "${cleanWish}"` : ""}, length: ${length}, dialect: ${cleanDialect}`);

      // ================================================================
      // 4-STAGE PIPELINE: Generate → Edit → Validate → Output
      // With regeneration trigger if validator detects unfixable issues.
      // Max 1 regeneration to prevent infinite loops.
      // ================================================================

      const storyInputs = {
        name: cleanName,
        age: cleanAge,
        interests: cleanInterests,
        length,
        dialect: cleanDialect,
        customIdea: cleanIdea,
        seriesContext: cleanSeriesContext,
        childWish: cleanWish,
        appearance: cleanAppearance,
        dayBeats: cleanBeats,
        dayMood: cleanMood,
      };
      const storyMaxTokens = getStoryTokenBudget(length, "story");
      const editorMaxTokens = getStoryTokenBudget(length, "editor");
      const validatorMaxTokens = getStoryTokenBudget(length, "validator");
      const titleMaxTokens = getStoryTokenBudget(length, "title");

      const MAX_ATTEMPTS = USE_FULL_AI_PIPELINE ? 2 : 1;
      let finalStory = null;
      let cleanTitle = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (attempt > 1) {
          logEvent(`Regeneration triggered for "${cleanName}" (attempt ${attempt})`);
        }

        // STAGE 1: Generate story
        // STORY_SYSTEM_PROMPT enforces internal 5-stage validation with
        // hidden PASS/FAIL gates. CONTEXT_LOCK in user prompt reinforces
        // consistency rules from a second angle to prevent silent drift.
        const storyPrompt = buildStoryPrompt(storyInputs);

        const rawStory = await callClaudeWithRetry({
          system: STORY_SYSTEM_PROMPT,
          prompt: storyPrompt,
          maxTokens: storyMaxTokens,
          temperature: 0.55,
        });

        logEvent(`Stage 1 complete (generate) for "${cleanName}" [attempt ${attempt}]`);

        // STAGE 2: Senior editor pass — enforces quality AND consistency.
        // In lean mode we stop here to keep Anthropic usage to two calls max.
        const grammarPrompt = buildGrammarPrompt(rawStory, cleanDialect);
        const editedStory = await callClaudeWithRetry({
          system: EDITOR_SYSTEM_PROMPT,
          prompt: grammarPrompt,
          maxTokens: editorMaxTokens,
          temperature: 0.2,
        });

        if (!USE_FULL_AI_PIPELINE) {
          logEvent(`Stage 2 complete (edit) for "${cleanName}" [attempt ${attempt}] [lean pipeline]`);
          finalStory = finalizeStoryLocally(editedStory, cleanDialect, `Final story for ${cleanName}`);
          cleanTitle = `${cleanName}'s Bedtime Story`;
          break;
        }

        const titlePrompt = buildTitlePrompt(rawStory, cleanName, cleanDialect);
        const title = await callClaudeWithRetry({
          prompt: titlePrompt,
          maxTokens: titleMaxTokens,
          temperature: 0.4,
        });

        logEvent(`Stage 2 complete (edit + title) for "${cleanName}" [attempt ${attempt}]`);

        // STAGE 3: Final validation gate with hidden 0–10 scoring
        // Returns story as-is if all scores >= 9
        // Applies surgical fixes if scores < 9
        // Returns "REGENERATE" if fundamentally broken
        // Mode context enables idea integrity (hero) / interest utilisation (random) checks
        const validationPrompt = buildValidationPrompt(editedStory, {
          mode,
          dialect: cleanDialect,
          interests: cleanInterests,
          customIdea: cleanIdea,
          childWish: cleanWish,
          seriesContext: cleanSeriesContext,
          dayBeats: cleanBeats,
        });

        const validatorOutput = await callClaudeWithRetry({
          system: VALIDATOR_SYSTEM_PROMPT,
          prompt: validationPrompt,
          maxTokens: validatorMaxTokens,
          temperature: 0.1,
        });

        logEvent(`Stage 3 complete (validate) for "${cleanName}" [attempt ${attempt}]`);

        // Check for regeneration trigger
        if (validatorOutput.trim() === "REGENERATE") {
          logEvent(`Validator triggered REGENERATE for "${cleanName}" [attempt ${attempt}]`);
          continue;
        }

        const validatorIssues = detectStoryQualityIssues(validatorOutput, { dialect: cleanDialect });
        if (validatorIssues.length) {
          logEvent(`Validator output still had issues for "${cleanName}" [attempt ${attempt}]: ${validatorIssues.join(" | ")}`);
          continue;
        }

        // Story passed validation
        finalStory = validatorOutput;
        cleanTitle = title.replace(/["']/g, "").trim();
        break;
      }

      if (!finalStory) {
        throw new Error(`AI story pipeline could not produce a fully validated story for "${cleanName}".`);
      }

      finalStory = USE_FULL_AI_PIPELINE
        ? await runDeliveryQaPass(finalStory, cleanDialect)
        : finalizeStoryLocally(finalStory, cleanDialect, `Final story for ${cleanName}`);

      if (USE_FULL_AI_PIPELINE) {
        finalStory = assertStoryQuality(finalStory, {
          dialect: cleanDialect,
          label: `Final story for ${cleanName}`,
        });
      }

      if (!cleanTitle) {
        cleanTitle = `${cleanName}'s Bedtime Story`;
      }

      logEvent(`Pipeline complete for "${cleanName}": "${cleanTitle}"`);
      res.json({ story: finalStory, title: cleanTitle });
    } catch (error) {
      logEvent(`SERVER ERROR: ${error.message}\n${error.stack}`);

      if (error.name === "AbortError") {
        return res.status(504).json({ error: "Story generation timed out. Please try again." });
      }

      res.status(500).json({ error: "Something went wrong creating your story. Please try again." });
    }
  }
);

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
    console.log(`DreamTalez server running at http://localhost:${PORT}`);
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
