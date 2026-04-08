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

const script = [
  between("const DIALECT_BRITISH = \"en-GB\";", "// =============================================================================\n// Reading Mode"),
  `
globalThis.__qa = {
  themeWorlds,
  generateQuickStory,
  formatStory,
  applyDialectToText,
};
`,
].join("\n\n");

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

function fail(message) {
  throw new Error(message);
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return String(haystack || "").split(String(needle)).length - 1;
}

function includesIgnoreCase(haystack, needle) {
  return String(haystack || "").toLowerCase().includes(String(needle || "").toLowerCase());
}

function normalizeDiscoveryItem(entry) {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    return {
      text: String(entry.text || "").trim(),
      discoveryEffect: String(entry.discoveryEffect || "").trim(),
      payoffTemplates: Array.isArray(entry.payoffTemplates) ? entry.payoffTemplates.map((item) => String(item || "").trim()).filter(Boolean) : [],
    };
  }

  return {
    text: String(entry || "").trim(),
    discoveryEffect: "",
    payoffTemplates: [],
  };
}

function discoveryMentionAdvancesStory(paragraph, discovery) {
  const text = String(paragraph || "");
  if (!includesIgnoreCase(text, discovery)) return false;

  return /\b(help(?:ed|ing)?|show(?:ed|ing)?|guide(?:d|ing)?|lead(?:s|ing)?|point(?:ed|ing)?|use(?:d|ing)?|underst(?:and|ands|ood|anding)|know|knew|deliver(?:ed|ing)?|return(?:ed|ing)?|restore(?:d|ing)?|open(?:ed|ing)?|bring(?:ing|brought)?|carry(?:ing|carried)?|share(?:d|ing)?|complete(?:d|ing)?|solve(?:d|ing)?|begin|began)\b/i.test(text);
}

function countBedtimeClosures(story) {
  const matches = String(story || "").match(/\b(climbed into bed|curled up comfortably|settled beneath the blankets|snuggled in|closed (?:his|her|their) eyes|drifted into (?:a )?(?:deep, )?gentle sleep|settled into sleep|slipped into a calm, happy sleep)\b/gi);
  return matches ? matches.length : 0;
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
  const hasMechanismVerb = /\b(show(?:ed|ing|s)?|guid(?:e|ed|es|ing)|lead(?:ed|ing|s)?|led|lit|light(?:ed|ing|s)?|point(?:ed|ing|s)?|follow(?:ed|ing|s)?|mark(?:ed|ing|s)?|call(?:ed|ing|s)?|echo(?:ed|ing|es)?|route|path|way|track|trail|toward|towards)\b/i.test(text);

  return mentionsGoal && mentionsDiscovery && hasMechanismVerb;
}

