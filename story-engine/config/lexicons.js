/**
 * Shared lexicons for the validation layer.
 *
 * Single source of truth for tone words, banned words, sensory categories,
 * and bedtime-specific vocabulary. Validators import from here so we can
 * tune heuristics in one place without touching validator logic.
 *
 * Lists are intentionally curated, not exhaustive — bedtime quality lives
 * in the small set of words children actually feel, not in a dictionary.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Bedtalez emotional direction
 * ─────────────────────────────────────────────────────────────────────
 * Bedtalez stories are "warm bedtime magic" — sweet, cozy, magical,
 * reassuring. They are NOT therapeutic, introspective, fear-modeling,
 * or psychologically probing.
 *
 * Comfort anchors we WANT to see in prose:
 *   warmth · wonder · comfort · reassurance
 *
 * Vocabulary we want to DETECT IN ORDER TO REMOVE (not model as an
 * "anxiety dimension"):
 *   unease (afraid / nervous / worried etc.)
 *
 * The unease list below exists to flag-and-remove discomfort imagery,
 * never to give validators a dial for "how anxious should this scene be."
 * Bedtime stories don't probe fears; they replace them with coziness.
 */

export const TONE_LEXICON = {
  warmth: [
    "warm", "soft", "gentle", "kind", "tender", "cozy", "snug", "hush",
    "hushed", "quiet", "calm", "still", "peaceful", "loving", "close",
    "embrace", "held", "safely", "safe", "smile", "smiled"
  ],
  wonder: [
    "shimmer", "shimmered", "shimmering", "glow", "glowed", "glowing",
    "sparkle", "sparkled", "glimmer", "twinkle", "wonder", "marvel",
    "magical", "moonlit", "starlight", "dream", "dreamy", "drift",
    "floating", "wondered"
  ],
  comfort: [
    "blanket", "pillow", "nest", "tucked", "curled", "rest", "rested",
    "resting", "breathing", "breath", "lullaby", "whisper", "whispered",
    "settle", "settled", "soothing", "soothed"
  ],
  reassurance: [
    "always", "together", "here", "listening", "safe", "remember",
    "promise", "promised", "loved", "loves", "found", "home"
  ],
  unease: [
    "afraid", "scared", "frightened", "worried", "anxious", "nervous",
    "trembled", "trembling", "shaking", "tense", "uneasy"
  ]
};

export const BEDTIME_BANNED = {
  // Hard fails — should never appear in a bedtime scene
  violent: [
    "blood", "bleeding", "kill", "killed", "killing", "stab", "stabbed",
    "shot", "shoot", "shooting", "gun", "knife", "weapon", "murder",
    "slaughter", "torture", "corpse", "dead body"
  ],
  // Loud / startling
  loud: [
    "screamed", "screaming", "shrieked", "shrieking", "shouted",
    "shouting", "yelled", "yelling", "exploded", "explosion", "blast",
    "crashed", "smashed", "shattered", "roared", "roaring"
  ],
  // Distressing imagery
  distressing: [
    "nightmare", "monster", "demon", "evil", "wicked", "cursed",
    "doomed", "dying", "drown", "drowned", "drowning", "burning",
    "trapped forever", "alone forever", "lost forever"
  ],
  // Soft fails — only flag if the scene is the closing scene
  ending_unsafe: [
    "ran", "running", "chased", "racing", "sprinted", "sprinting",
    "fought", "fighting", "battle", "argued", "arguing"
  ]
};

/**
 * Cozy bedtime atmosphere — the imagery Bedtalez wants to *favor*.
 * Used by the sensory validator to detect when prose lacks the
 * "soft moonlit bedtime world" texture. Independent slice from
 * TONE_LEXICON / SENSORY_LEXICON; overlap is intentional and harmless
 * (each validator measures a different dimension).
 *
 * Categories:
 *   light          — warm light sources (moonlight, lantern, firefly, ...)
 *   shelter        — safe warm spaces and coverings (blanket, cabin, nook, ...)
 *   gentle_nature  — soft natural imagery (snowfall, mist, drifting, brook, ...)
 *   hush           — quiet/stillness words (a calm bedtime presence)
 */
