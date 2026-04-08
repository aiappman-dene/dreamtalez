import assert from "node:assert/strict";
import fs from "fs";
import vm from "vm";

const appJsPath = new URL("../public/app.js", import.meta.url);
const source = fs.readFileSync(appJsPath, "utf8");

function between(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Could not extract segment between ${startMarker} and ${endMarker}`);
  }
  return source.slice(start, end);
}

function createSeededRandom(seed) {
  let state = (Number(seed) || 1) >>> 0;
  return function seededRandom() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createSeededMath(seed) {
  const math = Object.create(Math);
  math.random = createSeededRandom(seed);
  return math;
}

function createQaContext(seed, dialect = "en-GB") {
  const script = [
    between("const DIALECT_BRITISH = \"en-GB\";", "// =============================================================================\n// Reading Mode"),
    `
globalThis.__qa = {
  themeWorlds,
  generateQuickStory,
  formatStory,
  applyDialectToText,
  findQuickWishMatchedWorld,
  normalizeDiscoveryEntry,
};
`,
  ].join("\n\n");

  const context = {
    console,
    Math: createSeededMath(seed),
    Date,
    String,
    Number,
    Array,
    Object,
    RegExp,
    JSON,
    cachedChildren: [],
    selectedChildIndex: 0,
    cachedSeries: {},
    cachedDialect: dialect,
    currentUser: null,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
  };

  vm.createContext(context);
  vm.runInContext(script, context, { filename: "app.js" });
  return context;
}

function buildChild(theme, audience) {
  return {
    name: audience === "girl" ? "Sophia" : audience === "boy" ? "Theo" : "Sage",
    age: audience === "girl" ? 7 : audience === "boy" ? 8 : 6,
    gender: audience === "girl" || audience === "boy" ? audience : "neutral",
    interests: [theme],
  };
}

function collectParagraphs(story) {
  return String(story || "").split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
}

function includesIgnoreCase(haystack, needle) {
  return String(haystack || "").toLowerCase().includes(String(needle || "").toLowerCase());
}

function goalNeedsExplicitMechanism(goal) {
  const goalText = String(goal || "").trim().toLowerCase();
  return /(?:home|burrow|den|reef|nest|station)\b/.test(goalText) || /\bback to\b/.test(goalText);
}

function paragraphShowsGoalMechanism(paragraph, goal, discovery) {
  const text = String(paragraph || "");
  if (!text) return false;

  const mentionsGoal = includesIgnoreCase(text, goal);
  const mentionsDiscovery = includesIgnoreCase(text, discovery.text) || includesIgnoreCase(text, discovery.discoveryEffect);
  const hasMechanismVerb = /\b(light|lights|lighting|lit|glow|glowing|guid(?:e|ed|es|ing)|show(?:ed|ing|s)?|lead(?:ed|ing|s)?|led|point(?:ed|ing|s)?|follow(?:ed|ing|s)?|mark(?:ed|ing|s)?|call(?:ed|ing|s)?|echo(?:ed|ing|es)?|route|path|way|track|trail|toward|towards)\b/i.test(text);

  return mentionsGoal && mentionsDiscovery && hasMechanismVerb;
}

function assertProceduralWorldStory({ context, theme, dialect, world, story, seed }) {
  const paragraphs = collectParagraphs(story);
  const goalOptions = Array.isArray(world.goal) ? world.goal : [world.goal];
  const matchingGoal = goalOptions
    .map((goal) => context.__qa.applyDialectToText(goal, dialect))
    .find((goal) => includesIgnoreCase(story, goal));
  const discoveryGoal = matchingGoal || goalOptions[0] || "";
  const discoveries = world.discoveries
    .map((entry) => context.__qa.normalizeDiscoveryEntry(entry, { goal: discoveryGoal }))
    .filter((item) => item.text);

  assert(paragraphs.length >= 8, `${theme} (${dialect}) seed ${seed} collapsed into too few paragraphs.`);

  const matchingDiscovery = discoveries.find((item) => {
    const dialectText = context.__qa.applyDialectToText(item.text, dialect);
    return includesIgnoreCase(story, item.text) || includesIgnoreCase(story, dialectText);
  });

  assert(matchingDiscovery, `${theme} (${dialect}) seed ${seed} never named a concrete discovery.`);

  if (matchingGoal && goalNeedsExplicitMechanism(matchingGoal)) {
    const dialectDiscovery = {
      text: context.__qa.applyDialectToText(matchingDiscovery.text, dialect),
      discoveryEffect: context.__qa.applyDialectToText(matchingDiscovery.discoveryEffect, dialect),
    };
    const hasMechanisedPayoff = paragraphs.some((paragraph) => paragraphShowsGoalMechanism(paragraph, matchingGoal, dialectDiscovery));
    assert(hasMechanisedPayoff, `${theme} (${dialect}) seed ${seed} paid off a return-home goal without a clear mechanism.`);
  }
}

const dialects = ["en-GB", "en-US"];
const seeds = [1, 2, 3, 4, 5, 11, 17, 23];
const baseContext = createQaContext(1, "en-GB");
const allThemes = Object.entries(baseContext.__qa.themeWorlds);

for (const [theme] of allThemes) {
  for (const dialect of dialects) {
    for (const seed of seeds) {
      const context = createQaContext(seed, dialect);
      const worldFromContext = context.__qa.themeWorlds[theme];
      const audience = ["girl", "boy"].includes(context.worldSuitability?.[theme]?.audience)
        ? context.worldSuitability[theme].audience
        : "any";
      const child = buildChild(theme, audience);
      const rawStory = context.__qa.generateQuickStory(child, worldFromContext, []);
      const story = context.__qa.formatStory(context.__qa.applyDialectToText(rawStory, dialect));
      assertProceduralWorldStory({ context, theme, dialect, world: worldFromContext, story, seed });
    }
  }
}

const quickWishCases = [
  { wish: "flying", expectedTheme: "space" },
  { wish: "swimming", expectedTheme: "ocean" },
  { wish: "flying over dolphins", expectedTheme: "ocean" },
  { wish: "through egypt", expectedTheme: "places" },
  { wish: "flying through egypt", expectedTheme: "places" },
];

for (const { wish, expectedTheme } of quickWishCases) {
  const context = createQaContext(7, "en-GB");
  const matchedWorld = context.__qa.findQuickWishMatchedWorld(wish, { interests: [expectedTheme], age: 7, gender: "neutral" });
  const matchedTheme = Object.entries(context.__qa.themeWorlds).find(([, world]) => world === matchedWorld)?.[0] || null;
  assert.equal(matchedTheme, expectedTheme, `Quick wish "${wish}" should resolve to ${expectedTheme}, got ${matchedTheme || "nothing"}.`);
}

console.log(`Procedural regression QA passed for ${allThemes.length} themes across ${dialects.length} dialects and ${seeds.length} fixed seeds.`);