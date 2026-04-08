export const STORY_LOCALE_EN_GB = "en-GB";
export const STORY_LOCALE_EN_US = "en-US";

const DIALECT_PAIRS = [
  ["favourite", "favorite"],
  ["favourited", "favorited"],
  ["favour", "favor"],
  ["favouring", "favoring"],
  ["colour", "color"],
  ["colours", "colors"],
  ["honour", "honor"],
  ["honours", "honors"],
  ["neighbour", "neighbor"],
  ["neighbours", "neighbors"],
  ["centre", "center"],
  ["centres", "centers"],
  ["theatre", "theater"],
  ["theatres", "theaters"],
  ["travelling", "traveling"],
  ["travelled", "traveled"],
  ["traveller", "traveler"],
  ["travellers", "travelers"],
  ["realise", "realize"],
  ["realised", "realized"],
  ["realising", "realizing"],
  ["realises", "realizes"],
  ["recognise", "recognize"],
  ["recognised", "recognized"],
  ["recognising", "recognizing"],
  ["recognises", "recognizes"],
  ["organise", "organize"],
  ["organised", "organized"],
  ["organising", "organizing"],
  ["organises", "organizes"],
  ["apologise", "apologize"],
  ["apologised", "apologized"],
  ["apologising", "apologizing"],
  ["apologises", "apologizes"],
  ["prioritise", "prioritize"],
  ["prioritised", "prioritized"],
  ["prioritising", "prioritizing"],
  ["prioritises", "prioritizes"],
  ["cosy", "cozy"],
  ["cosier", "cozier"],
  ["cosiest", "coziest"],
  ["grey", "gray"],
  ["mum", "mom"],
  ["pyjama", "pajama"],
  ["pyjamas", "pajamas"],
];

const CLIFFHANGER_PATTERNS = [
  /\bjust the beginning\b/i,
  /\bnext time\b/i,
  /\bstay tuned\b/i,
  /\bwhat happens next\b/i,
  /\bto be continued\b/i,
  /\banother adventure (?:awaited|was waiting)\b/i,
  /\bmore adventures? (?:awaited|waited|were waiting)\b/i,
  /\bthe adventure was only beginning\b/i,
];

export function normalizeStoryLocale(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "american" || key === "en-us") return STORY_LOCALE_EN_US;
  return STORY_LOCALE_EN_GB;
}

export function isSupportedStoryLocale(value) {
  const key = String(value || "").trim().toLowerCase();
  return key === "british" || key === "american" || key === "en-gb" || key === "en-us";
}

export function normalizeStoryOutput(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitStorySentences(text) {
  const matches = String(text || "").match(/[^.!?\n]+[.!?]+(?:["')\]]+)?/g);
  return matches ? matches.map((part) => part.trim()).filter(Boolean) : [];
}

export function normalizeSentenceForComparison(sentence) {
  return String(sentence || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectMixedDialectIssue(story, dialect) {
  if (!dialect) return null;

  const forbiddenWords = DIALECT_PAIRS.map(([british, american]) =>
    dialect === STORY_LOCALE_EN_US ? british : american
  );

  const found = forbiddenWords.find((word) => new RegExp(`\\b${word}\\b`, "i").test(story));
  if (!found) return null;

  return `The story mixes dialects and still contains ${found}.`;
}

function hasCliffhangerEnding(text) {
  if (!text) return false;
  return CLIFFHANGER_PATTERNS.some((pattern) => pattern.test(text));
}

export function detectStoryQualityIssues(text, { dialect } = {}) {
  const story = normalizeStoryOutput(text);
  const issues = [];

  if (!story) {
    return ["Story is empty."];
  }

  if (/\{[a-z][a-z0-9_]*\}/i.test(story)) {
    issues.push("Unresolved placeholder token remains in the story.");
  }

  if (/\s+[,.!?;:]/.test(story)) {
    issues.push("There is stray spacing before punctuation.");
  }

  if (/(?:\?\?|!!|,,|;;|::|\.\.\.\.+)/.test(story)) {
    issues.push("There is malformed repeated punctuation.");
  }

  if (/\b(\w+)(?:\s+\1){2,}\b/i.test(story)) {
    issues.push("A word is repeated too many times in a row.");
  }

  const paragraphs = story.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  if (story.length > 450 && paragraphs.length < 2) {
    issues.push("The story needs clearer paragraph formatting.");
  }

  const duplicateParagraphs = new Set();
  for (const paragraph of paragraphs) {
    const normalized = normalizeSentenceForComparison(paragraph);
    if (normalized.length < 40) continue;
    if (duplicateParagraphs.has(normalized)) {
      issues.push("A paragraph is duplicated or nearly duplicated.");
      break;
    }
    duplicateParagraphs.add(normalized);
  }

  const sentenceCounts = new Map();
  const sentences = splitStorySentences(story);
  for (const sentence of sentences) {
    const normalized = normalizeSentenceForComparison(sentence);
    if (normalized.length < 25) continue;
    sentenceCounts.set(normalized, (sentenceCounts.get(normalized) || 0) + 1);
    if (sentenceCounts.get(normalized) > 1) {
      issues.push("A sentence is repeated.");
      break;
    }
  }

  if (paragraphs.some((paragraph) => !/[.!?")]$/.test(paragraph))) {
    issues.push("At least one paragraph is missing proper ending punctuation.");
  }

  const lastSentence = sentences.at(-1) || paragraphs.at(-1) || story;
  const lastTwoSentences = sentences.slice(-2).join(" ") || lastSentence;
  if (/\?$/.test(lastSentence)) {
    issues.push("The ending still reads like a question instead of a settled bedtime close.");
  }
  if (hasCliffhangerEnding(lastTwoSentences)) {
    issues.push("The ending still sounds like a teaser or cliffhanger.");
  }

  const mixedDialectIssue = detectMixedDialectIssue(story, normalizeStoryLocale(dialect));
  if (mixedDialectIssue) {
    issues.push(mixedDialectIssue);
  }

  return issues;
}

export function assertStoryQuality(text, { dialect, label = "Story" } = {}) {
  const issues = detectStoryQualityIssues(text, { dialect });
  if (issues.length) {
    throw new Error(`${label} failed quality checks: ${issues.join(" | ")}`);
  }
  return normalizeStoryOutput(text);
}