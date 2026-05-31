#!/usr/bin/env node
/**
 * One-shot script: removes confirmed-dead i18n keys from all language blocks
 * in public/modules/i18n.js.
 *
 * Run: node scripts/remove-dead-i18n-keys.js
 * Dry-run: node scripts/remove-dead-i18n-keys.js --dry
 */

const fs   = require("fs");
const path = require("path");

const DEAD_KEYS = new Set([
  // Replaced by different key names
  "paywall_title",
  "paywall_perk1",
  "paywall_perk2",
  "paywall_perk3",
  "paywall_perk4",
  "subscribe_btn",
  "story_today_title",
  "sample_story_btn",
  "settings_nav",

  // Old card system (superseded by card_sleepy_name / card_adventure_name etc.)
  "card_quick_name",
  "card_quick_dur",
  "card_quick_desc",
  "card_magic_name",
  "card_magic_dur",
  "card_magic_desc",
  "card_sleepy_desc",
  "card_custom_name",
  "card_custom_dur",
  "card_custom_desc",

  // Old loading step keys (loading-messages.js uses dt_load_msg_* instead)
  "loading_step_1",
  "loading_step_2",
  "loading_step_3",
  "loading_step_4",
  "loading_first_story",

  // Never wired up / orphaned features
  "story_today_desc",
  "story_today_badge",
  "medium_story",
  "medium_story_desc",
  "long_story",
  "long_story_desc",
  "surprise_me",
  "read_together_btn",
  "empty_library_title",
  "empty_library_hint",
  "empty_library_cta",
  "milestone_3",
  "milestone_7",
  "milestone_14",
  "cta_create",
  "choose_story",
  "my_idea_card",
  "my_idea_card_desc",

  // Obsolete alert/confirm keys (callers now use hardcoded strings)
  "read_again",
  "pick_child_first",
  "already_saved",
  "could_not_save",
  "alert_save_child_name",
  "alert_save_child_age",
  "alert_delete_cancel",
  "alert_delete_confirm",
  "alert_delete_password",
  "alert_logout_confirm",
  "alert_reset_email",
  "alert_reset_sent",
  "offline_title",
  "offline_body",
  "offline_library_btn",
  "offline_retry_btn",
]);

// Matches:   keyName: "...",   or   keyName: "...",   with any indentation
// Key must be an identifier (no quotes), value ends the line.
// We also accept keys that are the last entry in a block (no trailing comma).
const KEY_LINE_RE = /^(\s+)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:.+)$/;

const filePath = path.resolve(__dirname, "../public/modules/i18n.js");
const isDry    = process.argv.includes("--dry");

const original = fs.readFileSync(filePath, "utf8");
const lines    = original.split("\n");

let removed    = 0;
const kept     = [];

for (const line of lines) {
  const m = line.match(KEY_LINE_RE);
  if (m && DEAD_KEYS.has(m[2])) {
    removed++;
    if (isDry) console.log(`  REMOVE [${m[2]}]: ${line.trimEnd()}`);
  } else {
    kept.push(line);
  }
}

const result = kept.join("\n");

// Sanity: file must still contain all language block openers
const requiredMarkers = ['"en-GB"', '"fr"', '"es"', '"pt"', '"de"', '"it"', '"ja"', '"zh-CN"', '"ar"', '"hi"', '"ur"'];
const missing = requiredMarkers.filter(m => !result.includes(m));
if (missing.length) {
  console.error("ABORT — language blocks missing after filter:", missing);
  process.exit(1);
}

// Sanity: no active key should have been accidentally removed
const ACTIVE_KEYS_SPOT_CHECK = [
  "paywall_h2", "paywall_perks_note1", "subscribe_home_btn", "today_page_title",
  "auth_oneoff_btn", "account_nav", "card_sleepy_name", "card_adventure_name",
  "continue_section_title", "continue_sequel_btn", "world_toyland",
];
const activeRemoved = ACTIVE_KEYS_SPOT_CHECK.filter(k => !result.includes(k));
if (activeRemoved.length) {
  console.error("ABORT — active keys missing after filter:", activeRemoved);
  process.exit(1);
}

console.log(`\nDead keys removed : ${removed}`);
console.log(`Expected removals : ${DEAD_KEYS.size * 11} (${DEAD_KEYS.size} keys × 11 language blocks)`);
console.log(`Language blocks   : OK`);
console.log(`Active key check  : OK`);

if (isDry) {
  console.log("\nDry run — no file written.");
} else {
  fs.writeFileSync(filePath, result, "utf8");
  console.log(`\nWritten: ${filePath}`);
}