export const COZY_ATMOSPHERE = {
  light: [
    "moonlight", "moonlit", "moon",
    "lantern", "lanterns",
    "candle", "candles", "candlelight",
    "firefly", "fireflies",
    "starlight", "starlit", "stars", "starry",
    "glow", "glowed", "glowing",
    "firelight", "fireplace", "hearth",
    "lamp", "lamplight",
    "twinkle", "twinkled", "twinkling",
    "gleam", "gleamed", "gleaming",
    "golden", "amber"
  ],
  shelter: [
    "blanket", "blankets",
    "pillow", "pillows",
    "cabin", "cabins",
    "nest", "nested", "nestled",
    "cozy", "snug",
    "tucked",
    "hideaway", "alcove", "nook", "den",
    "quilt", "quilts", "comforter",
    "hammock",
    "cocoa", "kettle", "tea",
    "slipper", "slippers", "cushion"
  ],
  gentle_nature: [
    "snowfall", "snowflake", "snowflakes", "snowy",
    "drizzle", "raindrop", "raindrops",
    "mist", "misty", "fog", "foggy",
    "breeze", "breezes",
    "drift", "drifted", "drifting",
    "dew", "dewy",
    "brook", "stream", "ripple", "ripples", "river",
    "meadow", "clearing", "grove",
    "garden", "moss", "mossy",
    "willow", "willows",
    "fern", "ferns",
    "petal", "petals",
    "leaves", "blossom", "blossoms",
    "feather", "feathers"
  ],
  hush: [
    "hush", "hushed",
    "quiet", "still", "stillness",
    "silent", "silence",
    "lullaby"
  ]
};

/**
 * Harsh imagery — the texture Bedtalez wants to *avoid* in atmosphere.
 * Detected to warn, not banned outright (a single sharp word is fine if
 * balanced by warmth). The validator flags only when density is meaningful.
 */
export const HARSH_IMAGERY = [
  "jagged", "sharp",
  "freezing", "icy", "biting", "frigid",
  "harsh", "blistering", "scorching",
  "blinding", "deafening", "piercing",
  "brittle", "splintered", "shattered",
  "bleak", "barren", "hollow",
  "razor", "stark", "stinging"
];

export const SENSORY_LEXICON = {
  sight: [
    "saw", "see", "seen", "looked", "looking", "watched", "watching",
    "glimpsed", "shimmer", "shimmered", "glow", "glowed", "sparkle",
    "sparkled", "shadow", "shadows", "moonlight", "starlight", "color",
    "colors", "bright", "dim", "silver", "golden"
  ],
  sound: [
    "heard", "hearing", "listened", "listening", "whisper", "whispered",
    "rustle", "rustled", "hum", "hummed", "humming", "lullaby", "song",
    "sang", "sung", "music", "silence", "quiet", "echo", "echoed"
  ],
  touch: [
    "felt", "feeling", "soft", "warm", "cool", "smooth", "rough",
    "fluffy", "silky", "blanket", "pillow", "fur", "skin", "hand",
    "held", "holding", "brushed", "stroked", "wrapped"
  ],
  smell: [
    "smelled", "smelling", "scent", "scented", "fragrance", "aroma",
    "perfume", "lavender", "vanilla", "honey", "rain", "pine", "fresh"
  ],
  taste: [
    "tasted", "tasting", "sweet", "honey", "milk", "warm tea", "cocoa",
    "berry", "berries", "cinnamon"
  ]
};

export const READ_ALOUD_AWKWARD = [
  // Phonetic clusters that trip read-aloud cadence
  "th th", "s s ", "ck ck",
  // Tongue twisters — heuristic markers
  "specifically", "particularly", "subsequently", "consequently",
  "nevertheless", "furthermore", "approximately"
];

export const SENTENCE_OPENER_STOPWORDS = new Set([
  "the", "a", "an", "and", "but", "so", "then", "as", "with", "in",
  "on", "at", "of", "to", "for", "from", "by", "it", "she", "he",
  "they", "we", "i", "you", "his", "her", "their", "this", "that"
]);

export const COMMON_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "so", "if", "then", "as",
  "of", "to", "in", "on", "at", "by", "for", "with", "from", "into",
  "is", "was", "were", "be", "been", "being", "are", "am",
  "it", "its", "this", "that", "these", "those",
  "he", "she", "they", "we", "i", "you", "him", "her", "them", "us",
  "his", "hers", "their", "theirs", "our", "ours", "your", "yours", "my", "mine",
  "had", "has", "have", "having", "do", "does", "did", "done",
  "not", "no", "yes", "very", "just", "only", "also", "too",
  "there", "here", "where", "when", "while", "what", "who", "how", "why",
  "could", "would", "should", "can", "will", "may", "might", "must"
]);

export const AGE_BAND_READING_LEVEL = {
  // Targets are Flesch-Kincaid grade-level approximations (lower is younger).
  // Tuned for read-aloud bedtime: keep grade level low even for older bands,
  // because the prose is heard, not solo-read.
  "3-4": { min: 0.5, max: 3.0, target: 1.8 },
  "5-6": { min: 1.0, max: 3.8, target: 2.5 },
  "7-8": { min: 1.5, max: 4.5, target: 3.0 },
  "9-10": { min: 2.0, max: 5.5, target: 3.5 },
  default: { min: 1.0, max: 4.0, target: 2.5 }
};

export default {
  TONE_LEXICON,
  BEDTIME_BANNED,
  SENSORY_LEXICON,
  READ_ALOUD_AWKWARD,
  SENTENCE_OPENER_STOPWORDS,
  COMMON_WORDS,
  AGE_BAND_READING_LEVEL
};