function assertStoryQuality({ context, theme, dialect, story, world }) {
  const paragraphs = collectParagraphs(story);
  const discoveries = world.discoveries.map(normalizeDiscoveryItem).filter((item) => item.text);

  if (!story) fail(`${theme} (${dialect}) produced an empty story.`);
  if (/\{[A-Za-z][A-Za-z0-9_]*\}/.test(story)) fail(`${theme} (${dialect}) still contains placeholders.`);
  if (paragraphs.length < 8) fail(`${theme} (${dialect}) is too short or collapsed.`);
  if (/and the [^.\n]+(?:climbed into bed|curled up comfortably|settled beneath the blankets|snuggled in|closed their eyes)/i.test(story)) {
    fail(`${theme} (${dialect}) still puts the companion into bed.`);
  }
  if (/The discovery felt small and magical at once, like an answer wrapped in light\./i.test(story)) {
    fail(`${theme} (${dialect}) used the vague discovery line without the actual discovery.`);
  }
  if (/named [A-Z][a-z]+ who [^.!?\n]+, and [^.!?\n]+ was in /i.test(story)) {
    fail(`${theme} (${dialect}) still contains an awkward opener clause join.`);
  }
  if (countBedtimeClosures(story) > 1) {
    fail(`${theme} (${dialect}) still contains more than one bedtime closure.`);
  }
  const goalOptions = Array.isArray(world.goal) ? world.goal : [world.goal];
  const matchingGoal = goalOptions
    .map((goal) => context.__qa.applyDialectToText(goal, dialect))
    .find((goal) => countOccurrences(story, goal) > 0);
  if (matchingGoal && /(had one gentle goal tonight|hoped to|set out with one calm hope in mind)/.test(story) && countOccurrences(story, matchingGoal) < 2) {
    fail(`${theme} (${dialect}) introduces a concrete goal but never clearly pays it off.`);
  }
  const namedDiscovery = discoveries.find((item) => {
    const dialectText = context.__qa.applyDialectToText(item.text, dialect);
    return includesIgnoreCase(story, item.text) || includesIgnoreCase(story, dialectText);
  });
  if (!namedDiscovery) {
    fail(`${theme} (${dialect}) never names a concrete discovery.`);
  }
  const repeatedDiscovery = discoveries.some((item) => {
    const dialectItem = context.__qa.applyDialectToText(item.text, dialect);
    return paragraphs.some((paragraph, index) => {
      if (index === 0) return false;
      const prev = paragraphs[index - 1];
      const mentionsHere = includesIgnoreCase(paragraph, item.text) || includesIgnoreCase(paragraph, dialectItem);
      const mentionedPreviously = includesIgnoreCase(prev, item.text) || includesIgnoreCase(prev, dialectItem);
      return mentionsHere && mentionedPreviously && !discoveryMentionAdvancesStory(paragraph, item.text) && !discoveryMentionAdvancesStory(paragraph, dialectItem);
    });
  });
  if (repeatedDiscovery) {
    fail(`${theme} (${dialect}) repeats the same discovery in back-to-back paragraphs.`);
  }
  if (matchingGoal && goalNeedsExplicitMechanism(matchingGoal)) {
    const matchingDiscovery = discoveries.find((item) => {
      const dialectText = context.__qa.applyDialectToText(item.text, dialect);
      return includesIgnoreCase(story, item.text) || includesIgnoreCase(story, dialectText);
    });

    if (matchingDiscovery) {
      const dialectDiscovery = {
        ...matchingDiscovery,
        text: context.__qa.applyDialectToText(matchingDiscovery.text, dialect),
        discoveryEffect: context.__qa.applyDialectToText(matchingDiscovery.discoveryEffect, dialect),
      };
      const hasMechanisedPayoff = paragraphs.some((paragraph) => paragraphShowsGoalMechanism(paragraph, matchingGoal, dialectDiscovery));

      if (!hasMechanisedPayoff) {
        fail(`${theme} (${dialect}) pays off a rescue/home goal without explaining how the discovery helped.`);
      }
    }
  }
  if (!world.companions.some((item) => includesIgnoreCase(story, item) || includesIgnoreCase(story, context.__qa.applyDialectToText(item, dialect)))) {
    fail(`${theme} (${dialect}) never names a concrete companion introduction.`);
  }
  if (dialect === "en-US" && /\b(prioritise|favourite|colour|mum|cosy|travelling)\b/i.test(story)) {
    fail(`${theme} (${dialect}) still contains British spellings.`);
  }
  if (dialect === "en-GB" && /\b(prioritize|favorite|color|mom|cozy|traveling)\b/i.test(story)) {
    fail(`${theme} (${dialect}) still contains American spellings.`);
  }
}

const dialects = ["en-GB", "en-US"];
const seeds = [1, 2, 3, 5];
const baseContext = createQaContext(1, "en-GB");
const worlds = Object.entries(baseContext.__qa.themeWorlds);

for (const [theme, world] of worlds) {
  const suitability = baseContext.worldSuitability?.[theme] || { audience: "any" };
  const child = buildChild(theme, suitability.audience);

  for (const dialect of dialects) {
    for (const seed of seeds) {
      const context = createQaContext(seed, dialect);
      const worldForRun = context.__qa.themeWorlds[theme];
      const rawStory = context.__qa.generateQuickStory(child, worldForRun, []);
      const story = context.__qa.formatStory(context.__qa.applyDialectToText(rawStory, dialect));
      assertStoryQuality({ context, theme, dialect, story, world: worldForRun });
    }
  }
}

for (const dialect of dialects) {
  const neutralNamedChild = {
    name: "Sophia",
    age: 7,
    gender: "neutral",
    interests: ["creativity"],
  };
  for (const seed of seeds) {
    const context = createQaContext(seed, dialect);
    const creativityWorld = context.__qa.themeWorlds.creativity;
    const rawStory = context.__qa.generateQuickStory(neutralNamedChild, creativityWorld, []);
    const story = context.__qa.formatStory(context.__qa.applyDialectToText(rawStory, dialect));

    if (/\bSophia\b[^.\n]{0,120}\btheir\b/i.test(story)) {
      fail(`creativity (${dialect}) seed ${seed} still uses awkward singular neutral pronoun phrasing for a named child.`);
    }
  }
}

console.log(`QA passed for ${worlds.length} themes across ${dialects.length} dialects and ${seeds.length} fixed seeds.`);