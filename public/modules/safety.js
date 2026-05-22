// =============================================================================
// DreamTalez — Client-Side Input Safety
// Shared module imported by app.js and children.js.
// Mirrors the server-side list in server.js — keep both in sync.
// =============================================================================

const BANNED = [
  // profanity — English
  "fuck","shit","bitch","bastard","asshole","cunt","dick","cock","pussy","piss","crap","ass",
  // profanity — UK-specific
  "arse","arsehole","bollocks","wank","wanker","twat","shite","tosser","prick","bellend",
  // sexual
  "porn","nude","naked","rape","molest","masturbat",
  "paedo","pedophile","paedophile","trafficking","groomer","nonce",
  // violence
  "kill","murder","gun","knife","stab","shoot","bomb","gore","terror","suicide",
  "torture","mutilate","decapitate","strangle","noose","slaughter",
  // drugs / alcohol
  "cocaine","heroin","meth","weed","drunk","cigarette","vape",
  // horror / occult
  "satan","devil","horror","nightmare","lucifer",
  // hate speech
  "nigger","faggot","retard","nazi","hitler","racist","slut","whore",
];

const STEMS = new Set(["masturbat","paedo","pedophil","paedophil","wank","fuck","shit","arse","bolloc"]);

const SAFETY_RE = new RegExp(
  BANNED.map(w => STEMS.has(w) ? `\\b${w}\\w*` : `\\b${w}\\b`).join("|"), "i"
);

const INJECTION_RE = /ignore\s+(previous|your|all|prior)\s+(instructions?|prompt|rules?)|forget\s+(everything|your|all)|your\s+new\s+instructions|act\s+as\s+(an?\s+)?(ai|assistant|chatgpt|gpt|claude)|pretend\s+(you\s+are|to\s+be)|you\s+are\s+now\s+|jailbreak|dan\s+mode|new\s+persona|disregard\s+(all|previous|your)|override\s+(your|all|previous)|system\s+prompt|bypass\s+(safety|filter|rules?)|roleplay\s+as\b/i;

function normalizeLeet(text) {
  return String(text || "")
    .replace(/[@4]/g, "a").replace(/3/g, "e").replace(/[1!|]/g, "i")
    .replace(/0/g, "o").replace(/[5$]/g, "s").replace(/7/g, "t")
    .replace(/\*/g, "").replace(/\./g, "");
}

/**
 * Returns true if the input is safe for a children's platform.
 * Checks both the raw text and a leet-speak-normalised version.
 */
export function isInputSafe(text) {
  if (!text) return true;
  const norm = normalizeLeet(text);
  if (SAFETY_RE.test(text) || SAFETY_RE.test(norm)) return false;
  if (INJECTION_RE.test(text)) return false;
  return true;
}
