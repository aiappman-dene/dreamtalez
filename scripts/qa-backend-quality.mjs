import assert from "node:assert/strict";

import {
  buildStoryPrompt,
  buildValidationPrompt,
  buildDeliveryQaPrompt,
} from "../prompts.js";
import {
  STORY_LOCALE_EN_GB,
  STORY_LOCALE_EN_US,
  normalizeStoryLocale,
  detectStoryQualityIssues,
  assertStoryQuality,
} from "../story-quality.js";

function expectIssue(story, expectedIssue, dialect = STORY_LOCALE_EN_GB) {
  const issues = detectStoryQualityIssues(story, { dialect });
  assert(issues.some((issue) => issue.includes(expectedIssue)), `Expected issue containing "${expectedIssue}". Got: ${issues.join(" | ")}`);
}

const goodBritishStory = `Mila snuggled beneath her cosy blanket while the rain whispered against the window.

On her pillow sat a tiny lantern shaped like a moon, glowing just brightly enough to show her favourite picture book. Mila read one last page, smiled at the soft golden light, and thanked the quiet little lantern for keeping her company.

Soon the room felt warm, still, and safe. Mila placed the lantern on her bedside table, listened to the gentle rain, and drifted into sleep with a peaceful smile.`;

assert.deepEqual(
  detectStoryQualityIssues(goodBritishStory, { dialect: STORY_LOCALE_EN_GB }),
  [],
  "A polished British-English bedtime story should pass backend quality checks."
);
assert.equal(assertStoryQuality(goodBritishStory, { dialect: STORY_LOCALE_EN_GB }), goodBritishStory);

expectIssue(
  `Mila curled up in her cosy bed and smiled at her favorite lantern before sleep.`,
  "mixes dialects",
  STORY_LOCALE_EN_GB
);

expectIssue(
  `Theo found {name}'s blanket and carried it home.`,
  "Unresolved placeholder"
);

expectIssue(
  `Everything felt calm and safe.\n\nEverything felt calm and safe.`,
  "sentence is repeated"
);

expectIssue(
  `Ava tucked herself in and smiled. What happens next?`,
  "question instead of a settled bedtime close"
);

expectIssue(
  `Noah settled into bed, but this was just the beginning of tomorrow's adventure.`,
  "teaser or cliffhanger"
);

assert.throws(
  () => assertStoryQuality(`Ava tucked herself in and smiled. What happens next?`, { dialect: STORY_LOCALE_EN_GB, label: "Strict check" }),
  /Strict check failed quality checks/
);

assert.equal(normalizeStoryLocale("american"), STORY_LOCALE_EN_US);
assert.equal(normalizeStoryLocale("en-GB"), STORY_LOCALE_EN_GB);

const heroPrompt = buildStoryPrompt({
  name: "Theo",
  age: "7",
  interests: "space, kindness",
  length: "medium",
  dialect: STORY_LOCALE_EN_GB,
  customIdea: "Theo helps a lost moon robot find its way back to the star harbour.",
  seriesContext: "Night 2: Theo previously met a silver moon robot called Pip at the star harbour.",
});
assert(heroPrompt.includes("CUSTOM STORY IDEA (MANDATORY — FOLLOW EXACTLY):"));
assert(heroPrompt.includes("SERIES CONTINUITY"));

const todayPrompt = buildStoryPrompt({
  name: "Mila",
  age: "5",
  interests: "reading, rainbows",
  length: "short",
  dialect: STORY_LOCALE_EN_US,
  dayBeats: "She painted a rainbow, tripped in the garden, and cuddled with Mum after dinner.",
  dayMood: "mixed",
});
assert(todayPrompt.includes("STORY FROM TODAY (REAL LIFE → GENTLE REFLECTION):"));
assert(todayPrompt.includes("How would a loving grandparent retell today as a bedtime story?"));

const quickWishPrompt = buildStoryPrompt({
  name: "Ava",
  age: "6",
  interests: "space, animals",
  length: "short",
  dialect: STORY_LOCALE_EN_GB,
  childWish: "flying",
});
assert(quickWishPrompt.includes("TONIGHT'S MAIN STORY PROMISE"));
assert(quickWishPrompt.includes("\"flying\" should not become merely \"space\" or \"birds\""));

const compositeWishPrompt = buildStoryPrompt({
  name: "Ava",
  age: "6",
  interests: "travel, ocean",
  length: "short",
  dialect: STORY_LOCALE_EN_GB,
  childWish: "flying over dolphins",
});
assert(compositeWishPrompt.includes("preserve ALL major parts together"));
assert(compositeWishPrompt.includes("\"flying over dolphins\" should include both the flying action and dolphins below"));

const validationPrompt = buildValidationPrompt("Story text", {
  mode: "hero",
  dialect: STORY_LOCALE_EN_US,
  interests: "robots, stars",
  customIdea: "A tiny robot guides a child home.",
  seriesContext: "Night 3 continuity.",
});
assert(validationPrompt.includes("IDEA INTEGRITY CHECK"));
assert(validationPrompt.includes("CONTINUITY CHECK"));
assert(validationPrompt.includes("American English (en-US) spelling and phrasing"));

const randomWishValidationPrompt = buildValidationPrompt("Story text", {
  mode: "random",
  dialect: STORY_LOCALE_EN_GB,
  interests: "space, animals",
  childWish: "flying",
});
assert(randomWishValidationPrompt.includes("WISH FIDELITY CHECK"));
assert(randomWishValidationPrompt.includes("that action/image must clearly happen on-page"));

const compositeWishValidationPrompt = buildValidationPrompt("Story text", {
  mode: "random",
  dialect: STORY_LOCALE_EN_GB,
  interests: "travel, ocean",
  childWish: "flying over dolphins",
});
assert(compositeWishValidationPrompt.includes("preserve all of them together"));

const deliveryPrompt = buildDeliveryQaPrompt("Story text", {
  dialect: STORY_LOCALE_EN_GB,
  issues: ["Unresolved placeholder token remains in the story.", "The ending still sounds like a teaser or cliffhanger."],
});
assert(deliveryPrompt.includes("Unresolved placeholder token remains in the story."));
assert(deliveryPrompt.includes("The ending still sounds like a teaser or cliffhanger."));
assert(deliveryPrompt.includes("British English (en-GB) spelling and phrasing"));

console.log("Backend QA passed: story-quality guards and prompt builders are behaving as expected.");