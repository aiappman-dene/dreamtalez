/**
 * Framework Loader
 *
 * Preloads all Opus-authored production framework documents and locked-config
 * JSON files at server startup. Zero disk I/O at request time.
 *
 * Frameworks are the locked storytelling constitution — authored by Opus once,
 * used by Sonnet forever. Editing a framework file and restarting the server
 * is the only correct way to upgrade storytelling quality.
 *
 * Usage:
 *   import { frameworkLoader } from "./story-engine/runtime/framework-loader.js";
 *   frameworkLoader.preload();              // call once at server boot
 *   frameworkLoader.get("masterConstitution")  // O(1) at request time
 *   frameworkLoader.buildSonnetSystemPrompt()  // assembles full system prompt
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMEWORKS_DIR   = path.join(__dirname, "..", "production-frameworks");
const LOCKED_CONFIG_DIR = path.join(__dirname, "..", "locked-config");
const LEGACY_DIR       = path.join(__dirname, "..", "frameworks");

// Production framework files — authored by Opus, loaded in display order
const FRAMEWORK_FILES = {
  masterConstitution:      "MASTER_STORY_CONSTITUTION.md",
  disneyQuality:           "DISNEY_QUALITY_STANDARD.md",
  familyMagicConstitution: "FAMILY_MAGIC_CONSTITUTION.md",
  bedtimePsychology:       "BEDTIME_PSYCHOLOGY_SYSTEM.md",
  emotionalRhythm:         "EMOTIONAL_RHYTHM_STANDARD.md",
  cinematicProse:          "CINEMATIC_PROSE_STANDARD.md",
  sensoryOrchestration:    "SENSORY_ORCHESTRATION_STANDARD.md",
  continuityMemory:        "CONTINUITY_MEMORY_STANDARD.md",
  storyflowPacing:         "STORYFLOW_PACING_STANDARD.md",
  validationConstitution:  "VALIDATION_CONSTITUTION.md",
  refinementConstitution:  "REFINEMENT_CONSTITUTION.md",
  sonnetDirective:         "SONNET_RUNTIME_DIRECTIVE.md",
};

// Legacy framework files (Phase 3–4)
const LEGACY_FILES = {
  familyMagicRuntime: "family-magic-runtime.md",
  familyMagicRules:   "family-magic-rules.md",
  cinematicRules:     "cinematic-bedtime-rules.md",
  adaptiveRules:      "adaptive-bedtime-rules.md",
};

// Locked config JSON files
const CONFIG_FILES = {
  bedtimeRules:    "bedtime-rules.json",
  emotionalRules:  "emotional-rules.json",
  senoryRules:     "sensory-rules.json",
  proseRules:      "prose-rules.json",
  pacingRules:     "pacing-rules.json",
  continuityRules: "continuity-rules.json",
  validatorRules:  "validator-rules.json",
};

// Ordered list of frameworks to include in Sonnet system prompt
const SYSTEM_PROMPT_ORDER = [
  "masterConstitution",
  "disneyQuality",
  "emotionalRhythm",
  "bedtimePsychology",
  "cinematicProse",
  "sensoryOrchestration",
  "storyflowPacing",
  "continuityMemory",
  "familyMagicConstitution",
  "refinementConstitution",
  "sonnetDirective",
];

export class FrameworkLoader {
  constructor() {
    this.frameworks = {};
    this.config     = {};
    this._loaded    = false;
  }

  _readFile(dir, filename) {
    try {
      return fs.readFileSync(path.join(dir, filename), "utf8");
    } catch {
      return null;
    }
  }

  _readJson(dir, filename) {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, filename), "utf8"));
    } catch {
      return null;
    }
  }

  preload() {
    let loaded = 0;
    let missing = 0;

    // Load production frameworks
    for (const [key, filename] of Object.entries(FRAMEWORK_FILES)) {
      const content = this._readFile(FRAMEWORKS_DIR, filename);
      if (content) {
        this.frameworks[key] = content;
        loaded++;
      } else {
        this.frameworks[key] = "";
        missing++;
        console.warn(`[FrameworkLoader] Missing production framework: ${filename}`);
      }
    }

    // Load legacy frameworks
    for (const [key, filename] of Object.entries(LEGACY_FILES)) {
      const content = this._readFile(LEGACY_DIR, filename);
      if (content) this.frameworks[key] = content;
    }

    // Load locked config
    for (const [key, filename] of Object.entries(CONFIG_FILES)) {
      const data = this._readJson(LOCKED_CONFIG_DIR, filename);
      if (data) this.config[key] = data;
    }

    this._loaded = true;

    const configCount = Object.keys(this.config).length;
    console.log(`[FrameworkLoader] Loaded ${loaded} frameworks, ${configCount} config files${missing > 0 ? ` (${missing} missing)` : ""}`);
    return this;
  }

  /**
   * Get a single framework by key.
   */
  get(key) {
    if (!this._loaded) this.preload();
    return this.frameworks[key] || "";
  }

  /**
   * Get a locked config object by key.
   */
  getConfig(key) {
    if (!this._loaded) this.preload();
    return this.config[key] || null;
  }

  getAll() {
    if (!this._loaded) this.preload();
    return { ...this.frameworks };
  }

  getAllConfig() {
    if (!this._loaded) this.preload();
    return { ...this.config };
  }

  /**
   * Assembles the full Sonnet system prompt from loaded production frameworks.
   * Falls back gracefully if frameworks are incomplete.
   *
   * @returns {string|null} Assembled system prompt, or null if < 4 frameworks loaded
   */
  buildSonnetSystemPrompt() {
    if (!this._loaded) this.preload();

    const parts = SYSTEM_PROMPT_ORDER
      .map((key) => this.frameworks[key])
      .filter((content) => content && content.trim().length > 100);

    if (parts.length < 4) {
      // Not enough frameworks — caller should fall back to static STORY_SYSTEM_PROMPT
      return null;
    }

    return `DREAMTALEZ LOCKED PRODUCTION FRAMEWORK\nVersion: 1.0.0 | Authored by Claude Opus | Runtime: Claude Sonnet\n\n${"=".repeat(60)}\n\n${parts.join(`\n\n${"=".repeat(60)}\n\n`)}`;
  }

  isLoaded() {
    return this._loaded;
  }

  hasProductionFrameworks() {
    if (!this._loaded) return false;
    return SYSTEM_PROMPT_ORDER.filter((k) => this.frameworks[k]?.length > 100).length >= 6;
  }
}

// Singleton — imported once, shared across all requests
export const frameworkLoader = new FrameworkLoader();
export default frameworkLoader;
