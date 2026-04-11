// =============================================================================
// DreamTalez — Frontend Application
// Production-quality bedtime story generator
// =============================================================================
//
// CHANGE LOG (vs previous version):
// ----------------------------------
// [BUG]  dreamInterests was referenced but never defined → removed reference,
//        merged age-appropriate fallback interests into enhanceInterests()
// [BUG]  innerHTML used for story output → replaced with textContent (XSS fix)
// [BUG]  No response.ok check on /generate fetch → added proper error handling
// [BUG]  formatName() defined before ES module imports → moved after imports
// [BUG]  Hero form never auto-filled from selected child → now auto-fills
// [BUG]  enhanceInterests() crashed when child had no interests → guarded
// [BUG]  Reading mode didn't prevent background scroll → body overflow hidden
// [BUG]  Escape key didn't close reading mode → added keydown listener
// [BUG]  Server now returns { story, title } → frontend handles title
// [IMPROVE] Loading state uses animated overlay instead of plain text
// [IMPROVE] Story card appears only when a story exists
// [IMPROVE] Tab state properly managed
// [IMPROVE] All event listeners consolidated at bottom
// [IMPROVE] All globals eliminated except auth state
// =============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// =============================================================================
// Firebase
// =============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyAoNxcJTiqah_Ig_1THapgWIYY3Y-nPWj8",
  authDomain: "dreamtalez.firebaseapp.com",
  projectId: "dreamtalez",
  storageBucket: "dreamtalez.firebasestorage.app",
  messagingSenderId: "219771634733",
  appId: "1:219771634733:web:007c920a5442a4d19c24a4",
  measurementId: "G-Y9MQTMYQ5C",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Surface any top-level module failure — if this fires, the window.* exports
// at the bottom of the file never ran and every inline onclick is a no-op.
window.onerror = function (msg, url, line, col, error) {
  console.error("Global error:", msg, error);
};
window.addEventListener("error", (e) => {
  console.error("[DreamTalez top-level error]", e.error || e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[DreamTalez unhandled rejection]", e.reason);
});

// =============================================================================
// App State
// =============================================================================

let currentUser = null;
let cachedChildren = [];
let cachedStreaks = {};
let cachedLibrary = [];
let cachedSeries = {}; // { [childName]: { nightCount, lastTitle, lastSummary, lastSavedAt } }
let cachedTrial = null; // { startedAt, storiesUsed, status: "active"|"expired"|"paid" }
let cachedDialect = "en-GB";

const TRIAL_DAYS = 7;
const TRIAL_STORY_CAP = 7;
let currentStoryTitle = "";
let currentStoryText = "";
let currentStoryChildName = "";
let currentStoryMode = "";
let selectedChildIndex = 0; // index into cachedChildren
let currentPage = "home"; // tracks which page is visible
let previousPage = "home"; // for story card "back" button

const DIALECT_BRITISH = "en-GB";
const DIALECT_AMERICAN = "en-US";
const LEGACY_DIALECT_BRITISH = "british";
const LEGACY_DIALECT_AMERICAN = "american";
const DIALECT_ALIASES = {
  [DIALECT_BRITISH.toLowerCase()]: DIALECT_BRITISH,
  [LEGACY_DIALECT_BRITISH]: DIALECT_BRITISH,
  [DIALECT_AMERICAN.toLowerCase()]: DIALECT_AMERICAN,
  [LEGACY_DIALECT_AMERICAN]: DIALECT_AMERICAN,
};
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

// =============================================================================
// Utility
// =============================================================================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatName(name) {
  if (!name) return "A little one";
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function $(id) {
  return document.getElementById(id);
}

async function buildAuthenticatedJsonHeaders() {
  const headers = { "Content-Type": "application/json" };

  if (currentUser) {
    try {
      const idToken = await currentUser.getIdToken();
      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
      }
    } catch (error) {
      console.error("Fetching auth token failed:", error);
    }
  }

  return headers;
}

function normalizeDialect(value) {
  const key = String(value || "").trim().toLowerCase();
  return DIALECT_ALIASES[key] || DIALECT_BRITISH;
}

function getCurrentDialect() {
  return normalizeDialect(cachedDialect);
}

function getDialectLabel(dialect = getCurrentDialect()) {
  return dialect === DIALECT_AMERICAN ? "American English" : "British English";
}

function matchReplacementCase(source, replacement) {
  if (source.toUpperCase() === source) return replacement.toUpperCase();
  if (source[0] && source[0] === source[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function applyDialectToText(text, dialect = getCurrentDialect()) {
  if (!text) return "";

  const replacements = DIALECT_PAIRS
    .map(([british, american]) => dialect === DIALECT_AMERICAN ? [british, american] : [american, british])
    .sort((a, b) => b[0].length - a[0].length);

  return replacements.reduce((result, [from, to]) => {
    const pattern = new RegExp(`\\b${from}\\b`, "gi");
    return result.replace(pattern, (match) => matchReplacementCase(match, to));
  }, String(text));
}

function renderDialectControls() {
  const dialect = getCurrentDialect();
  const britishBtn = $("dialectBritishBtn");
  const americanBtn = $("dialectAmericanBtn");
  const status = $("dialectStatus");

  if (britishBtn) {
    const active = dialect === DIALECT_BRITISH;
    britishBtn.classList.toggle("active", active);
    britishBtn.classList.toggle("secondary", active);
    britishBtn.classList.toggle("ghost", !active);
    britishBtn.setAttribute("aria-pressed", String(active));
  }

  if (americanBtn) {
    const active = dialect === DIALECT_AMERICAN;
    americanBtn.classList.toggle("active", active);
    americanBtn.classList.toggle("secondary", active);
    americanBtn.classList.toggle("ghost", !active);
    americanBtn.setAttribute("aria-pressed", String(active));
  }

  if (status) {
    status.textContent = `Stories will use ${getDialectLabel(dialect)} spelling and phrasing.`;
  }
}

async function saveStoryDialect(nextDialect) {
  const normalized = normalizeDialect(nextDialect);
  if (normalized === cachedDialect) {
    renderDialectControls();
    return;
  }

  const previousDialect = cachedDialect;
  cachedDialect = normalized;
  renderDialectControls();

  if (!currentUser) return;

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      storyDialect: normalized,
      storyLocale: normalized,
    });
  } catch (error) {
    cachedDialect = previousDialect;
    renderDialectControls();
    console.error("Saving dialect preference failed:", error);
    alert("Could not save language preference. Please try again.");
  }
}

// =============================================================================
// Story Data — Procedural Quick Story engine
// =============================================================================

const characterTypes = [
  "a little boy", "a little girl", "a curious child", "a gentle baby",
  "a tiny toddler", "a brave young explorer", "a baby bear", "a little bunny",
  "a small fox", "a sleepy kitten", "a playful puppy", "a tiny deer",
  "a fluffy duckling", "a young lion cub", "a baby elephant",
  "a little dinosaur", "a friendly dragon", "a tiny unicorn",
  "a soft cloud creature", "a glowing star child", "a magical fairy child",
  "a cuddly teddy bear", "a living toy robot", "a soft ragdoll friend",
  "a tiny wooden puppet",
];

const neutralCharacterTypes = [
  "a curious child", "a gentle child", "a thoughtful child", "a brave young explorer",
  "a kind little child", "a calm little adventurer", "a gentle dreamer", "a caring child",
];

const personalities = [
  "curious", "brave", "kind", "gentle", "playful", "thoughtful",
  "quiet", "happy", "dreamy", "adventurous", "caring", "friendly",
  "shy", "excited", "calm", "imaginative",
];

const roles = [
  "who loved exploring", "who enjoyed quiet adventures",
  "who was always asking questions", "who loved discovering new things",
  "who enjoyed helping others", "who dreamed of magical places",
  "who loved bedtime stories", "who believed in gentle magic",
  "who liked to wander and wonder", "who always followed their curiosity",
];

const magicTraits = [
  "", "", "",
  "with a softly glowing light",
  "who could hear the stars whisper",
  "who left tiny sparkles wherever they walked",
  "who could understand animals",
  "with a heart full of quiet magic",
  "who could see hidden worlds",
  "who carried a little bit of stardust",
  "who made everything feel calm and safe",
];

const settings = [
  "a still forest filled with fireflies",
  "a calm meadow bright beneath the stars",
  "a peaceful lake reflecting the moonlight",
  "a slow river in a sleepy valley",
  "a hidden waterfall surrounded by mossy rocks",
  "a soft cloud drifting across a starry sky",
  "a floating island surrounded by shining stars",
  "a dreamy sky filled with constellations",
  "a magical sky bridge made of stardust",
  "a peaceful village under the moonlight",
  "a warm cottage with a golden fireplace",
  "a bedroom filled with soft shadows",
  "a cosy cabin surrounded by snow",
  "a magical treehouse hidden among the leaves",
  "a moonlit forest where trees whisper softly",
  "a secret garden filled with sparkling flowers",
  "a fairy village hidden under mushrooms",
  "a land where teddy bears come to life",
  "a soft toy kingdom full of cuddly friends",
  "a sleepy dinosaur valley",
  "a world made of pillows and blankets",
  "a calm ocean shining under the moon",
  "a peaceful coral reef with silver fish",
  "a drifting boat on a silent sea",
];

const openings = [
  "The night was calm and full of soft magic.",
  "Everything felt still, peaceful, and safe.",
  "The world had settled into a soft, sleepy hush.",
  "A tender stillness drifted across the land.",
  "The evening wrapped everything in calm.",
  "Night arrived gently, like a whisper.",
  "A peaceful silence stretched all around.",
  "The stars shimmered softly above.",
  "A soft hush filled the air.",
  "The world was ready to dream.",
];

const openingAddons = [
  "A mild breeze whispered through the air.",
  "The stars twinkled quietly above.",
  "Everything felt warm and safe.",
  "A pale light rested over the world.",
  "Nothing rushed. Everything was calm.",
];

const incitingMoments = [
  "A silver trail of moonlight shimmered softly into view.",
  "A tiny bell chimed softly nearby.",
  "A warm light flickered in the distance, inviting and kind.",
  "A pale path of light stretched ahead.",
  "A ripple of stardust drifted across the ground.",
];

const companions = [
  { full: "a kind little fox with bright, curious eyes", short: "the little fox" },
  { full: "a sleepy bunny with velvet-soft ears", short: "the bunny" },
  { full: "a tiny owl with a calm and clever voice", short: "the owl" },
  { full: "a friendly deer with light footsteps", short: "the deer" },
  { full: "a moonlit cloud creature that floated beside them", short: "the cloud creature" },
  { full: "a kind palace kitten with soft silver fur", short: "the kitten" },
  { full: "a sweet bear cub with warm brown eyes", short: "the bear cub" },
  { full: "a small hedgehog with a happy smile", short: "the hedgehog" },
];

const companionIntros = [
  "Just then, {companionFull} appeared beside {name}, eyes warm and kind.",
  "That was when {name} noticed {companionFull} nearby.",
  "A soft sound made {name} turn — {companionFull} had come to share the adventure.",
  "Nearby, {companionFull} was resting peacefully, ready to walk with {name}.",
  "{name} was not alone. Waiting there was {companionFull}, ready to help.",
  "From just ahead, {companionFull} gave {name} a soft, welcoming look.",
  "A moment later, {name} spotted {companionFull}, ready to help in a calm and cheerful way.",
  "Waiting beside the path was {companionFull}, right where tonight's adventure needed a friend.",
];

const softChallenges = [
  "a misty path that wound this way and that",
  "a little bridge that swayed over a quiet stream",
  "a field of whispering grass that rustled in every direction",
  "a hill of smooth stones that glittered in the moonlight",
  "a narrow path hidden behind silver leaves",
];

const calmingActions = [
  "They paused, took a deep breath, and listened to the quiet night.",
  "They placed a hand over their heart and walked one calm step at a time.",
  "They slowed down, smiled, and followed the soft glow ahead.",
  "They stood still for a moment, then moved forward with gentle courage.",
  "Remembering how safe everything felt made the next step easier.",
];

const discoveries = [
  "a moonlit garden filled with sparkling flowers",
  "a tiny hidden library with glowing storybooks",
  "a secret pond where stars reflected like lanterns",
  "a circle of ancient trees humming a soft lullaby",
  "a crystal archway shimmering with warm light",
];

const clueMoments = [
  "A faint clue appeared ahead, like a kind hint from the night itself.",
  "Tiny signs began to appear along the path, each one pointing toward something special.",
  "The air shimmered with the feeling that a hidden surprise was waiting just beyond the next step.",
  "A small, curious hint glowed nearby, inviting a closer look.",
];

const helperMoments = [
  "It soon became clear that someone nearby needed a little caring help.",
  "Before long, {name} realised tonight's adventure was really about a small act of kindness.",
  "The path was leading toward someone who needed calm, patient help.",
  "A steady feeling told {name} that helping would be the most important part of the journey.",
];

const revealMoments = [
  "When they looked closely, {discovery} held exactly the answer they needed.",
  "There, waiting patiently, was {discovery}, and suddenly the whole adventure made perfect sense.",
  "{discovery} shone softly, ready at last to share its secret.",
  "In the quiet glow ahead, {discovery} looked small and magical, like an answer wrapped in light.",
];

const resolutionMoments = [
  "Using what had been discovered, {name} made everything feel calm, safe, and right again.",
  "With a little thought and a lot of kindness, {name} knew exactly what to do next.",
  "Step by step, {name} turned the night's puzzle into something happy and whole.",
  "What had seemed uncertain at first now felt simple, warm, and beautifully clear.",
];

const quietCelebrations = [
  "Nothing loud was needed to celebrate. The calm itself felt happy.",
  "A soft light lingered around them, and the whole world felt quietly glad.",
  "For a moment, everything felt wonderfully still, proud, and peaceful.",
  "The night felt warm and pleased in that calm way only bedtime adventures can.",
];

const homecomingMoments = [
  "The way home felt softer than before, as though the path remembered them now.",
  "Each step back home felt easier, lighter, and full of quiet pride.",
  "The world had grown even quieter by the time home came into view.",
  "By then, home no longer felt far away at all — it felt close and warm.",
];

const worldStoryKits = {
  superheroes: {
    storyShapes: ["helper", "quest", "discovery", "comfort"],
    openings: [
      "The city was still, but hero-magic still shimmered in the air.",
      "Night settled softly over the town, just the way secret heroes liked it.",
      "A calm silver glow rested over the rooftops, and the whole world felt safe tonight.",
    ],
    incitingMoments: [
      "A soft hero-signal flickered nearby, warm and kind rather than loud.",
      "A little streak of starlight drifted through the sky, asking for help in the gentlest way.",
      "A tiny sparkle-map appeared ahead, showing that someone needed a calm kind of bravery.",
    ],
    helperMoments: [
      "It became clear that tonight's mission was not about battling, but about making someone feel safe and brave.",
      "The real superhero work, {name} realised, was helping in a way that made everything gentler.",
    ],
    clueMoments: [
      "Little signs of kindness began to appear, like superhero clues only a calm heart could notice.",
      "A warm glow ahead hinted that tonight's mission was already waiting to be understood.",
    ],
    revealMoments: [
      "When they looked closely, {discovery} felt less like a prize and more like a power made for helping.",
      "There, shining softly, was {discovery}, carrying exactly the kind of courage tonight needed.",
    ],
    resolutionMoments: [
      "With kindness leading the way, {name} used that gentle hero-magic to make everything feel right again.",
      "{name} discovered that the strongest power was knowing exactly how to help without frightening anyone at all.",
    ],
    quietCelebrations: [
      "The town stayed peaceful, and its windows shone with quiet thanks.",
      "No one needed a cheer to know a small heroic thing had just happened.",
    ],
    homecomingMoments: [
      "By the time the rooftops faded behind them, the whole night felt calmer than before.",
      "The journey home drifted through a city that now believed in quiet heroes.",
    ],
    gentleActionOptions: [
      "{name} and {companion} followed the soft hero-signal together, moving with calm purpose.",
      "Staying close to {companion}, {name} moved gently onward, ready to help in whatever way was needed.",
    ],
    discoveryOptions: [
      "Soon, {name} and {companion} found {discovery}, shining like the kindest superhero secret of all.",
      "At the end of the path, {discovery} waited quietly, ready to turn a small worry into courage.",
    ],
    closingMagicOptions: [
      "Before leaving, {name} received {gift}, a reminder that gentle heroes can brighten whole nights.",
      "As a quiet reward, {name} was given {gift}, and it felt full of safe and steady power.",
    ],
  },
  princesses: {
    storyShapes: ["discovery", "comfort", "helper"],
    openings: [
      "The castle garden glimmered softly tonight, as though every flower had saved a little moonlight for Sophia's adventure.",
      "Everything in the quiet palace felt calm and silver, ready for a gentle royal secret to unfold.",
    ],
    incitingMoments: [
      "A soft bell chimed somewhere beyond the rose arches, inviting a closer look.",
      "A tiny glimmer near the palace path hinted that something lovely was waiting to be discovered.",
    ],
    clueMoments: [
      "Each little sign felt like part of a bedtime fairytale leading onward.",
      "The garden offered gentle clues in moonlit petals, ribbons, and silver glow.",
    ],
    helperMoments: [
      "Before long, {name} realised tonight's adventure was about bringing a little more warmth and wonder back to the palace.",
      "A calm feeling told {name} that tonight's gentlest royal task was helping something beautiful feel complete again.",
    ],
    revealMoments: [
      "There, tucked quietly beyond the curtains, was {discovery}, like a fairytale answer waiting all along.",
      "When {name} found {discovery}, it felt as though the whole garden had been leading there kindly.",
    ],
    resolutionMoments: [
      "With gentle grace, {name} helped the palace feel brighter, calmer, and beautifully complete.",
      "What had felt quiet and uncertain soon turned into the kind of royal moment bedtime stories remember best.",
    ],
    quietCelebrations: [
      "The garden stayed hushed, but every flower seemed a little happier than before.",
      "No grand fanfare was needed. The warm fairytale hush around them already felt like a celebration.",
    ],
    homecomingMoments: [
      "The way home felt soft and silvery, as though the palace wanted to walk beside them a little longer.",
      "By the time home came near again, the whole night felt touched with gentle royal magic.",
    ],
    gentleActionOptions: [
      "{name} and {companion} followed the moonlit path together, moving with the quiet grace of a bedtime fairytale.",
      "Keeping close to {companion}, {name} crossed the palace garden one gentle step at a time.",
    ],
    discoveryOptions: [
      "Soon, {name} and {companion} found {discovery}, waiting like a secret the palace had carefully kept.",
      "At the end of the quiet royal path, {discovery} appeared softly, ready to make everything feel right again.",
    ],
    closingMagicOptions: [
      "Before leaving, {name} received {gift}, and it felt like a tiny keepsake from a bedtime fairytale.",
      "As the royal garden settled into stillness, {gift} stayed with {name}, light and lovely as moonlit silk.",
    ],
  },
  school: {
    storyShapes: ["helper", "comfort", "discovery"],
    openings: [
      "Morning light rested gently on the school, making everything feel new but welcoming.",
      "The classroom was quiet and bright, full of the kind of surprises that did not need to feel scary.",
    ],
    incitingMoments: [
      "A little sign appeared that today might hold a brave first step.",
      "Somewhere nearby, a tiny clue suggested that school had a gentle secret waiting to be discovered.",
    ],
    helperMoments: [
      "Before long, {name} realised that school felt easier when kindness was shared.",
      "A quiet feeling told {name} that helping someone else might make the whole day feel braver.",
    ],
    revealMoments: [
      "There, tucked safely nearby, was {discovery}, reminding {name} that courage can be small and steady.",
      "When they found {discovery}, the whole day felt friendlier at once.",
    ],
    resolutionMoments: [
      "Taking one calm step after another, {name} made the classroom feel warmer and easier to enter.",
      "With a little bravery and a little kindness, {name} turned a nervous moment into a good memory.",
    ],
    gentleActionOptions: [
      "{name} and {companion} moved through the school together, noticing small friendly things along the way.",
      "With {companion} close by, {name} took the next step, then the next, until school felt softer.",
    ],
    discoveryOptions: [
      "Soon, {name} and {companion} found {discovery}, and it made the whole day feel friendlier at once.",
      "At the heart of the school-day mystery, {discovery} waited quietly, ready to make the next step feel braver.",
    ],
  },
  toys: {
      storyShapes: ["quest", "discovery", "comfort"],
      openings: [
        "The playroom glowed softly tonight, as though every toy was waiting for a secret world to wake.",
        "Everything in the toyroom felt still and magical, full of the kind of wonder only bedtime can find.",
      ],
      incitingMoments: [
        "A silver thread of moonlight slipped between the toy boxes, inviting {name} to follow.",
        "Somewhere among the tiny worlds, a soft glimmer suggested a hidden adventure was about to begin.",
      ],
      clueMoments: [
        "Each clue felt like part of a tiny world slowly waking up.",
        "The toys offered quiet hints in wheels, blocks, and moonlit corners.",
      ],
      helperMoments: [
        "Before long, {name} realised tonight's adventure was about helping a little world come together just right.",
        "A calm feeling told {name} that the playroom was waiting for one small act of imagination to complete it.",
      ],
      revealMoments: [
        "There, tucked inside the toyroom glow, was {discovery}, like the doorway to a tiny waiting world.",
        "When {name} found {discovery}, it felt as though the whole playroom had softly come alive.",
      ],
      resolutionMoments: [
        "With patient imagination, {name} helped the tiny toy world become whole, welcoming, and ready to dream.",
        "What had first looked like scattered bedtime pieces soon turned into something magical and complete.",
      ],
      quietCelebrations: [
        "The playroom stayed still, but everything in it felt happily arranged at last.",
        "No toy made a sound, yet the warm hush around them felt wonderfully proud.",
      ],
      homecomingMoments: [
        "The way home through the playroom felt softer now, as though the tiny world was smiling behind them.",
        "By the time home came near again, the whole room felt cosier and full of secret wonder.",
      ],
      gentleActionOptions: [
        "{name} and {companion} moved from one tiny clue to the next, careful not to miss any little wonder waking in the room.",
        "Keeping close to {companion}, {name} followed the moonlit toy path deeper into the quiet playroom magic.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, and it felt like the beginning of a world made just for tonight.",
        "At the heart of the toyroom, {discovery} waited softly, ready to turn imagination into something real.",
      ],
      closingMagicOptions: [
        "Before leaving, {name} received {gift}, a tiny reminder that toy worlds can stay close even after bedtime.",
        "As the playroom settled into hush again, {gift} stayed with {name}, small and magical as a secret tucked beneath a pillow.",
      ],
    },
  bedtime: {
    storyShapes: ["comfort", "discovery", "quest"],
    openings: [
      "The whole house was beginning to whisper goodnight.",
      "Evening softened every corner of home until it felt ready for sleep.",
    ],
    incitingMoments: [
      "A sleepy trail of light appeared, inviting {name} along.",
      "Somewhere nearby, a tiny goodnight mystery shimmered into view.",
    ],
    helperMoments: [
      "Bedtime wanted one last gentle thing to be put right before sleep.",
      "A soft feeling told {name} that tonight's adventure was really about helping the whole evening settle.",
    ],
    revealMoments: [
      "When they found {discovery}, it felt exactly like the calm answer bedtime had been waiting for.",
      "There, shining softly, was {discovery}, carrying the feeling of a perfect goodnight.",
    ],
    resolutionMoments: [
      "Once {name} understood what was needed, bedtime wrapped the whole world in calm.",
      "Step by step, {name} helped the evening become cosy and ready for rest.",
    ],
    quietCelebrations: [
      "The whole room breathed out happily, as though bedtime itself approved.",
      "Nothing moved quickly anymore. That was how everyone knew the adventure was complete.",
    ],
  },
  dreams: {
    storyShapes: ["discovery", "comfort", "quest"],
    openings: [
      "Dreamlight shimmered softly through the air, making everything feel possible and safe.",
      "The night sky looked especially close, with dreams waiting just beyond it.",
    ],
    incitingMoments: [
      "A drifting path of dream-glow appeared, inviting {name} to follow without a sound.",
      "A sleepy little star flickered nearby, hinting that dreamland had something kind to show.",
    ],
    clueMoments: [
      "The dream-world offered sleepy clues, each one softer and stranger than the last.",
      "The air itself whispered that something beautiful was waiting to be noticed.",
    ],
    revealMoments: [
      "There, gleaming softly, was {discovery}, like a dream trying to tell its secret kindly.",
      "When they looked closely, {discovery} felt like a gentle message from the night sky.",
    ],
    closingMagicOptions: [
      "Before leaving dreamland, {name} received {gift}, like a piece of starlit calm to carry home.",
      "As the journey ended, {name} tucked away {gift}, certain it would glow again in future dreams.",
    ],
  },
  animals: {
    storyShapes: ["helper", "quest", "discovery"],
    openings: [
      "The woodland was peaceful, full of soft paws, feathers, and sleepy breathing.",
      "Every leaf rustled kindly, as if the animals already knew a friend was coming.",
    ],
    incitingMoments: [
      "A tiny rustle nearby suggested that one of the woodland creatures needed help.",
      "A narrow trail of tracks appeared, leading toward a small animal mystery.",
    ],
    helperMoments: [
      "It soon became clear that tonight's adventure was really about helping a small creature feel safe.",
      "{name} could tell from the quiet sounds around them that kindness would matter more than anything else.",
    ],
    resolutionMoments: [
      "With patient kindness, {name} helped the little creature's world feel safe and settled again.",
      "The forest softened with relief as {name} gently made things right.",
    ],
    quietCelebrations: [
      "Somewhere nearby, happy little animal sounds drifted through the calm night air.",
      "The woods stayed quiet, but they felt full of gratitude all the same.",
    ],
  },
  mystery: {
    storyShapes: ["discovery", "quest", "helper"],
    openings: [
      "The night was full of calm corners and the feeling that a friendly secret was nearby.",
      "Moonlight lay across the path like a clue waiting to be understood.",
    ],
    incitingMoments: [
      "A tiny clue appeared in plain sight, though only a careful eye would have noticed it.",
      "Somewhere nearby, a mystery began with the softest possible sign.",
    ],
    clueMoments: [
      "Each little clue fit the last one so neatly that the path began to make gentle sense.",
      "The mystery unfolded one calm hint at a time, never rushing, never frightening.",
    ],
    revealMoments: [
      "At last, {discovery} appeared, and every earlier clue suddenly felt perfectly placed.",
      "When they reached {discovery}, the whole mystery opened like a quiet little flower.",
    ],
    resolutionMoments: [
      "Using what they had pieced together, {name} solved the mystery with calm care.",
      "Once the final clue was understood, everything that had seemed hidden now felt warm and clear.",
    ],
  },
  space: {
      storyShapes: ["quest", "discovery", "helper"],
      openings: [
        "The stars felt especially close tonight, as though the sky itself had opened a quiet path.",
        "Everything beyond the moon felt calm and welcoming, ready for a gentle space adventure.",
      ],
      incitingMoments: [
        "A tiny star-signal blinked softly ahead, asking for help from somewhere far above.",
        "A silver trail of stardust appeared, leading toward a peaceful mission in the night sky.",
      ],
      clueMoments: [
        "Little signs of space-magic glimmered around them, each one pointing the next way forward.",
        "The constellations shifted kindly, offering a map only patient eyes could follow.",
      ],
      revealMoments: [
        "There, drifting in the calm glow, was {discovery}, safe in the stars' quiet care.",
        "When {name} reached {discovery}, it was like finding a quiet answer hidden inside the sky.",
      ],
      resolutionMoments: [
        "With steady courage, {name} helped the space-night return to its calm and shining rhythm.",
        "The mission ended gently, and the stars shone even brighter for what {name} had done.",
      ],
      quietCelebrations: [
        "The constellations shimmered softly, like a quiet thank you from the sky.",
        "Nothing made a sound, but the universe felt pleased and peaceful.",
      ],
      homecomingMoments: [
        "The path home drifted through soft starlight, calm and silver all the way.",
        "By the time home came near again, the whole sky felt like a friendly memory waiting to stay.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the starlit path together, floating gently from one clue to the next.",
        "Keeping close to {companion}, {name} crossed the quiet sky with calm, careful wonder.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, glowing like a secret the stars had been saving.",
        "At the edge of the mission, {discovery} waited quietly, silver and full of meaning.",
      ],
      goalPayoffOptions: [
        "With {discovery} to guide them, {name} and {companion} soon found the sleepy planet and were able to {goal}.",
        "The meaning of {discovery} became clear at last, and it showed {name} and {companion} exactly how to {goal}.",
      ],
      closingMagicOptions: [
        "Before returning, {name} received {gift}, like a small piece of the night sky to carry home.",
        "As the adventure ended, {gift} was placed gently in {name}'s hands like a calm little star.",
      ],
    },
  flying: {
      storyShapes: ["quest", "discovery", "helper"],
      openings: [
        "The evening sky felt wide, calm, and full of gentle possibilities tonight.",
        "A soft path of wind seemed to unfurl above the sleeping world, inviting a peaceful flying adventure.",
      ],
      incitingMoments: [
        "A quiet current of air curled ahead, as though the sky itself were inviting {name} onward.",
        "A silver ribbon of wind drifted across the night, asking to be followed in the gentlest way.",
      ],
      clueMoments: [
        "The sky offered clues in drifting clouds, moonlit currents, and the peaceful world far below.",
        "Each soft turn of the wind hinted kindly at where the next part of the journey should go.",
      ],
      revealMoments: [
        "There, shining softly along the sky-path, was {discovery}, as though the wind had been carrying it all along.",
        "When {name} reached {discovery}, the whole flying journey suddenly made calm, perfect sense.",
      ],
      resolutionMoments: [
        "With steady calm, {name} followed the sky's gentle guidance and helped the journey settle into exactly the right ending.",
        "What had seemed wide and mysterious in the sky soon became clear through patience, kindness, and careful flying.",
      ],
      quietCelebrations: [
        "Far below, the world remained peaceful, but everything seemed to glow with a quiet sort of thanks.",
        "The wind softened around them, like the sky's own calm applause.",
      ],
      homecomingMoments: [
        "The way home drifted on a soft current of air, easy and silver in the moonlight.",
        "By the time home came near again, the whole sky felt like a gentle memory waiting to stay.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the quiet wind-path together, gliding one gentle turn at a time.",
        "Keeping close to {companion}, {name} flew softly onward, letting the calm sky show the way.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, drifting like a secret the wind had carefully kept.",
        "Along the soft sky-path, {discovery} appeared quietly, ready to help the journey make sense.",
      ],
      goalPayoffOptions: [
        "Using {discovery} and the gentle guidance of the wind, {name} and {companion} were able to {goal}.",
        "Once {discovery} revealed the sky's quiet meaning, {name} and {companion} knew exactly how to {goal}.",
      ],
      closingMagicOptions: [
        "Before drifting home, {name} received {gift}, and it felt like a little piece of the sky's calm to carry back.",
        "As the flying adventure ended, {gift} stayed with {name} like a soft reminder of wind, moonlight, and wonder.",
      ],
    },
  family: {
      storyShapes: ["helper", "comfort", "discovery"],
      openings: [
        "Home felt especially warm tonight, full of the quiet magic families make without even noticing.",
        "A peaceful glow rested over the house, where every room held a kind little story.",
      ],
      incitingMoments: [
        "A small family problem appeared, gentle enough to solve with patience and love.",
        "Somewhere nearby, a tiny sign suggested someone at home needed a little extra kindness tonight.",
      ],
      helperMoments: [
        "{name} soon realised that the most important part of tonight's adventure was making someone at home feel cared for.",
        "The path ahead was teaching {name} that helping family could feel magical in its own soft way.",
      ],
      revealMoments: [
        "When they found {discovery}, it was a reminder that love can hide in the smallest places.",
        "There, quiet and ready, was {discovery}, carrying exactly the feeling home had been missing.",
      ],
      resolutionMoments: [
        "With gentle thought and a caring heart, {name} helped the whole home feel warmer and brighter.",
        "What had begun as a small family worry soon turned into a calm, happy moment everyone could feel.",
      ],
      quietCelebrations: [
        "The house stayed peaceful, but it felt fuller somehow, with love in every corner.",
        "No one needed to say much. The warm quiet around them already felt like a celebration.",
      ],
      homecomingMoments: [
        "Even the way back through the house felt softer now, with every room more welcoming.",
        "By the time home fully settled again, everything felt close, safe, and wonderfully calm.",
      ],
      gentleActionOptions: [
        "{name} and {companion} moved carefully through the house, noticing the little loving things that mattered most.",
        "With {companion} nearby, {name} followed the quiet signs of home, one gentle step at a time.",
      ],
      discoveryOptions: [
        "Before long, {name} and {companion} found {discovery}, glowing with family love.",
        "At the end of the search, {discovery} waited softly, like a small hidden piece of home itself.",
      ],
    },
  reading: {
      storyShapes: ["discovery", "quest", "comfort"],
      openings: [
        "The reading nook was so quiet that even turning a page felt magical.",
        "Books rested all around {name}, full of stories almost ready to wake.",
      ],
      incitingMoments: [
        "One little page shimmered unexpectedly, inviting {name} to follow the story inside.",
        "A gentle trail of story-whispers drifted from a book nearby, inviting {name} closer.",
      ],
      clueMoments: [
        "Each clue felt like the next sentence of a hidden story, quietly waiting to be read.",
        "The books offered their hints one by one, as if they trusted {name} to understand them.",
      ],
      revealMoments: [
        "There, between quiet pages and lamplight, was {discovery}, like a secret reading just for tonight.",
        "When {name} found {discovery}, it was as though the whole library had softly smiled.",
      ],
      resolutionMoments: [
        "With calm curiosity, {name} understood the story's hidden meaning and made the adventure feel complete.",
        "Once {name} understood what the pages had been trying to say, the book's magic settled warmly back into place.",
      ],
      returnTransitions: [
        "As the last page whispered closed, it was time for {name} to leave the story-world and head back.",
        "When the book's gentle magic had said all it needed to say, {name} knew it was time to return from the pages.",
      ],
      homecomingMoments: [
        "The reading nook felt warmer than before, as though the story had left a little glow behind.",
        "Back beside the rainy window, everything felt cosy, quiet, and gently changed for the better.",
      ],
      gentleActionOptions: [
        "{name} and {companion} moved from clue to clue like careful readers turning the gentlest pages.",
        "Keeping close to {companion}, {name} followed the story-whispers deeper into the quiet reading world.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, glowing like the best kind of bedtime chapter.",
        "At the heart of the story-path, {discovery} appeared, calm and full of wonder.",
      ],
      closingMagicOptions: [
        "Before leaving, {name} received {gift}, a small reminder that stories can stay close even after the book is closed.",
        "As the last page of the adventure turned, {gift} remained with {name} like a bookmark made of magic.",
      ],
    },
  performance: {
      storyShapes: ["helper", "discovery", "quest"],
      openings: [
        "The softly lit stage waited in a quiet hush, as though the curtains already knew something beautiful was about to begin.",
        "Behind the velvet curtains, everything felt calm, golden, and ready for a gentle performance.",
      ],
      incitingMoments: [
        "A tiny chime drifted through the theatre, like a first note asking to be noticed.",
        "Somewhere near the stage, a quiet musical clue shimmered into place.",
      ],
      helperMoments: [
        "Before long, {name} realised tonight's adventure was about helping a beautiful performance find its way into the world.",
        "A calm feeling told {name} that the kindest thing tonight would be helping everyone feel ready for the music to begin.",
      ],
      clueMoments: [
        "Each little sign felt like part of a rehearsal, guiding the next gentle step.",
        "The theatre offered soft clues, as though the stage itself wanted to help.",
      ],
      revealMoments: [
        "There, glowing softly in the wings, was {discovery}, ready to help the performance begin.",
        "When {name} found {discovery}, it felt like the perfect first note had finally arrived.",
      ],
      resolutionMoments: [
        "With calm courage, {name} helped the performance begin in exactly the right way.",
        "What had felt uncertain backstage soon turned into something graceful, welcoming, and beautifully clear.",
      ],
      quietCelebrations: [
        "The theatre felt full of quiet happiness, like a song lingering softly in the air.",
        "No loud applause was needed. The warm hush afterward already felt like a celebration.",
      ],
      homecomingMoments: [
        "The way home felt soft and golden, as though a little music was still walking beside them.",
        "By the time home came near again, the whole evening felt graceful and complete.",
      ],
      gentleActionOptions: [
        "{name} and {companion} moved quietly through the wings, following each gentle clue toward the waiting stage.",
        "Keeping close to {companion}, {name} crossed the quiet theatre with the care of someone carrying a beautiful secret.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, and it felt like the performance's missing beginning.",
        "At the heart of the theatre, {discovery} waited softly, ready to help the evening shine.",
      ],
      closingMagicOptions: [
        "Before leaving, {name} received {gift}, and it felt like a tiny encore made of calm and pride.",
        "As the theatre settled into silence, {gift} stayed with {name}, warm as the memory of a beautiful final note.",
      ],
    },
  travel: {
      storyShapes: ["quest", "discovery", "helper"],
      openings: [
        "The world felt wide and welcoming tonight, full of peaceful paths leading somewhere wonderful.",
        "A quiet sense of journey rested in the air, as though tonight might begin with a single brave step.",
      ],
      incitingMoments: [
        "A small sign appeared that it was time for a gentle journey toward somewhere new.",
        "A silver route unfolded ahead, inviting {name} to travel without hurry.",
      ],
      helperMoments: [
        "It soon became clear that this journey was not only about going somewhere, but helping along the way.",
        "The road ahead called for calm choices, patient steps, and one quiet act of kindness.",
      ],
      revealMoments: [
        "When they reached {discovery}, it felt like the kind of answer a journey hopes to find.",
        "There, at the perfect moment, was {discovery}, turning the whole trip into a happy memory.",
      ],
      resolutionMoments: [
        "By trusting the path and staying gentle, {name} helped the journey become exactly what it needed to be.",
        "What had started as a simple trip soon became a calm, brave adventure with a beautiful ending.",
      ],
      homecomingMoments: [
        "The way back felt different now, full of soft pride and the glow of having gone somewhere new.",
        "Home felt even warmer after the journey, glad to welcome them back.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the route together, noticing all the quiet wonders a journey can hold.",
        "Step by step, {name} travelled onward with {companion}, calm and curious about what lay ahead.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, and it was the journey's kindest reward.",
        "At the end of the route, {discovery} waited softly, as though it had been expecting them all along.",
      ],
    },
  comfort: {
      storyShapes: ["comfort", "discovery", "helper"],
      openings: [
        "Everything around {name} felt quiet, soft, and ready to be understood gently.",
        "The world slowed down tonight, leaving room for calm, comfort, and one small brave feeling.",
      ],
      incitingMoments: [
        "A little feeling stirred in the air, ready to be noticed rather than feared.",
        "A warm light appeared nearby, inviting {name} to follow it toward reassurance.",
      ],
      helperMoments: [
        "It became clear that tonight's adventure was really about helping a worried feeling grow smaller.",
        "The quiet path ahead guided {name} toward comfort, one peaceful step at a time.",
      ],
      revealMoments: [
        "There, glowing softly, was {discovery}, and it felt exactly like the comfort {name} had needed.",
        "When {name} reached {discovery}, the whole night suddenly felt kinder and easier to hold.",
      ],
      resolutionMoments: [
        "With calm breaths and quiet courage, {name} helped everything feel safe and steady again.",
        "The worried feeling did not need to disappear all at once. It simply became smaller, softer, and easier to carry.",
      ],
      quietCelebrations: [
        "The calm that followed felt deep and real, like a soft blanket settling into place.",
        "Nothing sparkled loudly. The comfort itself was already enough.",
      ],
      homecomingMoments: [
        "The way back felt warm and familiar, and the night felt kind all the way.",
        "By the time home came into view again, everything felt steadier than before.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the soft light together, moving slowly enough for every breath to help.",
        "With {companion} close by, {name} took each step calmly, letting the night feel safer and safer.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, and it held a deep, quiet reassurance.",
        "At the end of the path, {discovery} waited gently, like an answer made of calm.",
      ],
      closingMagicOptions: [
        "Before leaving, {name} received {gift}, a little reminder that comfort can stay close even after the adventure ends.",
        "As the night settled, {gift} came with {name}, soft and steady as a promise that everything was okay.",
      ],
    },
  ocean: {
      storyShapes: ["helper", "discovery", "quest"],
      openings: [
        "The sea was calm tonight, glowing softly as though it were holding a secret lullaby.",
        "Moonlight floated across the water in silver ripples, quiet and welcoming.",
      ],
      incitingMoments: [
        "A tiny shimmer beneath the waves suggested that someone in the ocean needed help.",
        "A trail of pearly light appeared in the water, inviting {name} to follow it gently.",
      ],
      clueMoments: [
        "The ocean offered small clues in ripples, shells, and glimmers of silver light.",
        "Each soft current pointed toward something kind waiting below.",
      ],
      revealMoments: [
        "There, beneath the calm glow, was {discovery}, shining like a secret the sea had carefully kept.",
        "When {name} found {discovery}, the whole ocean hummed with peaceful approval.",
      ],
      resolutionMoments: [
        "With gentle care, {name} helped the ocean feel calm, safe, and happily settled again.",
        "What had seemed uncertain beneath the waves soon became clear through patience and kindness.",
      ],
      quietCelebrations: [
        "Tiny waves lapped softly around them, like the ocean's own quiet applause.",
        "The water remained peaceful, but it glowed with a grateful sort of calm.",
      ],
      homecomingMoments: [
        "The journey home drifted as softly as the tide, silver and unhurried.",
        "By the time the shore came close again, the sea felt like an old, gentle friend.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the pearly trail together, moving through the calm water without haste.",
        "Staying close to {companion}, {name} listened to the sea and let its quiet rhythm lead the way.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, gleaming like a treasure of pure calm.",
        "At the end of the watery path, {discovery} rested softly, waiting to be understood.",
      ],
      closingMagicOptions: [
        "Before leaving the shore behind, {name} received {gift}, and it felt full of moonlit sea-magic.",
        "As the tide settled, {gift} stayed with {name} like a small song from the ocean.",
      ],
    },
  magic: {
      storyShapes: ["discovery", "quest", "comfort"],
      openings: [
        "The world was full of soft magic tonight, as though hidden wonders were waking one by one.",
        "A gentle shimmer rested over everything nearby, hinting that an enchanted path was about to appear.",
      ],
      incitingMoments: [
        "A ribbon of quiet magic unfurled ahead, inviting {name} to follow it carefully.",
        "A tiny spell-light appeared nearby, glowing with a kind secret to share.",
      ],
      clueMoments: [
        "The enchanted world offered signs in sparkles, whispers, and gentle glows.",
        "Each little magical hint led toward something beautiful and calm.",
      ],
      revealMoments: [
        "There, gleaming softly, was {discovery}, like a piece of magic saved especially for this moment.",
        "When {name} found {discovery}, the whole enchanted world settled into a happy hush.",
      ],
      resolutionMoments: [
        "With calm wonder and gentle courage, {name} helped the magic become warm, clear, and safe.",
        "What had first felt mysterious soon became the sort of magic that helps everything find its proper place.",
      ],
      quietCelebrations: [
        "The sparkles around them glowed a little brighter, though still soft enough for bedtime.",
        "The enchanted hush that followed felt like magic smiling without making a sound.",
      ],
      homecomingMoments: [
        "The way home shimmered faintly, as though the magic wanted to walk beside them a little longer.",
        "By the time home came close again, the night still felt touched with a quiet enchantment.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the enchanted trail together, moving with the kind of care magic likes best.",
        "Keeping close to {companion}, {name} stepped through the soft glow one calm moment at a time.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, glowing with the gentlest kind of wonder.",
        "At the end of the spell-lit path, {discovery} waited softly, ready to be understood.",
      ],
      closingMagicOptions: [
        "Before leaving, {name} received {gift}, and it felt like a tiny promise that gentle magic was always near.",
        "As the adventure ended, {gift} came home with {name}, soft and bright as a little enchanted memory.",
      ],
    },
  home: {
      storyShapes: ["discovery", "helper", "comfort"],
      openings: [
        "Home felt extra cosy tonight, full of quiet corners where little surprises might be waiting.",
        "The house was calm and golden, as though ordinary things were about to become quietly magical.",
      ],
      incitingMoments: [
        "A tiny sign appeared that tonight's adventure might be hidden somewhere very close to home.",
        "A soft little mystery stirred among the cushions, books, and lamplight nearby.",
      ],
      helperMoments: [
        "It soon became clear that tonight's task was to make something at home feel a little happier and brighter.",
        "The house gently guided {name} toward one small act that would make the whole evening gentler.",
      ],
      revealMoments: [
        "There, tucked safely nearby, was {discovery}, turning the ordinary room into something special.",
        "When {name} found {discovery}, home itself glowed with a quiet smile.",
      ],
      resolutionMoments: [
        "With patient kindness, {name} helped the little home-adventure settle into something warm and lovely.",
        "What began as a simple evening at home soon became a memory full of calm pride.",
      ],
      quietCelebrations: [
        "The room stayed still and cosy, and that peaceful feeling became its own celebration.",
        "Nothing dramatic happened next. Home simply felt softer and happier than before.",
      ],
      homecomingMoments: [
        "The way back was only a few soft steps, but it felt like returning from somewhere magical.",
        "By then, every familiar corner felt even more welcoming than before.",
      ],
      gentleActionOptions: [
        "{name} and {companion} explored the quiet house together, noticing tiny clues hidden in everyday things.",
        "With {companion} nearby, {name} followed the soft signs of adventure from room to room.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, and the whole house felt quietly transformed.",
        "At the end of their little search, {discovery} waited softly among the cosy things of home.",
      ],
    },
  friendship: {
      storyShapes: ["helper", "comfort", "discovery"],
      openings: [
        "The evening felt kind tonight, like the perfect time for a friendship to grow a little stronger.",
        "A soft calm rested over everything, leaving room for gentle words and caring hearts.",
      ],
      incitingMoments: [
        "A small sign appeared that someone nearby might need a friend in a quiet, important way.",
        "Somewhere close, a shy feeling or little misunderstanding was waiting to be gently untangled.",
      ],
      helperMoments: [
        "{name} soon realised that tonight's real adventure was helping someone else feel safe, included, and understood.",
        "The path ahead was leading toward an act of friendship that would matter more than anything else.",
      ],
      revealMoments: [
        "When they found {discovery}, it was exactly the sort of small thing that can bring hearts closer.",
        "There, quiet and ready, was {discovery}, carrying the gentle answer friendship had been asking for.",
      ],
      resolutionMoments: [
        "With kind words and patient listening, {name} helped everything feel easier and warmer again.",
        "What could have stayed awkward or uncertain instead turned into a calm, happy friendship moment.",
      ],
      quietCelebrations: [
        "The happy quiet between them afterward felt strong and real, like friendship settling in properly.",
        "No loud cheer was needed. Feeling understood was already enough to make the evening shine.",
      ],
      homecomingMoments: [
        "The way home felt lighter, as though kindness itself had made each step easier.",
        "By the time the adventure ended, the whole evening felt steadier and sweeter than before.",
      ],
      gentleActionOptions: [
        "{name} and {companion} moved forward together, listening carefully for the little signs of what someone might need.",
        "Keeping close to {companion}, {name} followed the path with a calm heart ready to help.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, a quiet bridge between hearts.",
        "At just the right moment, {discovery} appeared, small but full of the kind of meaning friends remember.",
      ],
    },
  dinosaurs: {
      storyShapes: ["quest", "discovery", "helper"],
      openings: [
        "The dinosaur valley was calm tonight, full of giant shadows, sleepy ferns, and warm ancient light.",
        "Everything in the dino-world felt peaceful, as though even the biggest footsteps knew it was nearly bedtime.",
      ],
      incitingMoments: [
        "A line of gentle dino-tracks appeared nearby, leading toward a small prehistoric mystery.",
        "A warm glow flickered between the ferns, hinting that something important had been lost in the valley.",
      ],
      clueMoments: [
        "Each sign in the valley felt old and important, like the land itself remembered the answer.",
        "The giant ferns and glowing stones pointed the way one clue at a time.",
      ],
      revealMoments: [
        "There, nestled safely nearby, was {discovery}, glowing like a treasure from the oldest bedtime story of all.",
        "When {name} found {discovery}, the whole valley breathed a deep, peaceful sigh.",
      ],
      resolutionMoments: [
        "With calm bravery, {name} helped the dinosaur valley feel settled, safe, and complete again.",
        "What had seemed like a big prehistoric problem soon became manageable through patience and care.",
      ],
      quietCelebrations: [
        "Somewhere in the distance, a happy dinosaur sound echoed softly through the warm night air.",
        "The valley stayed quiet, but everything in it felt more peaceful than before.",
      ],
      homecomingMoments: [
        "The path home wound gently through the ferns, calmer now that the valley's worry had passed.",
        "By the time home came near again, the dino-world felt like a brave little secret to remember.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the old tracks together, stepping carefully through the glowing ferns.",
        "Staying close to {companion}, {name} crossed the quiet valley with gentle courage.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, resting softly in the ancient glow.",
        "At the end of the prehistoric trail, {discovery} appeared like a calm answer from long ago.",
      ],
      closingMagicOptions: [
        "Before leaving the valley, {name} received {gift}, and it felt as special as a treasure from the age of dinosaurs.",
        "As the adventure ended, {gift} came with {name}, warm and quiet like the valley's final thank you.",
      ],
    },
  videogame: {
      storyShapes: ["quest", "discovery", "helper"],
      openings: [
        "The game-world glowed softly tonight, full of calm levels, kind challenges, and sleepy pixel-light.",
        "Everything around {name} looked like a peaceful level waiting to be explored without any rush.",
      ],
      incitingMoments: [
        "A new quest marker blinked gently into view, inviting {name} to begin.",
        "A quiet little signal appeared, showing that the next level held a problem only patience could solve.",
      ],
      clueMoments: [
        "Helpful signs appeared one by one, like the kindest game hints ever placed.",
        "The level unfolded gently, offering each clue at just the right moment.",
      ],
      revealMoments: [
        "There, glowing in the soft pixel-light, was {discovery}, like the perfect reward for a careful player.",
        "When {name} reached {discovery}, it felt like unlocking the happiest secret in the whole game.",
      ],
      resolutionMoments: [
        "With steady thinking and a calm heart, {name} completed the level in exactly the right way.",
        "The game-world brightened softly as {name} solved the challenge with kindness and care.",
      ],
      quietCelebrations: [
        "A gentle victory chime rang through the air, soft enough for bedtime.",
        "The level stayed peaceful, but everything glowed with that quiet feeling of success.",
      ],
      homecomingMoments: [
        "The path back felt like returning from a favourite level that would always be there to visit again.",
        "By the end, the whole game-world felt cosy, completed, and ready to rest.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the level path together, solving each gentle challenge one step at a time.",
        "Keeping close to {companion}, {name} moved through the glowing world like a calm and careful player.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, shining like a peaceful reward at the end of the level.",
        "At the heart of the quest, {discovery} appeared, bright and welcoming in the soft game-light.",
      ],
      closingMagicOptions: [
        "Before the level faded into rest, {name} received {gift}, like a bonus reward full of bedtime calm.",
        "As the quest ended, {gift} stayed with {name}, a little keepsake from the gentlest game-world of all.",
      ],
    },
  pirates: {
      storyShapes: ["quest", "discovery", "helper"],
      openings: [
        "The bay was calm tonight, with moonlight resting quietly on the water like silver treasure.",
        "Everything around the little cove felt peaceful, as though it were waiting for a gentle pirate adventure.",
      ],
      incitingMoments: [
        "A tiny clue appeared near the shore, suggesting that something important had drifted out of place.",
        "A soft gleam on the water hinted that tonight's pirate mission would need calm eyes and a kind heart.",
      ],
      clueMoments: [
        "The sea offered its clues in ripples, shells, and signs only patient adventurers could follow.",
        "Each clue along the shore fit the last one neatly, like a treasure map made for bedtime.",
      ],
      revealMoments: [
        "There, shining softly in the moonlit cove, was {discovery}, like a treasure meant to help rather than to keep.",
        "When {name} found {discovery}, the whole bay settled into a happy hush.",
      ],
      resolutionMoments: [
        "With gentle bravery, {name} helped the little pirate problem come right at last.",
        "What began like a treasure hunt ended as a calm act of kindness beside the sea.",
      ],
      quietCelebrations: [
        "The water lapped softly at the shore, like the bay's own quiet applause.",
        "Nothing roared or crashed. The peaceful sea was simply pleased.",
      ],
      homecomingMoments: [
        "The journey back across the cove felt lighter now, silver and calm under the stars.",
        "By the time home came near again, the bay felt like a gentle secret worth remembering.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the moonlit clues together, careful and steady like the kindest pirate crew.",
        "Keeping close to {companion}, {name} crossed the quiet shore one calm step at a time.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, glowing like a treasure with a kind purpose.",
        "At the end of the moonlit trail, {discovery} waited softly beside the quiet water.",
      ],
      closingMagicOptions: [
        "Before leaving the cove, {name} received {gift}, and it felt like the gentlest pirate treasure of all.",
        "As the adventure ended, {gift} came home with {name}, small and shining like a moonlit keepsake.",
      ],
    },
  dragons: {
      storyShapes: ["quest", "helper", "discovery"],
      openings: [
        "The dragon valley was warm and quiet tonight, full of glowing stones and sleepy mountain light.",
        "Everything around the cave shimmered gently, as though dragon-magic itself were settling down for the night.",
      ],
      incitingMoments: [
        "A tiny ember-glow flickered ahead, hinting that something important had gone missing nearby.",
        "A trail of warm little lights appeared among the rocks, inviting {name} to follow.",
      ],
      clueMoments: [
        "The cave left small signs in warmth, glow, and soft echoes that pointed the way.",
        "Each dragon clue felt ancient and gentle, as though the mountain trusted {name} to notice it.",
      ],
      revealMoments: [
        "There, glowing safely in the warm stone light, was {discovery}, like a secret the dragons had carefully protected.",
        "When {name} found {discovery}, the whole valley hummed with relief.",
      ],
      resolutionMoments: [
        "With steady kindness, {name} helped the dragon-world feel calm, warm, and whole again.",
        "What had seemed like a big magical problem soon softened into something manageable and bright.",
      ],
      quietCelebrations: [
        "Somewhere nearby, a happy dragon sound echoed softly through the cave.",
        "The warm glow around them deepened a little, like dragon-magic quietly saying thank you.",
      ],
      homecomingMoments: [
        "The path home glowed faintly behind them, warm and welcoming all the way.",
        "By the time the cave faded from view, the whole night felt braver and calmer than before.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the ember-trail together, moving carefully through the warm quiet.",
        "With {companion} nearby, {name} crossed the glowing valley with gentle courage.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, shining softly in the dragon-stone glow.",
        "At the end of the warm little trail, {discovery} rested quietly, ready to be returned.",
      ],
      closingMagicOptions: [
        "Before leaving, {name} received {gift}, and it felt warm as a tiny dragon promise.",
        "As the adventure ended, {gift} stayed with {name}, glowing softly like a friendly ember.",
      ],
    },
  robots: {
      storyShapes: ["helper", "discovery", "quest"],
      openings: [
        "The robot garden was peaceful tonight, full of tiny lights blinking in a calm and sleepy rhythm.",
        "Everything in the workshop glowed softly, as though the machines themselves were getting ready for bed.",
      ],
      incitingMoments: [
        "A small signal blinked nearby, showing that one gentle problem needed fixing.",
        "A quiet little beep suggested that someone in the robot-world needed patient help.",
      ],
      clueMoments: [
        "Helpful clues appeared in lights, patterns, and tiny mechanical sounds.",
        "Each soft blink guided {name} one careful step closer to the answer.",
      ],
      revealMoments: [
        "There, glowing neatly in the quiet workshop, was {discovery}, like the perfect piece of a bedtime puzzle.",
        "When {name} found {discovery}, the little machines around them brightened with relief.",
      ],
      resolutionMoments: [
        "With calm thinking and gentle hands, {name} helped the robot-world hum happily again.",
        "The small machine problem soon turned into a peaceful success, solved step by careful step.",
      ],
      quietCelebrations: [
        "A soft happy chime drifted through the workshop, quiet enough for bedtime.",
        "The tiny lights blinked in a steadier rhythm, and that peaceful pattern felt like celebration enough.",
      ],
      homecomingMoments: [
        "The path home glimmered with little lights, calm and tidy all the way.",
        "By the time the workshop grew distant, the whole night felt orderly, safe, and complete.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the blinking clues together, solving each little step with patience.",
        "Keeping close to {companion}, {name} moved through the robot-world with a calm and curious mind.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, shining like the exact answer the workshop had needed.",
        "At the heart of the little machine mystery, {discovery} waited quietly beneath the soft lights.",
      ],
      closingMagicOptions: [
        "Before leaving, {name} received {gift}, like a tiny reward from the kindest robot garden of all.",
        "As the signals settled, {gift} stayed with {name}, soft and bright like a bedtime star made of light.",
      ],
    },
  trains: {
      storyShapes: ["quest", "helper", "discovery"],
      openings: [
        "The little station was quiet tonight, glowing with lantern light and sleepy railway magic.",
        "Everything along the moonlit tracks felt calm, as though the last journey of the night was about to begin.",
      ],
      incitingMoments: [
        "A gentle whistle sounded nearby, hinting that one last railway problem needed solving before sleep.",
        "A silver glimmer along the tracks suggested that something important was waiting farther ahead.",
      ],
      clueMoments: [
        "The railway left its clues in lantern glows, track-signs, and quiet little sounds.",
        "Each new sign along the line guided {name} forward with patient certainty.",
      ],
      revealMoments: [
        "There, waiting softly by the lantern-lit tracks, was {discovery}, like the perfect answer to the night's journey.",
        "When {name} found {discovery}, the whole station breathed out happily.",
      ],
      resolutionMoments: [
        "With steady care, {name} helped the railway feel safe, calm, and ready for rest again.",
        "What had seemed uncertain along the tracks soon became clear through patience and gentle courage.",
      ],
      quietCelebrations: [
        "A soft whistle drifted through the night like a quiet little thank you.",
        "The station stayed still, but everything in it felt warmly satisfied.",
      ],
      homecomingMoments: [
        "The way home followed the tracks through a calm silver night, easy and sure.",
        "By the time the station was behind them, the whole journey felt like a gentle bedtime memory.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the lantern-lit line together, careful not to miss any quiet signs.",
        "With {companion} nearby, {name} moved along the moonlit railway one calm step at a time.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, shining softly beside the peaceful tracks.",
        "At the end of the night's railway clue-trail, {discovery} waited calmly beneath the lantern glow.",
      ],
      closingMagicOptions: [
        "Before the last journey ended, {name} received {gift}, as gentle and special as a golden ticket home.",
        "As the railway settled for sleep, {gift} stayed with {name}, carrying a little of the station's warm glow.",
      ],
    },
  fairies: {
      storyShapes: ["discovery", "helper", "comfort"],
      openings: [
        "The fairy glade shimmered softly tonight, full of petals, lantern light, and sleepy little wings.",
        "Everything in the hidden meadow felt delicate and calm, as though the fairies themselves were whispering goodnight.",
      ],
      incitingMoments: [
        "A tiny fairy-light flickered nearby, hinting that one little problem needed a kind solution.",
        "A drifting sparkle-path appeared among the flowers, inviting {name} to follow gently.",
      ],
      clueMoments: [
        "The glade offered its clues in petals, sparkles, and the softest little sounds.",
        "Each fairy hint was tiny and beautiful, but together they pointed clearly onward.",
      ],
      revealMoments: [
        "There, glowing softly among the flowers, was {discovery}, like a fairy secret waiting to be understood.",
        "When {name} found {discovery}, the whole glade brightened with relief.",
      ],
      resolutionMoments: [
        "With gentle care, {name} helped the fairy-world return to its calm and sparkling rhythm.",
        "What had begun as a tiny magical worry soon became something warm, simple, and right again.",
      ],
      quietCelebrations: [
        "Tiny lanterns glowed a little brighter, though still softly enough for bedtime.",
        "The glade stayed quiet, but the air around them felt full of grateful fairy magic.",
      ],
      homecomingMoments: [
        "The way home drifted beneath petals and starlight, soft and dreamlike all the way.",
        "By the time the meadow faded behind them, the night still felt lightly dusted with sparkle.",
      ],
      gentleActionOptions: [
        "{name} and {companion} followed the sparkle-path together, stepping lightly through the glowing meadow.",
        "Keeping close to {companion}, {name} moved gently through the fairy glade without disturbing its calm.",
      ],
      discoveryOptions: [
        "Soon, {name} and {companion} found {discovery}, glowing like the gentlest fairy treasure of all.",
        "At the end of the petal-lit trail, {discovery} rested quietly in the soft fairy glow.",
      ],
      closingMagicOptions: [
        "Before leaving the glade, {name} received {gift}, light as a petal and full of quiet magic.",
        "As the fairy lights dimmed for bed, {gift} stayed with {name}, a tiny shimmer to remember the night by.",
      ],
    },
};

// Pronoun-aware fragments. Placeholders: {name}, {subj}, {obj}, {poss}, {Subj}
// resolved per child gender in generateQuickStory.
const magicGifts = [
  "a tiny star charm that glowed with brave little light",
  "a ribbon of moonlight wrapped in calm",
  "a silver leaf that shimmered with gentle magic",
  "a little lantern that glowed with peaceful light",
  "a whispering shell that sang the softest lullaby",
];

const returnTransitions = [
  "When the adventure had settled into a peaceful hush, it was time to head home.",
  "As the stars drifted higher, {pair} knew it was time to return.",
  "After a while, the night gently reminded {pair} it was time to go back.",
  "With happy hearts, {pair} turned toward home under the quiet sky.",
  "Soon, the path home appeared, calm and clear in the moonlight.",
];

const sleepEndings = [
  "{name} climbed into bed feeling safe, proud, and deeply calm.",
  "{name} curled up comfortably, carrying the adventure like a warm secret.",
  "{name} settled beneath the blankets, peaceful and ready to rest.",
  "{name} snuggled in, heart light and mind full of gentle wonder.",
  "A soft smile stayed on {name}'s face as bedtime settled gently in.",
];

// Age-appropriate interest pools (replaces the undefined dreamInterests)
// Age-banded interest pools matching developmental stages:
// 2–3: gentle, ethereal, sensory (stars, moon, fairies, cuddles)
// 3–6: familiar, tangible (animals, toys, small adventures)
// 6–12: dynamic, aspirational (flying, exploring, friendship, heroes)
const interestsByAge = {
  toddlers: [
    "stars", "the moon", "fairies", "cuddly animals", "teddy bears",
    "soft lullabies", "sleepy clouds", "gentle magic", "bedtime cuddles",
    "moon and stars", "twinkling lights", "baby animals",
  ],
  young: [
    "friendly animals", "toy adventures", "dinosaurs", "farm friends",
    "unicorns", "princesses", "dragons", "talking animals", "bedtime friends",
    "little heroes", "rainbows", "magic woods", "cosy treehouses",
  ],
  older: [
    "flying adventures", "exploring new worlds", "friendship quests",
    "space missions", "underwater worlds", "mysteries", "brave heroes",
    "hidden maps", "secret powers", "time travel", "mountain journeys",
    "ancient forests",
  ],
};

const themeWorlds = {
  dinosaurs: {
    settings: ["a gentle dinosaur valley", "a fern-filled meadow beside a warm volcano glow"],
    companions: ["a kind little triceratops", "a sleepy baby brontosaurus"],
    discoveries: ["a nest of glowing dino-eggs", "a tiny fossil map made of moonstone"],
    challenge: "a winding trail through tall ferns",
    goal: "find the missing moonstone egg",
    pronoun: "they",
  },
  princesses: {
    settings: ["a quiet castle garden", "a moonlit palace courtyard"],
    companions: ["a gentle royal pony", "a kind palace kitten"],
    discoveries: [
      {
        text: "a silver crown charm",
        discoveryEffect: "its soft shimmer pointed up the staircase toward the princess tower",
        payoffTemplates: [
          "The shimmer from {discovery} showed {name} and {companion} the right staircase, and soon they were able to {goal}.",
          "With {discovery} guiding them through the quiet palace, {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a hidden story balcony",
        discoveryEffect: "from there, they could see the ribbon caught beside the tower window",
        payoffTemplates: [
          "From {discovery}, {name} and {companion} spotted exactly where to go, and together they were able to {goal}.",
          "{discovery} gave them the perfect view of the tower path, and soon {name} and {companion} were able to {goal}.",
        ],
      },
    ],
    challenge: "a long hallway of whispering curtains",
    goal: "return a lost ribbon to the princess tower",
    pronoun: "she",
  },
  space: {
    settings: ["a calm star harbour", "a soft-glowing moon station"],
    companions: ["a friendly comet sprite with a silver tail", "a tiny starlight robot"],
    discoveries: ["a map of sleepy constellations", "a lantern made of moon dust"],
    challenge: "a floating path of quiet asteroids",
    goal: "deliver a lullaby light to a sleepy planet",
    pronoun: "they",
  },
  flying: {
    settings: [
      "a warm twilight sky above golden dunes where sleepy camels wandered below",
      "a moonlit sky above the ocean where dolphins leapt and whales sang softly below",
      "a calm silver-blue sky above snowy mountains where quiet eagles glided on the wind",
      "a peaceful evening sky above a jungle canopy where parrots tucked themselves in for the night",
      "a soft cloud path above green fields where sheep and little horses looked tiny below",
    ],
    companions: [
      "a gentle little cloud bird",
      "a friendly moon-kite with a silver tail",
      "a calm starling guide who knew the wind paths",
    ],
    discoveries: [
      "a glowing feather-map that shimmered in the air",
      "a ribbon of wind curling toward the gentlest way forward",
      "a tiny sky-lantern that brightened whenever the route felt right",
    ],
    challenge: [
      "a drifting ribbon of cloud that needed careful steering",
      "a swirl of evening wind above the quiet world below",
      "a long curve of sky where the way forward was hidden behind silver clouds",
    ],
    goal: [
      "follow the wind to a moonlit oasis before the camels settled to sleep",
      "glide above the waves and help a little whale find its family song",
      "follow the sky path until the parrots' treetop lanterns glowed below",
      "carry a gentle star-message across the mountains before the last light faded",
      "circle over the fields and find the glowing place where the night breeze wanted them to land",
    ],
    pronoun: "they",
  },
  school: {
    settings: ["a gentle school glowing in the morning light", "a quiet classroom filled with colourful drawings"],
    companions: ["a friendly classroom teddy", "a cheerful robin from the playground fence"],
    discoveries: ["a gold-star note tucked into a storybook", "a tiny paper airplane carrying a brave message"],
    challenge: "a tall classroom door that felt bigger than usual",
    goal: "find the courage to enjoy the first day at school",
    pronoun: "they",
  },
  family: {
    settings: ["a cosy family home filled with warm lamplight", "a peaceful house where everyone moved softly and kindly"],
    companions: ["a gentle sibling helper", "a kind little robin watching from the window"],
    discoveries: ["a note full of loving words", "a tiny heart-shaped keepsake tucked beneath a cushion"],
    challenge: "a wobbly pile of cushions blocking the hallway",
    goal: "make family life feel warm, kind, and special",
    pronoun: "they",
  },
  home: {
    settings: ["a snug home on a rainy afternoon", "a warm living room glowing with soft golden light"],
    companions: ["a sleepy house-cat", "a friendly patchwork teddy"],
    discoveries: ["a blanket fort hiding a small surprise", "a tiny trail of clues between bookshelves and pillows"],
    challenge: "a narrow gap between the bookshelf and the wardrobe",
    goal: "find gentle magic in a simple day indoors",
    pronoun: "they",
  },
  reading: {
    settings: ["a quiet reading nook beside a rainy window", "a tiny library glowing with bedtime lanterns"],
    companions: ["a wise little book owl", "a soft library mouse with a tiny satchel"],
    discoveries: ["a storybook that shimmered when opened", "a page that led to a hidden reading world"],
    challenge: "a dusty staircase spiralling up through the shelves",
    goal: "discover the magic hidden inside a favourite book",
    pronoun: "they",
  },
  sweets: {
    settings: ["a cosy lane of sweet shops under the stars", "a glowing kitchen where treats cooled on silver trays"],
    companions: ["a cheerful cupcake friend", "a kind biscuit fox in a tiny apron"],
    discoveries: ["a jar of sprinkles made of moonlight", "a recipe card written in sparkling icing"],
    challenge: "a sticky caramel bridge over a stream of warm chocolate",
    goal: "create a treat that makes everyone smile",
    pronoun: "they",
  },
  mystery: {
    settings: ["a quiet garden full of secret corners", "a moonlit hallway lined with gentle clues"],
    companions: ["a careful clue-finding mouse", "a tiny lantern fox with bright eyes"],
    discoveries: ["a silver key hidden in a flowerpot", "a little door tucked behind ivy and moonlight"],
    challenge: "a locked garden gate wrapped in silver ivy",
    goal: "find the missing clue and open the secret place",
    pronoun: "they",
  },
  performance: {
    settings: ["a softly lit stage waiting behind velvet curtains", "a warm hall where music drifted like stardust"],
    companions: ["a gentle songbird conductor", "a little stage mouse in shining shoes"],
    discoveries: ["a spotlight that glowed like a moonbeam", "a music box holding the perfect first note"],
    challenge: "a heavy velvet curtain that needed both hands to part",
    goal: "share a beautiful performance with friends and family",
    pronoun: "they",
  },
  travel: {
    settings: ["a moonlit station where every path led somewhere new", "a sky harbour filled with quiet vehicles ready for adventure"],
    companions: ["a cheerful travel pup", "a tiny guide with a silver map"],
    discoveries: [
      {
        text: "a ticket that shimmered with possibility",
        discoveryEffect: "on the back, a tiny return route glowed softly for the journey home",
        payoffTemplates: [
          "{discovery} showed {name} and {companion} both the adventure path and the safe way back, so they were able to {goal}.",
          "Once {name} noticed the glowing route on {discovery}, {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a route map to a wonderful new place",
        discoveryEffect: "its silver lines made the homeward path feel calm and easy to follow",
        payoffTemplates: [
          "Using {discovery}, {name} and {companion} enjoyed the special trip and were able to {goal}.",
          "{discovery} kept the journey gentle from beginning to end, and soon {name} and {companion} were able to {goal}.",
        ],
      },
    ],
    challenge: "a crossroads where three glowing signs pointed different ways",
    goal: "take a special trip and return home with a happy memory",
    pronoun: "they",
  },
  toys: {
    settings: ["a toyroom where everything glowed softly after dark", "a playroom full of tiny worlds waiting to wake"],
    companions: ["a brave toy robot", "a cuddly teddy explorer"],
    discoveries: ["a tiny hidden world inside a toy box", "a miniature key that unlocked a playtime kingdom"],
    challenge: "a tower of stacked toy boxes that wobbled gently",
    goal: "build or discover a magical toy world before sleep",
    pronoun: "they",
  },
  feelings: {
    settings: ["a peaceful meadow where feelings glowed like lanterns", "a calm riverbank where brave thoughts floated by like stars"],
    companions: ["a kind comfort fox", "a patient little firefly guide"],
    discoveries: ["a pebble that glowed when held with courage", "a tiny lantern that brightened with kindness"],
    challenge: "a foggy clearing where the path faded from view",
    goal: "learn how to feel brave, kind, and proud",
    pronoun: "they",
  },
  weather: {
    settings: ["a gentle world of silver rain and soft puddles", "a cosy window seat where storms glowed safely outside"],
    companions: ["a cheerful raincoat robin", "a tiny cloud friend with a warm smile"],
    discoveries: ["a rainbow ribbon hidden in the mist", "a snowflake lantern that glowed like a star"],
    challenge: "a puddle-covered path with stepping stones half hidden by mist",
    goal: "find the quiet magic hidden in the day's changing sky",
    pronoun: "they",
  },
  places: {
    settings: ["a hidden island ringed with glowing shells", "a floating city drifting above soft white clouds"],
    companions: ["a little map fox", "a patient mountain goat guide"],
    discoveries: ["a secret garden gate wrapped in moonlit ivy", "a glowing cave full of gentle echoes"],
    challenge: "a rocky ridge with a narrow path carved into the cliff",
    goal: "discover a hidden place and bring its magic home",
    pronoun: "they",
  },
  time: {
    settings: ["a quiet clocktower where time moved softly", "a silver path between yesterday and tomorrow"],
    companions: ["a tiny talking clock", "a kind future firefly carrying a glowing schedule"],
    discoveries: ["a frozen moment shining like glass", "a note from tomorrow folded into a paper star"],
    challenge: "a corridor of ticking clocks where the hands spun backwards",
    goal: "put time back into a calm and happy rhythm",
    pronoun: "they",
  },
  roleplay: {
    settings: ["a little town where every kind job felt magical", "a cosy village full of gentle helpers and happy work"],
    companions: ["a cheerful helper pup", "a tiny badge-wearing mouse"],
    discoveries: ["a hat box filled with important roles", "a little shop bell that chimed with possibility"],
    challenge: "a little bridge with a gate that only opened when asked kindly",
    goal: "spend a day being exactly who the adventure needs",
    pronoun: "they",
  },
  cozy: {
    settings: ["a magical bedroom glowing under the blankets", "a blanket fort full of pillows, lanterns, and sleepy secrets"],
    companions: ["a cuddly bedtime bear", "a toy rabbit who woke when the room grew quiet"],
    discoveries: ["a hidden nook behind the bookshelf", "a dream door tucked beneath the covers"],
    challenge: "a tunnel of draped blankets leading somewhere soft and hidden",
    goal: "find the surprise waiting in the cosiest corner of home",
    pronoun: "they",
  },
  surprises: {
    settings: ["a moonlit hallway where surprises waited behind every door", "a cosy room lit by a single shining star"],
    companions: ["a ribbon-tailed gift mouse", "a tiny bird carrying a folded star-note"],
    discoveries: ["a mysterious box tied with silver thread", "a magical letter that glowed in warm colours"],
    challenge: "a ribbon-wrapped box balanced on a narrow shelf",
    goal: "find the special message or gift meant just for them",
    pronoun: "they",
  },
  friendship: {
    settings: ["a gentle playground at golden dusk", "a peaceful path where new friends often met"],
    companions: ["a shy little bunny", "a cheerful friend with kind eyes"],
    discoveries: ["a shared note full of caring words", "a friendship token shaped like a tiny moon"],
    challenge: "a quiet bench where someone small was sitting alone",
    goal: "make a friendship stronger through kindness and teamwork",
    pronoun: "they",
  },
  problemsolving: {
    settings: ["a calm trail scattered with helpful clues", "a little workshop where every puzzle had a gentle answer"],
    companions: ["a careful clue mouse", "a steady lantern hedgehog"],
    discoveries: ["a missing piece hidden beneath a leaf", "a tiny path-marker pointing the right way home"],
    challenge: "a tangled rope bridge swaying over a mossy stream",
    goal: "fix what is wrong and help everything feel right again",
    pronoun: "they",
  },
  creativity: {
    settings: ["a bright studio where colours floated in the air", "a music room where drawings and songs came alive"],
    companions: ["a paint-splashed fox", "a tiny songbird with a pencil behind one wing"],
    discoveries: ["a picture that shimmered when coloured in", "a melody that built a whole new world"],
    challenge: "a blank canvas that shimmered, waiting for a first brushstroke",
    goal: "make something magical and share it with others",
    pronoun: "they",
  },
  dreams: {
    settings: ["a quiet dreamland made of clouds and glowing lights", "a soft sky where stars felt close enough to touch"],
    companions: ["a drifting cloud kitten", "a calm little star scout"],
    discoveries: ["a path of colour across the night sky", "a dream lantern glowing with sleepy gold"],
    challenge: "a floating staircase of soft clouds drifting apart",
    goal: "explore a peaceful dream world and return feeling safe",
    pronoun: "they",
  },
  whimsy: {
    settings: ["a funfair at night lit by bouncing lights", "a silly upside-down forest where everything giggled softly"],
    companions: ["a laughing little monkey", "a springy toy elephant"],
    discoveries: ["a circus ticket made of moonlight", "a world of giant toys hidden behind a striped tent"],
    challenge: "a wobbly funhouse mirror maze that giggled at every turn",
    goal: "bring calm and smiles to the silliest place of all",
    pronoun: "they",
  },
  everyday: {
    settings: ["a quiet path where tiny wonders glimmered in the grass", "a gentle garden where ordinary things felt full of hidden magic"],
    companions: ["a curious butterfly", "a tiny ant builder with careful steps"],
    discoveries: ["a shiny pebble glowing softly in the dusk", "a small sparkling treasure that felt important somehow"],
    challenge: "a patch of tall grass where tiny glowing things flickered",
    goal: "discover how something small can make the whole evening feel special",
    pronoun: "they",
  },
  perspective: {
    settings: ["a moonlit world where gentle what-if magic came alive", "a silver night where reflections, stars, and shadows felt quietly friendly"],
    companions: ["a shadow friend with a soft wave", "a moonlit friend who answered kind questions"],
    discoveries: ["a reflection that smiled back from a still pond", "a whisper from the moon carried on calm night air"],
    challenge: "a still pond whose reflection showed a different sky",
    goal: "explore a magical what-if and return home feeling watched over",
    pronoun: "they",
  },
  comfort: {
    settings: ["a warm quiet place filled with soft lantern light", "a hidden nook where every sound felt calm and safe"],
    companions: ["a gentle comfort rabbit", "a tiny night-light fox"],
    discoveries: ["a calm glow waiting in the dark", "a little place where missing someone turned into feeling close again"],
    challenge: "a dark hollow beneath an old tree that hummed softly",
    goal: "find reassurance, comfort, and the feeling that everything is okay",
    pronoun: "they",
  },
  achievement: {
    settings: ["a cheerful little path of firsts and brave tries", "a calm practice place where small wins glowed like stars"],
    companions: ["a patient coach mouse", "a proud little otter who loved trying again"],
    discoveries: ["a ribbon of effort that shimmered warmly", "a tiny medal that glowed for brave attempts"],
    challenge: "a steep little hill with smooth stones for steps",
    goal: "finish something important and feel proud of the effort",
    pronoun: "they",
  },
  objects: {
    settings: ["a quiet room where special objects held secret magic", "a moonlit path marked by tiny glowing treasures"],
    companions: ["a key-keeping sparrow", "a little lantern mouse with steady paws"],
    discoveries: ["a magical key tucked beneath a cushion", "a compass that pointed gently toward kindness"],
    challenge: "a glass cabinet with a glowing keyhole and no key in sight",
    goal: "discover the secret kindness hidden inside a magical object",
    pronoun: "they",
  },
  bedtime: {
    settings: ["a cosy home where the lights were dimming one by one", "a sleepy evening path leading gently back to bed"],
    companions: ["a soft pajama bear", "a little night-light star floating nearby"],
    discoveries: ["a dream just beginning behind closed curtains", "a goodnight trail leading safely home"],
    challenge: "a winding staircase of warm light leading gently upward",
    goal: "say goodnight, settle safely, and drift into sleep",
    pronoun: "they",
  },
  magic: {
    settings: ["a glowing forest clearing", "a gentle meadow of floating lights"],
    companions: ["a tiny owl wizard", "a kind cloud friend"],
    discoveries: ["a whispering spellbook", "a ribbon of calm starlight"],
    challenge: "a misty path that changes shape",
    goal: "find the lost bedtime charm",
    pronoun: "they",
  },
  animals: {
    settings: ["a peaceful woodland", "a quiet meadow by a stream"],
    companions: ["a soft little bunny", "a kind fox friend"],
    discoveries: [
      {
        text: "a hidden acorn library",
        discoveryEffect: "inside, a tiny map of branch-paths showed the safe way back to the nest",
        payoffTemplates: [
          "Inside {discovery}, {name} and {companion} found the branch-path they needed, and soon they were able to {goal}.",
          "The little map hidden in {discovery} showed {name} and {companion} the safe way onward, and together they were able to {goal}.",
        ],
      },
      {
        text: "a nest of glowing feathers",
        discoveryEffect: "their soft shine marked the safe way through the trees",
        payoffTemplates: [
          "Following the soft glow of {discovery}, {name} and {companion} were able to {goal}.",
          "{discovery} lit the gentle way ahead, and soon {name} and {companion} were able to {goal}.",
        ],
      },
    ],
    challenge: "a narrow log over a stream",
    goal: "help a baby bird find its way home",
    pronoun: "they",
  },
  superheroes: {
    settings: [
      "a quiet city under stars",
      "a rooftop garden above sleepy streets",
      "a sleepy town where small acts of kindness glowed like lanterns",
      "a moonlit school where secret heroes helped behind the scenes",
      "a silver dream-sky where star-powered helpers watched over the night",
      "a calm seaside town where gentle heroes guided everyone safely home",
    ],
    companions: [
      "a helpful sidekick pup",
      "a tiny caped bird",
      "a flying bunny hero with soft silver ears",
      "a panda hero with gentle strength",
      "a night-watch cat with glowing paws",
      "a dolphin hero who carried moonlight through the waves",
    ],
    discoveries: [
      "a gentle hero badge",
      "a glowing city map",
      "a kindness-powered cape stitched with tiny stars",
      "a moonlight lantern that chased worries away",
      "a pocket compass that pointed toward lost things",
      "a dream shield made of warm, glowing light",
      "a bundle of sparkles that turned fear into courage",
    ],
    challenge: [
      "a breezy bridge between rooftops",
      "a quiet street where something important had gone missing",
      "a dark little corner that needed warm glowing light",
      "a school hallway where someone felt too shy to join in",
      "a moonlit path where a lost pet needed help finding home",
      "a sleepy neighbourhood waiting for someone to fix one small problem",
      "a drifting cloud path above town where a worried dream had lost its way",
    ],
    goal: [
      "deliver a comfort note to a worried friend",
      "help someone feel brave enough to take the next gentle step",
      "bring light to a dark place and make it feel safe again",
      "help a lost thing find its way home",
      "guide animals and friends safely through a small problem",
      "spread kindness through the town like quiet superhero magic",
      "protect peaceful sleep and keep bedtime calm",
      "help friends work together so everyone feels included",
      "discover that kindness is the strongest power of all",
    ],
    pronoun: "they",
  },
  pirates: {
    settings: ["a calm moonlit bay", "a quiet island cove"],
    companions: ["a friendly parrot", "a small sea turtle"],
    discoveries: [
      {
        text: "a silver compass charm",
        discoveryEffect: "its little arrow pointed back toward the quiet shore",
        payoffTemplates: [
          "The tiny arrow on {discovery} showed {name} and {companion} which way to go, and soon they were able to {goal}.",
          "With {discovery} guiding them across the moonlit bay, {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a tiny treasure chest of stories",
        discoveryEffect: "inside was a little island sketch showing where the shell belonged",
        payoffTemplates: [
          "Inside {discovery}, {name} and {companion} found the shoreline clue they needed, and together they were able to {goal}.",
          "{discovery} held the perfect clue about the quiet shore, and soon {name} and {companion} were able to {goal}.",
        ],
      },
    ],
    challenge: "a wobbly wooden pier",
    goal: "return a lost shell to the shore",
    pronoun: "they",
  },
  jungle: {
    settings: ["a warm jungle clearing", "a moonlit jungle riverbank"],
    companions: ["a gentle monkey", "a sleepy toucan"],
    discoveries: ["a glowing jungle flower", "a hidden waterfall cave"],
    challenge: "a hanging-vine bridge",
    goal: "find a missing firefly lantern",
    pronoun: "they",
  },
  ocean: {
    settings: ["a quiet coral reef", "a calm bay beneath the moon"],
    companions: ["a kind little dolphin", "a friendly seahorse"],
    discoveries: [
      {
        text: "a pearl that hums softly",
        discoveryEffect: "its gentle song called toward the quiet reef like a safe underwater bell",
        payoffTemplates: [
          "The sleepy song inside {discovery} showed {name} and {companion} the way, and soon they were able to {goal}.",
          "Listening carefully to {discovery}, {name} and {companion} followed its gentle call and were able to {goal}.",
        ],
      },
      {
        text: "a shell with a bedtime song",
        discoveryEffect: "its quiet tune drifted through the water and pointed the way home",
        payoffTemplates: [
          "With the bedtime song from {discovery} leading them on, {name} and {companion} were able to {goal}.",
          "{discovery} sang so softly through the water that {name} and {companion} soon knew how to {goal}.",
        ],
      },
    ],
    challenge: "a swaying seaweed maze",
    goal: "guide a tiny fish back to its reef",
    pronoun: "they",
  },
  farm: {
    settings: ["a peaceful farm at dusk", "a moonlit barnyard"],
    companions: ["a cuddly lamb", "a gentle pony"],
    discoveries: ["a lantern in the hayloft", "a basket of glowing apples"],
    challenge: "a muddy path near the pond",
    goal: "find the farmer's missing bedtime bell",
    pronoun: "they",
  },
  zoo: {
    settings: ["a quiet zoo garden", "a moonlit animal path"],
    companions: ["a calm baby panda", "a kind little penguin"],
    discoveries: [
      {
        text: "a map of animal homes",
        discoveryEffect: "the softly drawn paths showed exactly which turning led to the little den",
        payoffTemplates: [
          "Using {discovery}, {name} and {companion} followed the right moonlit path and were able to {goal}.",
          "{discovery} showed the right turning through the zoo paths, and soon {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a glowing keeper key",
        discoveryEffect: "its warm little light showed the den gate waiting nearby",
        payoffTemplates: [
          "The glow from {discovery} led {name} and {companion} to the right little gate, and together they were able to {goal}.",
          "With {discovery} lighting the way, {name} and {companion} soon knew how to {goal}.",
        ],
      },
    ],
    challenge: "a long path between habitats",
    goal: "help a sleepy cub back to its den",
    pronoun: "they",
  },
  dragons: {
    settings: ["a soft mountain cave", "a glowing valley of dragon stones"],
    companions: ["a tiny friendly dragon", "a sleepy dragon hatchling"],
    discoveries: [
      {
        text: "a warm ember crystal",
        discoveryEffect: "its cosy glow pointed toward the nest path through the mist",
        payoffTemplates: [
          "The warm light inside {discovery} showed {name} and {companion} the nest way, and soon they were able to {goal}.",
          "Holding {discovery} carefully, {name} and {companion} followed its glow and were able to {goal}.",
        ],
      },
      {
        text: "a hidden dragon lullaby scroll",
        discoveryEffect: "the sleepy song on it drew a gentle line of echoes back toward the nest",
        payoffTemplates: [
          "Following the lullaby from {discovery}, {name} and {companion} found the safe way onward and were able to {goal}.",
          "{discovery} filled the cave with a guiding dragon song, and soon {name} and {companion} were able to {goal}.",
        ],
      },
    ],
    challenge: "a misty mountain trail",
    goal: "return a lost ember to the nest",
    pronoun: "they",
  },
  cars: {
    settings: ["a calm town road at night", "a quiet moonlit raceway"],
    companions: ["a cheerful little tow truck", "a kind mini car"],
    discoveries: [
      {
        text: "a glowing road marker",
        discoveryEffect: "its soft light pointed along the safest bends toward home",
        payoffTemplates: [
          "The glow of {discovery} showed {name} and {companion} which road to follow, and soon they were able to {goal}.",
          "With {discovery} lighting the right turns ahead, {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a map to the cosy garage",
        discoveryEffect: "the little route on it made the way home beautifully clear",
        payoffTemplates: [
          "Using {discovery}, {name} and {companion} followed the quiet route and were able to {goal}.",
          "At last, {name} saw how {discovery} could lead them safely onward, and together they were able to {goal}.",
        ],
      },
    ],
    challenge: "a winding hill road",
    goal: "help a little car find the way home",
    pronoun: "they",
  },
  robots: {
    settings: ["a peaceful robot garden", "a quiet starlit workshop"],
    companions: ["a tiny helper bot", "a friendly repair drone"],
    discoveries: ["a softly glowing circuit", "a lullaby memory chip"],
    challenge: "a corridor of blinking lights",
    goal: "restore a sleepy robot's night-light",
    pronoun: "they",
  },
  fairies: {
    settings: ["a moonlit fairy glade sparkling with petals", "a hidden meadow where fairy lanterns drifted in the air"],
    companions: ["a tiny fairy with silver wings", "a gentle flower sprite"],
    discoveries: ["a dewdrop lantern that hummed a lullaby", "a tiny petal-woven blanket"],
    challenge: "a ring of tall whispering grass",
    goal: "light the last bedtime lantern in the fairy glade",
    pronoun: "they",
  },
  unicorns: {
    settings: ["a quiet meadow glowing beneath a soft rainbow", "a hilltop where unicorns rested under gentle stars"],
    companions: ["a small unicorn with a pearly mane", "a baby unicorn whose horn shimmered softly"],
    discoveries: [
      {
        text: "a silver hoofprint charm",
        discoveryEffect: "it stamped a shining trail across the meadow toward the rainbow path",
        payoffTemplates: [
          "The shining trail from {discovery} showed {name} and {companion} where to go, and soon they were able to {goal}.",
          "Following the soft hoofprints from {discovery}, {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a tiny rainbow tucked inside a cloud",
        discoveryEffect: "its colours stretched into the very trail they had been hoping to find",
        payoffTemplates: [
          "When {discovery} unfurled its colours, {name} and {companion} saw the rainbow trail at last and were able to {goal}.",
          "{discovery} painted the missing path ahead, and soon {name} and {companion} were able to {goal}.",
        ],
      },
    ],
    challenge: "a stream of sparkling water to cross",
    goal: "help a baby unicorn find its rainbow trail",
    pronoun: "they",
  },
  mermaids: {
    settings: ["a calm lagoon under a pearl moon", "a glowing coral bay beneath gentle waves"],
    companions: ["a kind little mermaid", "a friendly seahorse"],
    discoveries: [
      {
        text: "a singing conch shell",
        discoveryEffect: "its gentle song drifted toward the part of the lagoon where the lost pearl belonged",
        payoffTemplates: [
          "Listening to {discovery}, {name} and {companion} followed its soft song and were able to {goal}.",
          "The quiet music from {discovery} guided them through the lagoon, and soon {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a pearl that glowed like a lullaby",
        discoveryEffect: "its light showed the resting place waiting in the lagoon reeds",
        payoffTemplates: [
          "The glow of {discovery} led {name} and {companion} to the right place, and together they were able to {goal}.",
          "With {discovery} lighting the quiet reeds, {name} and {companion} were able to {goal}.",
        ],
      },
    ],
    challenge: "a curtain of drifting seaweed",
    goal: "return a lost pearl to the lagoon",
    pronoun: "they",
  },
  ballet: {
    settings: ["a quiet moonlit stage in a sleeping theatre", "a velvet studio glowing with lantern light"],
    companions: ["a gentle ballet teacher cat", "a tiny mouse dancer in a soft tutu"],
    discoveries: ["a pair of shimmering ballet slippers", "a music box that played the softest lullaby"],
    challenge: "a hallway of creaky wooden floors",
    goal: "perform the final bedtime dance",
    pronoun: "they",
  },
  bakery: {
    settings: ["a cosy little bakery glowing with warm light", "a candlelit kitchen full of sleepy cupcakes"],
    companions: ["a kind baker mouse in a tiny apron", "a cheerful little gingerbread friend"],
    discoveries: ["a secret cupcake recipe written in icing", "a jar of moonlight sprinkles"],
    challenge: "a long shelf of wobbly cake tins",
    goal: "finish the last bedtime cupcake",
    pronoun: "they",
  },
  fashion: {
    settings: ["a softly lit dressing room sparkling with gowns", "a quiet boutique glowing with tiaras and ribbons"],
    companions: ["a kind seamstress bunny", "a clever little dress-up fox"],
    discoveries: ["a crown made of tiny glowing stars", "a dress spun from moonlight thread"],
    challenge: "a row of gentle curtains to tiptoe past",
    goal: "finish the royal bedtime outfit in time for the ball",
    pronoun: "they",
  },
  flowers: {
    settings: ["a secret garden of glowing flowers", "a meadow of butterflies drifting softly"],
    companions: ["a gentle butterfly with glowing wings", "a kind ladybird friend"],
    discoveries: ["a flower that glowed like a night-light", "a butterfly lantern hung on a vine"],
    challenge: "a path through tall sleepy sunflowers",
    goal: "help the last butterfly find its flower for the night",
    pronoun: "they",
  },
  teaparty: {
    settings: ["a cosy cottage where teddy bears were having tea", "a moonlit garden with tiny teacups on tiny tables"],
    companions: ["a gentle teddy bear in a bow tie", "a polite little rabbit with a teapot"],
    discoveries: ["a magical teapot that poured warm lullabies", "a biscuit shaped like a tiny star"],
    challenge: "a tray of wobbling teacups",
    goal: "serve the last warm cup before bedtime",
    pronoun: "they",
  },
  dollhouse: {
    settings: ["a tiny dollhouse glowing with miniature lanterns", "a cosy toy kingdom where dolls were settling to sleep"],
    companions: ["a gentle rag doll with yarn hair", "a kind wooden toy friend"],
    discoveries: ["a tiny key to the dollhouse attic", "a miniature music box"],
    challenge: "a staircase that creaked softly",
    goal: "tuck in the last sleepy doll",
    pronoun: "they",
  },
  treehouse: {
    settings: ["a magical treehouse strung with fairy lights", "a cosy treehouse high among gentle leaves"],
    companions: ["a sleepy owl with a lantern", "a kind squirrel with a tiny blanket"],
    discoveries: ["a map of secret forest paths", "a lantern that held a trapped star"],
    challenge: "a soft rope ladder swaying in the breeze",
    goal: "hang the last lantern before the forest sleeps",
    pronoun: "they",
  },
  rainbows: {
    settings: ["a hilltop beneath a quiet rainbow", "a soft meadow where rainbows melted into clouds"],
    companions: ["a cheerful rainbow sprite", "a gentle cloud pony"],
    discoveries: [
      {
        text: "a ribbon of rainbow light",
        discoveryEffect: "it stretched upward and showed exactly where the missing colour belonged",
        payoffTemplates: [
          "Following {discovery}, {name} and {companion} found the empty place in the sky and were able to {goal}.",
          "{discovery} led them to the bedtime rainbow's quiet gap, and soon {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a tiny pot of sleepy colours",
        discoveryEffect: "inside was the very missing shade, glowing softly and ready to be carried back",
        payoffTemplates: [
          "Inside {discovery}, {name} and {companion} found the colour they needed, and together they were able to {goal}.",
          "{discovery} held the missing glow itself, so {name} and {companion} were able to {goal}.",
        ],
      },
    ],
    challenge: "a bridge made of soft rainbow mist",
    goal: "return a missing colour to the bedtime rainbow",
    pronoun: "they",
  },
  kittens: {
    settings: ["a cosy windowsill under the stars", "a sleepy cottage living room by a warm fire"],
    companions: ["a tiny kitten with velvet paws", "a gentle mother cat humming softly"],
    discoveries: [
      {
        text: "a ball of starlight yarn",
        discoveryEffect: "its silver thread trailed all the way back to the waiting basket",
        payoffTemplates: [
          "Following the silver thread from {discovery}, {name} and {companion} were able to {goal}.",
          "{discovery} unrolled a gentle path through the room, and soon {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a soft cushion that purred gently",
        discoveryEffect: "its sleepy purr came from right beside the basket and showed them the way",
        payoffTemplates: [
          "The gentle purr of {discovery} guided {name} and {companion} across the room, and together they were able to {goal}.",
          "Listening to {discovery}, {name} and {companion} found the basket at last and were able to {goal}.",
        ],
      },
    ],
    challenge: "a stack of wobbling cushions to climb",
    goal: "guide a lost kitten back to its basket",
    pronoun: "they",
  },
  bunnies: {
    settings: ["a clover meadow lit by moonlight", "a soft burrow glowing with tiny lanterns"],
    companions: ["a sleepy bunny with velvet ears", "a gentle mother rabbit with a warm smile"],
    discoveries: [
      {
        text: "a patch of glowing clover",
        discoveryEffect: "its soft glow showed where the burrow path curved safely through the meadow",
        payoffTemplates: [
          "The glow from {discovery} showed {name} and {companion} the burrow path, and soon they were able to {goal}.",
          "Following the gentle shine of {discovery}, {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a tiny carrot lantern",
        discoveryEffect: "its warm little light made the hop back to the burrow easy to follow",
        payoffTemplates: [
          "With {discovery} lighting the way, {name} and {companion} were able to {goal}.",
          "At last, {name} saw how {discovery} could guide them gently home, and together they were able to {goal}.",
        ],
      },
    ],
    challenge: "a line of stepping stones across a quiet brook",
    goal: "bring the last baby bunny home to the burrow",
    pronoun: "they",
  },
  treasure: {
    settings: ["a moonlit cove where gentle maps were drawn in sand", "a quiet path lit by softly glowing markers"],
    companions: ["a friendly map-reading mouse", "a kind little firefly guide"],
    discoveries: ["a tiny chest full of bedtime wishes", "a glowing key to the dream door"],
    challenge: "a riddle written in starlight",
    goal: "follow the gentle map to the bedtime treasure",
    pronoun: "they",
  },
  knights: {
    settings: ["a quiet castle courtyard under a silver moon", "a torchlit hall in a sleepy kingdom"],
    companions: ["a kind squire with a tiny lantern", "a gentle castle hound"],
    discoveries: ["a polished shield that hummed softly", "a map of the kingdom's bedtime paths"],
    challenge: "a wooden drawbridge that creaked gently",
    goal: "deliver the bedtime scroll to the sleeping king",
    pronoun: "they",
  },
  trains: {
    settings: ["a quiet little railway station lit by warm lanterns", "a moonlit track winding through sleepy hills"],
    companions: ["a cheerful little steam engine", "a friendly conductor mouse"],
    discoveries: [
      {
        text: "a silver whistle that sang lullabies",
        discoveryEffect: "its sleepy note echoed along the track and showed the last safe way back to the station",
        payoffTemplates: [
          "The lullaby note from {discovery} guided {name} and {companion} along the right line, and soon they were able to {goal}.",
          "Listening to {discovery}, {name} and {companion} followed the quiet track home and were able to {goal}.",
        ],
      },
      {
        text: "a golden ticket to Dreamland",
        discoveryEffect: "the route printed on it pointed them back to the lantern-lit station",
        payoffTemplates: [
          "Using {discovery}, {name} and {companion} found the right railway route and were able to {goal}.",
          "At last, {discovery} made the journey home clear, and together {name} and {companion} were able to {goal}.",
        ],
      },
    ],
    challenge: "a long tunnel through a sleepy mountain",
    goal: "bring the last train safely home to the station",
    pronoun: "they",
  },
  firefighters: {
    settings: ["a peaceful firehouse glowing with warm light", "a quiet town street under the gentle stars"],
    companions: ["a brave fire dog with a soft bark", "a kind firefighter with a warm smile"],
    discoveries: ["a polished helmet that shone like the moon", "a map of every sleepy street in town"],
    challenge: "a curled-up hose to step carefully over",
    goal: "rescue a kitten from a tall gentle tree",
    pronoun: "they",
  },
  construction: {
    settings: ["a cosy building site at dusk with glowing lanterns", "a sleepy yard full of resting diggers and cranes"],
    companions: ["a cheerful little digger", "a friendly crane that hummed a lullaby"],
    discoveries: ["a blueprint for a bedtime treehouse", "a tiny hard hat that glowed softly"],
    challenge: "a pile of wobbly bricks to balance",
    goal: "finish building the cosy bedtime tower",
    pronoun: "they",
  },
  football: {
    settings: ["a quiet moonlit football pitch", "a sleepy village green with soft goalposts"],
    companions: ["a friendly coach owl", "a kind teammate pup"],
    discoveries: ["a golden medal that glowed warmly", "a tiny whistle that chimed softly"],
    challenge: "a patch of long grass to dribble through",
    goal: "score the last gentle goal before bedtime",
    pronoun: "they",
  },
  builders: {
    settings: ["a cosy workshop lit by lanterns and blueprints", "a quiet inventor's attic full of sleepy gadgets"],
    companions: ["a clever little tool mouse", "a tiny inventor friend with round glasses"],
    discoveries: ["a gadget that sang lullabies in a soft voice", "a tiny brick tower that glowed from within"],
    challenge: "a tall tower of blocks that wobbled gently",
    goal: "finish the bedtime invention before the stars drift off",
    pronoun: "they",
  },
  videogame: {
    settings: ["a pixelated meadow glowing with soft game lights", "a calm starter world inside a sleepy arcade"],
    companions: ["a cheerful pixel pet", "a kind little game guide sprite"],
    discoveries: ["a power-up that granted warm dreams", "a golden coin that hummed a lullaby"],
    challenge: "a gentle puzzle bridge made of floating blocks",
    goal: "reach the bedtime level and save the sleepy world",
    pronoun: "they",
  },
  wolves: {
    settings: ["a quiet forest clearing under a soft full moon", "a sleepy mountain meadow lit by silver light"],
    companions: ["a gentle wolf pup with warm eyes", "a kind mother wolf humming softly"],
    discoveries: [
      {
        text: "a patch of moon-touched moss",
        discoveryEffect: "its pale shine marked the quiet trail back to the den",
        payoffTemplates: [
          "The moonlit trail around {discovery} showed {name} and {companion} the safe way onward, and soon they were able to {goal}.",
          "Following the pale glow of {discovery}, {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a silver howl charm",
        discoveryEffect: "its gentle call carried through the trees and led them toward the waiting pack",
        payoffTemplates: [
          "When {discovery} gave its soft call, {name} and {companion} knew which way to go and were able to {goal}.",
          "The quiet call from {discovery} guided them through the forest, and soon {name} and {companion} were able to {goal}.",
        ],
      },
    ],
    challenge: "a trail across a quiet frosty brook",
    goal: "guide a lost wolf pup back to the pack's den",
    pronoun: "they",
  },
  monstertrucks: {
    settings: ["a sleepy arena lit by soft stadium stars", "a quiet dirt track under a warm lantern sky"],
    companions: ["a friendly little monster truck", "a cheerful pit-crew bear"],
    discoveries: ["a trophy that glowed with gentle warmth", "a map to the cosy garage"],
    challenge: "a row of soft ramps to roll across",
    goal: "drive the last lap before the arena goes to sleep",
    pronoun: "they",
  },
  bigcats: {
    settings: ["a warm savannah at twilight under gentle stars", "a quiet jungle path lit by fireflies"],
    companions: ["a kind lion cub with a soft mane", "a gentle tiger cub with warm stripes"],
    discoveries: [
      {
        text: "a golden paw-print charm",
        discoveryEffect: "it pointed toward the soft paw-path leading back to the cosy den",
        payoffTemplates: [
          "With {discovery} showing the paw-path ahead, {name} and {companion} were able to {goal}.",
          "At last, {discovery} made the way back clear, and together {name} and {companion} were able to {goal}.",
        ],
      },
      {
        text: "a lullaby hidden in the tall grass",
        discoveryEffect: "its sleepy sound drifted from the den side of the savannah and showed which way to go",
        payoffTemplates: [
          "Following the soft sound of {discovery}, {name} and {companion} were able to {goal}.",
          "The gentle lullaby in {discovery} guided them homeward, and soon {name} and {companion} were able to {goal}.",
        ],
      },
    ],
    challenge: "a stream of quiet moonlit water to cross",
    goal: "bring a lost cub back to its cosy den",
    pronoun: "they",
  },
  camping: {
    settings: ["a starlit campsite beside a gentle lake", "a cosy tent under a canopy of twinkling stars"],
    companions: ["a wise old owl with gentle eyes", "a kind little hedgehog with a tiny lantern"],
    discoveries: ["a jar of fireflies that glowed softly", "a warm marshmallow shaped like a tiny moon"],
    challenge: "a path through whispering pine trees",
    goal: "see the shooting star before bedtime",
    pronoun: "they",
  },
};

// =============================================================================
// Girls' Dream Bank — categorised ideas pool for random story variety
// Used for UI suggestions, autofill, and random interest enhancement.
// =============================================================================

const girlsDreamBank = {
  magicalFantasy: [
    "fairies", "unicorns", "princesses", "magical castles", "talking animals",
    "mermaids", "flying through the sky", "wishing stars", "enchanted forests",
    "magic spells", "friendly dragons", "secret magical worlds", "glowing potions",
    "moon magic", "cloud kingdoms",
  ],
  animalsAndCompanions: [
    "bunny rabbits", "kittens", "puppies", "baby pandas", "ponies", "deer",
    "hedgehogs", "baby bears", "talking animal friends", "animal adventures",
    "caring for animals", "baby foxes", "lambs", "ducklings",
  ],
  playToysImagination: [
    "dollhouses", "teddy bears", "tea parties", "dress-up games", "playing pretend",
    "toy adventures", "magical toys that come alive", "building little worlds",
    "hide and seek", "puppet shows", "toy parades",
  ],
  sweetTreats: [
    "cupcakes", "ice cream", "candy lands", "chocolate", "baking cakes",
    "sweet shops", "magical desserts", "tea and biscuits", "picnic treats",
    "strawberries and cream", "marshmallow clouds", "honey cakes",
  ],
  dancingMusic: [
    "ballet", "dancing", "singing", "performing on stage", "music and instruments",
    "talent shows", "becoming a star", "twirling in dresses", "music boxes",
    "lullabies", "choir of fireflies",
  ],
  naturePeaceful: [
    "flower fields", "butterflies", "rainbows", "sunshine", "gentle rivers",
    "gardens", "picnics", "treehouses", "watching stars", "ladybirds",
    "dandelion wishes", "morning dewdrops",
  ],
  familyLoveComfort: [
    "being with family", "cuddles", "feeling safe", "bedtime stories", "friendship",
    "helping others", "kindness", "love and care", "warm blankets",
    "goodnight kisses", "holding hands",
  ],
  adventureExploration: [
    "treasure hunts", "exploring forests", "space adventures", "flying balloons",
    "secret paths", "hidden doors", "discovering new places", "gentle quests",
    "map reading", "lantern walks", "moonlight picnics",
  ],
  fashionBeauty: [
    "pretty dresses", "sparkly shoes", "hairstyles", "dressing up", "jewellery",
    "crowns and tiaras", "make-believe fashion shows", "ribbon bows",
    "flower crowns", "sparkly wands",
  ],
};

// Flat list of every girls' dream item — useful for random interest fallback.
const girlsDreamBankFlat = Object.values(girlsDreamBank).flat();

// =============================================================================
// Boys' Dream Bank — categorised ideas pool for random story variety
// Used for UI suggestions, autofill, and random interest enhancement.
// =============================================================================

const boysDreamBank = {
  heroesAction: [
    "superheroes", "saving the day", "secret identities", "fighting villains",
    "rescue missions", "being brave", "protecting others", "epic battles",
    "becoming a hero", "team adventures", "sidekick duos", "hero training",
  ],
  vehiclesMachines: [
    "cars", "race cars", "monster trucks", "motorbikes", "trains", "fire engines",
    "police cars", "construction vehicles", "diggers", "cranes", "flying planes",
    "helicopters", "tractors", "submarines",
  ],
  spaceExploration: [
    "astronauts", "rockets", "exploring planets", "friendly aliens", "space missions",
    "stars and galaxies", "moon adventures", "discovering new worlds",
    "space stations", "comets", "starships",
  ],
  dinosaursCreatures: [
    "dinosaurs", "T-Rex", "raptors", "fossil hunting", "prehistoric worlds",
    "giant creatures", "dragons", "mythical beasts", "triceratops",
    "pterodactyls", "sea monsters",
  ],
  sportsPlay: [
    "football", "running", "racing", "climbing", "jumping", "competitions",
    "winning challenges", "team games", "training and improving", "basketball",
    "cycling", "skateboarding",
  ],
  buildingCreating: [
    "building forts", "Lego creations", "inventing machines", "fixing things",
    "engineering", "construction", "creating gadgets", "problem-solving",
    "robots from blocks", "building bridges", "designing vehicles",
  ],
  animalsCompanions: [
    "dogs", "wolves", "lions", "tigers", "bears", "horses", "animal sidekicks",
    "training animals", "animal adventures", "eagles", "sharks", "pandas",
  ],
  explorationDiscovery: [
    "treasure hunts", "maps", "hidden caves", "secret tunnels", "jungle adventures",
    "desert exploration", "island adventures", "finding hidden objects",
    "lost cities", "mountain quests", "river expeditions",
  ],
  powerFantasy: [
    "kings", "knights", "castles", "royal swords", "armour", "medieval adventures",
    "dragons and kingdoms", "royal quests", "wizards", "magical kingdoms",
    "brave champions",
  ],
  technologyFuture: [
    "robots", "AI companions", "futuristic cities", "gadgets", "holograms",
    "tech adventures", "building robots", "smart inventions", "spacecraft",
    "laser tools", "cyber pets",
  ],
  friendshipGrowth: [
    "friendship", "loyalty", "courage", "helping others", "learning new skills",
    "overcoming fears", "teamwork", "doing the right thing", "kindness",
    "standing up for friends",
  ],
  playFunWorlds: [
    "video game worlds", "arcade adventures", "levelling up", "unlocking powers",
    "game challenges", "fantasy game lands", "power-ups", "pixel quests",
    "boss adventures",
  ],
};

// Flat list of every boys' dream item — useful for random interest fallback.
const boysDreamBankFlat = Object.values(boysDreamBank).flat();

// =============================================================================
// Theme-world suitability metadata
// Each world tagged with (minAge, maxAge, audience: "any" | "girl" | "boy").
// Used by pickSuitableWorld(child) so 9-year-olds never get toddler themes
// and the audience matches the child's gender when set.
// =============================================================================

const worldSuitability = {
  // Unisex (any age 2–12)
  dinosaurs:     { minAge: 2,  maxAge: 12, audience: "any" },
  magic:         { minAge: 2,  maxAge: 12, audience: "any" },
  animals:       { minAge: 2,  maxAge: 12, audience: "any" },
  jungle:        { minAge: 3,  maxAge: 12, audience: "any" },
  ocean:         { minAge: 2,  maxAge: 12, audience: "any" },
  school:        { minAge: 3,  maxAge: 12, audience: "any" },
  family:        { minAge: 2,  maxAge: 12, audience: "any" },
  home:          { minAge: 2,  maxAge: 10, audience: "any" },
  reading:       { minAge: 3,  maxAge: 12, audience: "any" },
  sweets:        { minAge: 2,  maxAge: 10, audience: "any" },
  mystery:       { minAge: 4,  maxAge: 12, audience: "any" },
  performance:   { minAge: 3,  maxAge: 12, audience: "any" },
  travel:        { minAge: 3,  maxAge: 12, audience: "any" },
  toys:          { minAge: 2,  maxAge: 9,  audience: "any" },
  feelings:      { minAge: 3,  maxAge: 12, audience: "any" },
  weather:       { minAge: 2,  maxAge: 12, audience: "any" },
  places:        { minAge: 3,  maxAge: 12, audience: "any" },
  time:          { minAge: 4,  maxAge: 12, audience: "any" },
  roleplay:      { minAge: 3,  maxAge: 12, audience: "any" },
  cozy:          { minAge: 2,  maxAge: 10, audience: "any" },
  surprises:     { minAge: 2,  maxAge: 12, audience: "any" },
  friendship:    { minAge: 3,  maxAge: 12, audience: "any" },
  problemsolving:{ minAge: 4,  maxAge: 12, audience: "any" },
  creativity:    { minAge: 3,  maxAge: 12, audience: "any" },
  dreams:        { minAge: 2,  maxAge: 12, audience: "any" },
  whimsy:        { minAge: 2,  maxAge: 10, audience: "any" },
  everyday:      { minAge: 2,  maxAge: 12, audience: "any" },
  perspective:   { minAge: 3,  maxAge: 12, audience: "any" },
  comfort:       { minAge: 2,  maxAge: 12, audience: "any" },
  achievement:   { minAge: 3,  maxAge: 12, audience: "any" },
  objects:       { minAge: 2,  maxAge: 12, audience: "any" },
  bedtime:       { minAge: 2,  maxAge: 12, audience: "any" },
  farm:          { minAge: 2,  maxAge: 10, audience: "any" },
  zoo:           { minAge: 2,  maxAge: 10, audience: "any" },
  dragons:       { minAge: 3,  maxAge: 12, audience: "any" },
  treehouse:     { minAge: 3,  maxAge: 12, audience: "any" },
  rainbows:      { minAge: 2,  maxAge: 9,  audience: "any" },
  treasure:      { minAge: 4,  maxAge: 12, audience: "any" },
  // Leans younger
  princesses:    { minAge: 2,  maxAge: 9,  audience: "girl" },
  fairies:       { minAge: 2,  maxAge: 9,  audience: "girl" },
  unicorns:      { minAge: 2,  maxAge: 10, audience: "girl" },
  mermaids:      { minAge: 2,  maxAge: 10, audience: "girl" },
  ballet:        { minAge: 3,  maxAge: 11, audience: "girl" },
  bakery:        { minAge: 2,  maxAge: 9,  audience: "girl" },
  fashion:       { minAge: 3,  maxAge: 11, audience: "girl" },
  flowers:       { minAge: 2,  maxAge: 9,  audience: "girl" },
  teaparty:      { minAge: 2,  maxAge: 8,  audience: "girl" },
  dollhouse:     { minAge: 2,  maxAge: 8,  audience: "girl" },
  kittens:       { minAge: 2,  maxAge: 9,  audience: "any" },
  bunnies:       { minAge: 2,  maxAge: 8,  audience: "any" },
  // Boy-leaning / action
  superheroes:   { minAge: 4,  maxAge: 12, audience: "any" },
  space:         { minAge: 4,  maxAge: 12, audience: "any" },
  flying:        { minAge: 4,  maxAge: 12, audience: "any" },
  pirates:       { minAge: 4,  maxAge: 12, audience: "any" },
  cars:          { minAge: 2,  maxAge: 10, audience: "any" },
  robots:        { minAge: 3,  maxAge: 12, audience: "any" },
  knights:       { minAge: 4,  maxAge: 12, audience: "boy" },
  trains:        { minAge: 2,  maxAge: 9,  audience: "any" },
  firefighters:  { minAge: 2,  maxAge: 9,  audience: "any" },
  construction:  { minAge: 2,  maxAge: 9,  audience: "boy" },
  football:      { minAge: 4,  maxAge: 12, audience: "any" },
  builders:      { minAge: 3,  maxAge: 11, audience: "any" },
  videogame:     { minAge: 6,  maxAge: 12, audience: "any" },
  wolves:        { minAge: 5,  maxAge: 12, audience: "any" },
  monstertrucks: { minAge: 3,  maxAge: 10, audience: "boy" },
  bigcats:       { minAge: 4,  maxAge: 12, audience: "any" },
  camping:       { minAge: 3,  maxAge: 12, audience: "any" },
};

// Aliases so parent interests match theme worlds even when phrased differently.
// Expanded based on common phrasings parents actually use for kids aged 2–12.
const themeAliases = {
  dinosaurs:    ["dinosaur", "dino", "t-rex", "trex", "triceratops", "raptor", "stegosaurus", "brontosaurus", "pterodactyl", "fossil", "jurassic"],
  space:        ["astronaut", "rocket", "planet", "galaxy", "spaceship", "nasa", "satellite", "alien", "stars", "constellation", "meteor", "comet"],
  flying:       ["fly", "flying", "glide", "gliding", "soar", "soaring", "wings", "sky flight", "sky adventure", "flying adventure"],
  ocean:        ["sea", "beach", "waves", "fish", "coral", "shells", "seaside", "submarine", "whale", "shark", "octopus", "turtle", "jellyfish", "starfish", "dolphin", "dolphins", "swim", "swimming", "underwater"],
  school:       ["school", "classroom", "teacher", "playground", "first day", "first day at school", "school bus", "backpack", "lunch box", "lesson", "reading time"],
  family:       ["family", "sibling", "helping a sibling", "share", "sharing", "learning to share", "grandparents", "visiting grandparents", "new friend", "making a new friend", "sleepover", "first sleepover"],
  home:         ["rainy day", "rainy day at home", "day at home", "surprise day out", "park", "going to the park", "shops", "trip to the shops", "tidy", "helping tidy up", "bedtime routine", "quiet day"],
  reading:      ["reading", "quiet reading day", "books", "storybook", "library", "learning to read", "read", "reading nook"],
  sweets:       ["candy", "candy land", "cupcake", "cupcakes", "bakery", "ice cream", "chocolate", "factory", "baking", "cake", "picnic", "tea party", "tea"],
  mystery:      ["mystery", "classroom mystery", "hidden key", "secret door", "missing item", "missing", "lost something", "finding something", "secret garden", "puzzle", "clue", "map", "hidden place"],
  performance:  ["dance", "dancing", "ballet", "singing", "talent show", "performer", "performance", "music", "playing music", "stage show", "stage", "show and tell"],
  travel:       ["trip", "journey", "plane", "flying in a plane", "boat", "boat trip", "bike", "riding a bike", "bus", "bus adventure", "helicopter", "ride", "hot air balloon", "magical train ride"],
  toys:         ["toy", "toys", "toy adventure", "magical toy", "building a magical toy", "mini world", "create a mini world", "hideout", "secret hideout", "treehouse", "playroom"],
  feelings:     ["brave", "learning to be brave", "overcoming fear", "fear", "kind", "being kind", "helping someone", "saying sorry", "sorry", "feeling proud", "proud", "trying something new", "new thing", "emotions", "understanding emotions"],
  weather:      ["gentle rain", "walking in gentle rain", "rain", "rainbow", "rainbows", "chasing rainbows", "snow", "snow day", "snow day adventure", "snowman", "building a snowman", "windy day", "wind", "storm", "magical storm", "lightning", "watching lightning", "fog", "foggy morning", "foggy mystery morning", "autumn leaves", "beach day", "sunny beach day", "seaside weather"],
  places:       ["hidden island", "island", "secret garden", "magical library", "glowing cave", "cave", "mountain adventure", "mountain", "desert journey", "desert", "snowy village", "village", "seaside town", "floating city", "above the clouds", "world above the clouds", "cloud city", "egypt", "egyptian", "pyramid", "pyramids", "pharaoh", "nile"],
  time:         ["back in time", "travelling back in time", "traveling back in time", "future", "visiting the future", "day that repeats", "repeats", "frozen moment", "frozen in time", "growing up for a day", "becoming younger again", "talking clock", "clock that talks", "time moves slowly", "slow time"],
  roleplay:     ["being a firefighter", "being a doctor", "doctor", "being a teacher", "teacher", "being a chef", "chef", "being an explorer", "explorer", "being a zookeeper", "zookeeper", "being a pilot", "pilot", "being a knight", "being a princess", "being a superhero for a day", "running a little shop", "shopkeeper", "little shop"],
  cozy:         ["blanket fort", "blanket fort adventure", "story under the covers", "under the covers", "magical bedroom", "bedroom", "toys coming to life", "toys coming to life at night", "quiet night with a surprise", "cosy winter evening", "cozy winter evening", "hidden space in the house", "hidden space", "bedtime dream world", "under the blankets"],
  surprises:    ["surprise gift", "gift", "mysterious box", "mystery box", "magical letter", "letter", "birthday surprise", "birthday", "hidden present", "present", "message from a star", "surprise visitor", "visitor", "special reward", "reward"],
  friendship:   ["meeting someone new", "new friend", "helping a shy friend", "shy friend", "making up after an argument", "argument", "sharing something special", "sharing", "working together", "teamwork", "helping someone feel better", "take turns", "taking turns", "supporting a friend", "friendship"],
  problemsolving:["lost item", "finding a lost item", "solving a small mystery", "small mystery", "helping someone stuck", "stuck", "fixing something broken", "broken", "figuring out a puzzle", "puzzle", "choosing the right path", "right path", "find their way", "helping someone find their way", "following clues", "clues", "delivering something important", "returning a lost item", "small mission", "completing a small mission", "helping an animal", "helping someone small", "gentle problem"],
  creativity:   ["painting something magical", "painting", "drawing that comes to life", "drawing", "building an imaginary world", "imaginary world", "writing a story inside a story", "story inside a story", "colouring a magical picture", "coloring a magical picture", "creating music", "music", "designing something new", "design"],
  dreams:       ["floating through dreams", "dreams", "dream world", "world made of clouds", "made of clouds", "glowing lights", "land of glowing lights", "walking on stars", "world made of colours", "world made of colors", "soft and calm", "quiet dreamland", "dreamland", "everything is soft and calm"],
  whimsy:       ["circus", "circus adventure", "funfair", "funfair at night", "bouncing things", "world of bouncing things", "everything giggles", "land where everything giggles", "upside-down world", "giant toys", "world of giant toys", "laughing forest", "silly world"],
  everyday:     ["shiny pebble", "finding a shiny pebble", "watching ants build something", "ants", "following a butterfly", "butterfly", "strange but friendly sound", "friendly sound", "seeing something sparkle", "something sparkle", "quiet moment that becomes special", "discovering something small but meaningful", "simple walk that turns magical", "simple walk", "tiny everyday wonders", "everyday wonder"],
  perspective:  ["what if animals could talk", "animals could talk just for one night", "what if the moon could speak", "moon could speak", "what if shadows were friendly", "friendly shadows", "what if dreams were places you could visit", "dreams were places", "what if the stars were watching over you", "stars were watching over you", "what if your reflection waved back", "reflection waved back", "seeing the world differently", "becoming part of a story"],
  comfort:      ["feeling nervous and becoming calm", "feeling nervous", "missing someone and feeling close again", "missing someone", "scared of the dark", "being scared of the dark and finding light", "okay to be different", "learning it's okay to be different", "learning it’s okay to be different", "comfort in a quiet place", "quiet place", "everything is okay", "reassured everything is okay", "you are safe", "you are safe story", "feeling safe", "safe story"],
  achievement:  ["tying shoes", "tying shoes for the first time", "riding a bike", "learning to swim", "speaking up for the first time", "speaking up", "trying something new", "finishing something important", "feeling proud of effort", "proud of effort", "trying again after failing", "small brave step", "taking a small brave step"],
  objects:      ["magical key", "glowing stone", "special blanket", "tiny lantern", "mysterious map", "music box", "pair of shoes that help you explore", "exploring shoes", "compass that points to kindness", "compass", "special object", "object-based story"],
  bedtime:      ["getting ready for bed", "saying goodnight to things", "saying goodnight", "watching the world slow down", "journey back home", "back home", "lights dimming gently", "drifting into sleep", "dream beginning", "a dream beginning", "bedtime", "pre-sleep", "journey that continues tomorrow", "continues tomorrow", "place you can revisit", "revisit", "character that grows each time", "grows each time", "story that gently repeats", "gently repeats", "repeats with variation", "recurring magical world"],
  jungle:       ["rainforest", "safari", "monkey", "toucan", "parrot", "sloth", "vines", "tropical"],
  farm:         ["tractor", "sheep", "cow", "chicken", "barnyard", "pig", "goat", "horse", "duck", "hen", "farmer"],
  zoo:          ["panda", "giraffe", "elephant", "lion", "tiger", "zebra", "gorilla", "kangaroo", "penguin", "polar bear"],
  dragons:      ["dragon", "wyvern", "dragon egg", "fire-breathing"],
  princesses:   ["princess", "queen", "royal", "crown", "tiara", "palace", "king", "prince"],
  fairies:      ["fairy", "pixie", "wings", "tinkerbell", "fairy dust", "sprites"],
  unicorns:     ["unicorn", "horn", "magical horse"],
  mermaids:     ["mermaid", "lagoon", "mermaid tail", "merfolk"],
  superheroes:  ["superhero", "hero", "cape", "super powers", "spiderman", "batman", "supergirl", "wonder woman", "gentle superhero", "kind superhero", "superhero who helps people feel brave", "hero who fixes small problems", "helping lost things find home", "hero who brings light", "superhero who helps animals", "hero who spreads kindness", "hero who helps friends work together", "hero who listens", "turning fear into courage", "warm glowing light", "talking to animals", "making plants grow", "flying gently", "protective bubbles", "making people smile", "calming storms", "finding lost things", "little sparkles of magic", "superhero for one day", "secret hero at school", "saving the day by being kind", "helping someone shy", "quiet hero", "bedtime superhero", "hero during a normal day", "superhero puppy", "flying bunny hero", "panda superhero", "cat who protects the night", "bear who keeps everyone safe", "dolphin superhero", "bird who guides others home", "watches over dreams", "brings peaceful sleep", "night guardian", "star-powered superhero", "moonlight protector", "chases away worries", "group of kids with different powers", "friends who become heroes together", "team of heroes", "work together to solve a problem", "feel included", "hero learning to be brave", "shy hero", "hero who makes mistakes and learns", "discovering powers slowly", "kindness is the strongest power", "find their way home", "finding a lost pet", "helping a scared friend", "small mystery", "secret identity at school", "hidden superhero costume", "normal day turning into a hero mission", "hero who only appears at night", "powered by kindness", "collects happy moments", "paints the sky", "controls dreams", "creates safe spaces", "brings colour to the world", "helps people believe in themselves"],
  pirates:      ["pirate", "treasure ship", "parrot", "eye patch", "pirate ship", "jolly roger"],
  knights:      ["knight", "castle", "sword", "armour", "armor", "shield", "jousting"],
  trains:       ["train", "railway", "locomotive", "thomas", "steam train", "station"],
  cars:         ["car", "vehicle", "race car", "racing", "cars movie", "lightning mcqueen", "auto", "driving"],
  firefighters: ["firefighter", "fire truck", "fireman", "firewoman", "fire engine", "rescue"],
  construction: ["digger", "excavator", "bulldozer", "crane", "cement mixer", "dump truck", "construction site"],
  football:     ["football", "soccer", "goal", "match", "sports", "basketball", "tennis", "rugby", "cricket", "athletics", "gymnastics"],
  robots:       ["robot", "android", "mech", "machine", "ai", "cyborg"],
  videogame:    ["video game", "gaming", "console", "minecraft", "roblox", "playstation", "xbox", "nintendo"],
  wolves:       ["wolf", "wolves", "pack"],
  monstertrucks:["monster truck", "big wheel", "truck"],
  bigcats:      ["tiger", "lion", "leopard", "cheetah", "jaguar", "panther", "lynx"],
  teaparty:     ["tea party", "tea", "teddy picnic"],
  dollhouse:    ["doll", "doll house", "barbie", "rag doll"],
  ballet:       ["ballet", "dancer", "tutu", "dancing", "ballerina", "pointe shoes"],
  fashion:      ["dress", "gown", "fashion", "boutique", "dress up", "makeup", "sparkle"],
  bakery:       ["cake", "cupcake", "bake", "cookie", "biscuit", "baking", "bread", "muffin", "pastry", "dessert"],
  flowers:      ["flower", "garden", "butterfly", "caterpillar", "ladybird", "ladybug", "bee", "blossom", "petals", "daisies"],
  treehouse:    ["tree house", "tree fort", "treetop", "hideout"],
  rainbows:     ["rainbow", "colours", "colors"],
  kittens:      ["kitten", "cat", "kitty", "puss", "tabby"],
  bunnies:      ["bunny", "rabbit", "hare"],
  magic:        ["magic", "spell", "wizard", "witch", "sorcerer", "potion", "wand", "enchanted", "make-believe", "pretend", "fairy", "wishing star", "dreamland", "glowing night", "hidden magical door", "castle in the clouds", "hidden world", "floating island"],
  animals:      ["animal", "pet", "dog", "puppy", "hamster", "guinea pig", "pony", "creature", "wildlife"],
  treasure:     ["treasure", "map", "gold", "chest", "jewels", "gems", "ruby", "diamond"],
  builders:     ["builder", "building", "lego", "blocks", "construction blocks", "duplo", "building site", "building a treehouse", "creating a secret hideout", "making something special", "fixing something broken", "inventing a gadget", "creating a mini world"],
  camping:      ["camping", "tent", "campfire", "marshmallow", "woods at night", "outdoor", "sleeping bag", "hiking", "campsite", "owl", "watching the stars", "moonlit walk", "bedtime journey", "peaceful forest night", "calm river"],
};

/** Levenshtein edit distance — counts insertions/deletions/substitutions. */
function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

/** Fuzzy token match — substring OR edit-distance within a length-scaled threshold. */
function fuzzyTokenMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Scale tolerance with word length: 4-7 chars → 1 edit, 8+ chars → 2 edits, <4 → exact only
  const shorter = Math.min(a.length, b.length);
  if (shorter < 4) return false;
  const tolerance = shorter >= 8 ? 2 : 1;
  return editDistance(a, b) <= tolerance;
}

/** Return true if any child interest matches the given world's key or aliases. */
function interestMatchesWorld(worldKey, interests) {
  return scoreInterestMatch(worldKey, interests) > 0;
}

function scoreInterestMatch(worldKey, interests) {
  if (!interests || !interests.length) return false;
  const aliases = themeAliases[worldKey] || [];
  const needles = [worldKey.toLowerCase(), ...aliases.map((a) => a.toLowerCase())];
  let bestScore = 0;

  interests.forEach((raw) => {
    const i = String(raw).toLowerCase().trim();
    if (!i) return;
    // Check the whole interest string AND each word in it (handles "loves dinosaurs and trains")
    const tokens = [i, ...i.split(/[\s,]+/).filter(Boolean)];

    needles.forEach((needle) => {
      if (i === needle) {
        bestScore = Math.max(bestScore, 6);
        return;
      }
      if (i.includes(needle) || needle.includes(i)) {
        bestScore = Math.max(bestScore, 5);
      }

      tokens.forEach((tok) => {
        if (tok === needle) {
          bestScore = Math.max(bestScore, 4);
        } else if (fuzzyTokenMatch(tok, needle)) {
          bestScore = Math.max(bestScore, 2);
        }
      });
    });
  });

  return bestScore;
}

function findInterestMatchedWorld(child = {}) {
  const age = Number(child.age) || 5;
  const interests = (child.interests || []).map((i) => String(i).toLowerCase());
  const keys = Object.keys(themeWorlds);

  const scoredMatches = keys.map((k) => {
    const suitability = worldSuitability[k];
    const ageFits = !suitability || (age >= suitability.minAge && age <= suitability.maxAge);
    return {
      key: k,
      score: ageFits ? scoreInterestMatch(k, interests) : 0,
    };
  }).filter((entry) => entry.score > 0);

  if (!scoredMatches.length) return null;

  const bestScore = Math.max(...scoredMatches.map((entry) => entry.score));
  const matched = scoredMatches
    .filter((entry) => entry.score === bestScore)
    .map((entry) => entry.key);

  return themeWorlds[pick(matched)] || null;
}

const QUICK_WISH_CONNECTOR_WORDS = new Set([
  "a", "an", "the", "and", "or", "with", "over", "above", "under", "through",
  "into", "across", "around", "past", "near", "by", "to", "from", "of", "in",
]);

const QUICK_WISH_ACTION_WORDS = new Set([
  "fly", "flying", "glide", "gliding", "soar", "soaring", "swim", "swimming",
  "float", "floating", "ride", "riding", "sail", "sailing", "zoom", "zooming",
]);

const QUICK_WISH_FIDELITY_STOP_WORDS = new Set([
  "see", "seeing", "look", "looking", "watch", "watching", "gentle", "calm",
  "magical", "magic", "quiet", "night", "sky", "story", "adventure", "beautiful",
]);

function extractQuickWishFocusTerms(wish) {
  return String(wish || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !QUICK_WISH_CONNECTOR_WORDS.has(token))
    .filter((token) => !QUICK_WISH_ACTION_WORDS.has(token));
}

function extractQuickWishFidelityTerms(wish) {
  return [...new Set(
    extractQuickWishFocusTerms(wish)
      .filter((token) => !QUICK_WISH_FIDELITY_STOP_WORDS.has(token))
  )];
}

function isGenericFlyingWish(wish = "") {
  const lower = normalizeStoryIdea(wish).toLowerCase();
  if (!/\b(fly|flying|glide|gliding|soar|soaring)\b/.test(lower)) return false;
  if (/\b(rocket|astronaut|spaceship|space|planet|galaxy|moon|star|plane|airplane|aeroplane|helicopter|balloon)\b/.test(lower)) {
    return false;
  }
  return true;
}

function findQuickWishMatchedWorld(wish, child = {}) {
  const normalizedWish = String(wish || "").trim().toLowerCase();
  if (!normalizedWish) return null;

  if (isGenericFlyingWish(normalizedWish)) {
    return themeWorlds.flying;
  }

  const focusTerms = extractQuickWishFocusTerms(normalizedWish);
  if (focusTerms.length) {
    const focusWorld = findInterestMatchedWorld({
      ...child,
      interests: focusTerms,
    });
    if (focusWorld) return focusWorld;
  }

  return findInterestMatchedWorld({
    ...child,
    interests: [normalizedWish],
  });
}

/**
 * Pick a theme world suited to the child.
 * Priority: stated interests (parent-set) → age+gender → age only → any.
 * Interests always override gender/age defaults when they match a world.
 */
function pickSuitableWorld(child = {}) {
  const age = Number(child.age) || 5;
  const gender = (child.gender || "").toLowerCase();
  const interests = (child.interests || []).map((i) => String(i).toLowerCase());

  const keys = Object.keys(themeWorlds);
  const ageFit = (k) => {
    const s = worldSuitability[k];
    return s && age >= s.minAge && age <= s.maxAge;
  };

  // 1) Interest-matched worlds (parent-stated — overrides gender default)
  const interestWorld = findInterestMatchedWorld(child);
  if (interestWorld) return interestWorld;

  // 2) Age + gender default
  if (gender === "girl" || gender === "boy") {
    const gPool = keys.filter((k) => {
      if (!ageFit(k)) return false;
      const aud = worldSuitability[k].audience;
      return aud === "any" || aud === gender;
    });
    if (gPool.length) return themeWorlds[pick(gPool)] || null;
  }

  // 3) Any age-appropriate world
  const agePool = keys.filter(ageFit);
  if (agePool.length) return themeWorlds[pick(agePool)] || null;

  // 4) Absolute fallback
  return themeWorlds[pick(keys)] || null;
}

function pickRandomSuitableWorld(child = {}) {
  const age = Number(child.age) || 5;
  const gender = (child.gender || "").toLowerCase();
  const keys = Object.keys(themeWorlds);

  const pool = keys.filter((k) => {
    const suitability = worldSuitability[k];
    if (!suitability) return true;
    if (age < suitability.minAge || age > suitability.maxAge) return false;
    if (gender === "girl" || gender === "boy") {
      return suitability.audience === "any" || suitability.audience === gender;
    }
    return true;
  });

  return themeWorlds[pick(pool.length ? pool : keys)] || null;
}

// =============================================================================
// Quick Story — Procedural generation engine
// =============================================================================

function getAgeGroup(age) {
  // 2–3 → toddlers (stars, moon, fairies, cuddles)
  // 3–6 → young (animals, toys, small adventures)
  // 6–12 → older (flying, exploring, heroes)
  const a = Number(age) || 5;
  if (a <= 3) return "toddlers";
  if (a <= 6) return "young";
  return "older";
}

/**
 * Enhance a child's interests with age-appropriate fallbacks.
 *
 * FIX: Previous version referenced an undefined `dreamInterests` variable.
 * Now uses only the child's own interests + one random age-appropriate interest
 * as a fallback, ensuring the array is never empty.
 */
function enhanceInterests(child) {
  const ageGroup = getAgeGroup(child.age || 5);
  const agePool = interestsByAge[ageGroup];

  const userInterests = (child.interests || [])
    .map((i) => i.toLowerCase().trim())
    .filter(Boolean);

  // Draw the fallback from a gender-matched dream bank for more variety;
  // otherwise use the age-appropriate pool. Adds one extra random idea so
  // non-themed stories never feel repetitive.
  const gender = (child.gender || "").toLowerCase();
  const fallbackPool =
    gender === "girl" ? girlsDreamBankFlat :
    gender === "boy" ? boysDreamBankFlat :
    agePool;
  const fallback = pick(fallbackPool);
  const extra = pick(agePool);
  const combined = [...userInterests, fallback, extra];
  return [...new Set(combined)];
}

function formatInterest(interest) {
  if (!interest) return "";
  const word = interest.toLowerCase().trim();

  const pluralMap = {
    princess: "princesses",
    fairy: "fairies",
    story: "stories",
    baby: "babies",
    puppy: "puppies",
    bunny: "bunnies",
    pony: "ponies",
  };

  if (pluralMap[word]) return pluralMap[word];
  if (word.endsWith("s")) return word;
  return word + "s";
}

function getIndefiniteArticle(word) {
  return /^[aeiou]/i.test(String(word || "").trim()) ? "an" : "a";
}

function addAdjectiveToType(type, adjective) {
  const trimmedType = String(type || "").trim();
  const trimmedAdjective = String(adjective || "").trim();
  if (!trimmedType || !trimmedAdjective) return trimmedType;

  const withoutArticle = trimmedType.replace(/^(?:a|an)\s+/i, "");
  const lowerWords = withoutArticle.toLowerCase().split(/\s+/);
  if (lowerWords.includes(trimmedAdjective.toLowerCase())) {
    return `${getIndefiniteArticle(withoutArticle)} ${withoutArticle}`;
  }

  return `${getIndefiniteArticle(trimmedAdjective)} ${trimmedAdjective} ${withoutArticle}`;
}

function normalizeCharacterClause(fragment) {
  const text = String(fragment || "").trim();
  if (!text) return "";
  if (/^with\s+/i.test(text)) return `had ${text.replace(/^with\s+/i, "")}`;
  if (/^who\s+/i.test(text)) return text.replace(/^who\s+/i, "");
  return text;
}

function personalizeCharacterClause(fragment, gender) {
  const text = String(fragment || "").trim();
  if (!text) return "";
  if (gender === "girl") {
    return text
      .replace(/\btheir\b/g, "her")
      .replace(/\bthem\b/g, "her")
      .replace(/\bthey\b/g, "she");
  }
  if (gender === "boy") {
    return text
      .replace(/\btheir\b/g, "his")
      .replace(/\bthem\b/g, "him")
      .replace(/\bthey\b/g, "he");
  }
  return text;
}

function joinNarrativeClauses(clauses) {
  const validClauses = clauses.filter(Boolean);
  if (!validClauses.length) return "";
  if (validClauses.length === 1) return validClauses[0];
  if (validClauses.length === 2) return `${validClauses[0]} and ${validClauses[1]}`;
  return `${validClauses.slice(0, -1).join(", ")}, and ${validClauses[validClauses.length - 1]}`;
}

function buildDiscoveryReflection(revealMoment, discovery, name) {
  const revealText = String(revealMoment || "").trim();
  const discoveryText = String(discovery || "").trim().toLowerCase();
  if (!revealText) return "";
  if (!discoveryText || !revealText.toLowerCase().includes(discoveryText)) return revealText;

  return pickStoryVariant("discoveryReflection", [
    `In that quiet moment, everything suddenly made a little more sense to ${name}.`,
    `Seeing it there filled ${name} with a calm sense that the night had led them well.`,
    `For a moment, ${name} could feel that the gentle answer had been there all along.`,
    `The quiet discovery settled warmly in ${name}'s heart, as though the whole night had been gently guiding them there.`,
    `${name} paused with a soft smile, feeling the discovery fit into the adventure as neatly as a last little star in the sky.`,
  ], "generic", 4);
}

function buildComfortSetupLine(name) {
  return pickStoryVariant("comfortSetup", [
    `${name} could tell there was something gentle to understand tonight.`,
    `${name} felt calm, yet sensed the night still had something kind to show.`,
    `A quiet feeling told ${name} there was something gentle to discover before bedtime.`,
    `The night around ${name} felt soft and safe, but still full of one last little mystery before sleep.`,
    `${name} had the feeling that bedtime itself was trying to share one more quiet secret.`,
  ], "generic", 4);
}

function inferDiscoveryMechanism(discoveryText, goalText = "") {
  const discovery = String(discoveryText || "").trim().toLowerCase();
  const goal = String(goalText || "").trim().toLowerCase();

  if (/\b(map|compass|route|blueprint|marker|ticket|page|note|letter|clue|sign|path|trail)\b/.test(discovery)) {
    return {
      effectClause: "it showed the next safe turn with gentle certainty",
      routeClause: "showed the right way onward",
      clueClause: "showed exactly where to look next",
      solutionClause: "made the next part beautifully clear",
    };
  }

  if (/\b(lantern|light|glow|glowing|moon|star|sparkle|sparkling|firefl(?:y|ies)|sun|lamp|night-light)\b/.test(discovery)) {
    return {
      effectClause: "its soft light made the important next step easy to see",
      routeClause: "lit the way onward",
      clueClause: "lit up the clue they had been hoping for",
      solutionClause: "made the answer easier to see at last",
    };
  }

  if (/\b(song|lullaby|music|melody|whistle|bell|voice|hum|hummed|sing|sang)\b/.test(discovery)) {
    return {
      effectClause: "its gentle sound seemed to guide them exactly where they needed to go",
      routeClause: "sang a gentle path onward",
      clueClause: "sang the clue softly into place",
      solutionClause: "made the right answer feel calm and obvious",
    };
  }

  if (/\b(key|door|gate|lock)\b/.test(discovery)) {
    return {
      effectClause: goal.includes("open") ? "it made the hidden entrance ready at last" : "it unlocked the next gentle step in the adventure",
      routeClause: "opened the way ahead",
      clueClause: "opened the hidden answer they had been seeking",
      solutionClause: "made the way forward feel wonderfully clear",
    };
  }

  if (/\b(book|storybook|spellbook|scroll|recipe)\b/.test(discovery)) {
    return {
      effectClause: "inside was exactly the idea the night had been trying to share",
      routeClause: "showed the path in its quiet pages",
      clueClause: "revealed the clue they needed inside its quiet pages",
      solutionClause: "showed exactly what came next",
    };
  }

  if (/\b(ribbon|thread|yarn|colour|color|rainbow)\b/.test(discovery)) {
    return {
      effectClause: "it stretched the answer out clearly in front of them",
      routeClause: "marked the gentle way onward",
      clueClause: "showed the missing piece at last",
      solutionClause: "pulled the whole idea together beautifully",
    };
  }

  if (/\b(blanket|cushion|fort|nook|home|basket|burrow|nest)\b/.test(discovery)) {
    return {
      effectClause: "it made everything feel safe, close, and suddenly easier to understand",
      routeClause: "made the safe way feel clear",
      clueClause: "held the answer in the gentlest possible way",
      solutionClause: "made the whole problem feel softer and simpler",
    };
  }

  return {
    effectClause: goal.includes("discover") ? "it made the quiet answer feel close at last" : "it made the next gentle step feel clearer at once",
    routeClause: "made the way onward feel clear",
    clueClause: "made the clue easier to understand",
    solutionClause: "made the answer feel quietly clear",
  };
}

function goalUsesRouteLogic(goal) {
  const goalText = String(goal || "").trim().toLowerCase();
  return /(?:home|burrow|den|reef|nest|station|shore|lagoon|tower|basket|rainbow|trail)\b/.test(goalText)
    || /\b(back to|return|guide|bring|deliver|find (?:its|the) way)\b/.test(goalText);
}

function buildInferredDiscoveryEffect(goal, discoveryText) {
  const mechanism = inferDiscoveryMechanism(discoveryText, goal);
  const goalText = String(goal || "").trim().toLowerCase();
  if (!discoveryText) return "";

  if (goalUsesRouteLogic(goalText)) return mechanism.effectClause;
  if (/\b(find|discover|open|explore)\b/.test(goalText)) return mechanism.clueClause;
  if (/\b(make|create|build|finish|perform|share|light|restore|protect|help|complete|solve)\b/.test(goalText)) return mechanism.solutionClause;
  return mechanism.effectClause;
}

function normalizeDiscoveryEntry(entry, options = {}) {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    return {
      text: String(entry.text || entry.item || "").trim(),
      discoveryEffect: String(entry.discoveryEffect || "").trim(),
      payoffTemplates: Array.isArray(entry.payoffTemplates) ? entry.payoffTemplates : null,
    };
  }

  const text = String(entry || "").trim();
  const goal = String(options.goal || "").trim();

  return {
    text,
    discoveryEffect: buildInferredDiscoveryEffect(goal, text),
    payoffTemplates: buildInferredGoalPayoffTemplates(goal, text),
  };
}

function buildInferredGoalPayoffTemplates(goal, discoveryText = "") {
  const goalText = String(goal || "").trim().toLowerCase();
  if (!goalText) return null;
  const mechanism = inferDiscoveryMechanism(discoveryText, goalText);

  if (goalUsesRouteLogic(goalText)) {
    return [
      `{discovery} ${mechanism.routeClause}, and soon {name} and {companion} were able to {goal}.`,
      `With {discovery} helping the way feel clear, {name} and {companion} were able to {goal}.`,
      `At last, {name} saw how {discovery} could help them {goal}, because it ${mechanism.routeClause}.`,
    ];
  }

  if (/\b(find|discover|open|explore)\b/.test(goalText)) {
    return [
      `{discovery} ${mechanism.clueClause}, and soon {name} and {companion} were able to {goal}.`,
      `Using {discovery}, {name} and {companion} found exactly what they needed to {goal}.`,
      `At last, {name} understood how {discovery} could help them {goal}, and everything felt beautifully clear.`,
    ];
  }

  if (/\b(make|create|build|finish|perform|share|light|restore|protect|help|complete|solve|deliver|return)\b/.test(goalText)) {
    return [
      `{discovery} ${mechanism.solutionClause}, and soon {name} and {companion} were able to {goal}.`,
      `With {discovery} making the next part feel clear, {name} and {companion} were able to {goal}.`,
      `At last, {name} understood how {discovery} could help them {goal}, and the whole night felt beautifully complete.`,
    ];
  }

  return null;
}

function buildGoalPayoffLine(name, companion, goal, discovery, options = null) {
  const safeGoal = String(goal || "").trim();
  if (!safeGoal) return "";

  const discoveryMeta = normalizeDiscoveryEntry(discovery, { goal: safeGoal });
  const safeDiscovery = discoveryMeta.text || "what they had found";
  const inferredTemplates = buildInferredGoalPayoffTemplates(safeGoal);
  const templates = Array.isArray(options) && options.length
    ? options
    : discoveryMeta.payoffTemplates && discoveryMeta.payoffTemplates.length
      ? discoveryMeta.payoffTemplates
    : inferredTemplates && inferredTemplates.length
      ? inferredTemplates
    : [
        "With {discovery} to guide them, {name} and {companion} soon found the right way to {goal}.",
        "{discovery} helped {name} and {companion} know exactly how to {goal}.",
        "At last, {name} understood how {discovery} could help them {goal}, and the whole night felt beautifully complete.",
      ];

  const rendered = String(pick(templates))
    .replace(/\{name\}/g, name)
    .replace(/\{companion\}/g, companion)
    .replace(/\{goal\}/g, safeGoal)
    .replace(/\{discovery\}/g, safeDiscovery);

  return rendered.startsWith(safeDiscovery)
    ? capitalizeStoryFragment(rendered)
    : rendered;
}

function capitalizeStoryFragment(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeProceduralComparisonText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function goalNeedsExplicitMechanism(goal) {
  const goalText = String(goal || "").trim().toLowerCase();
  return /(?:home|burrow|den|reef|nest|station)\b/.test(goalText) || /\bback to\b/.test(goalText);
}

function paragraphShowsGoalMechanism(paragraph, goal, discovery) {
  const text = String(paragraph || "");
  const goalText = String(goal || "").trim();
  const discoveryText = String(discovery || "").trim();
  if (!goalText || !text.toLowerCase().includes(goalText.toLowerCase())) return false;
  if (discoveryText && !text.toLowerCase().includes(discoveryText.toLowerCase())) return false;

  return /\b(light|lights|lighting|lit|glow|glowing|guid(?:e|ed|es|ing)|show(?:ed|s|ing)?|lead(?:s|ing)?|led|point(?:ed|s|ing)?|path|track|trail|map|way|route|signal|song|call(?:ed|ing|s)?)\b/i.test(text);
}

function discoveryMentionAdvancesStory(paragraph, discovery) {
  const text = String(paragraph || "");
  const discoveryText = String(discovery || "").trim();
  if (!discoveryText) return false;

  const discoveryPattern = new RegExp(`\\b${escapeRegExp(discoveryText)}\\b`, "i");
  if (!discoveryPattern.test(text)) return false;

  return /\b(help(?:ed|ing)?|show(?:ed|ing)?|guide(?:d|ing)?|lead(?:s|ing)?|point(?:ed|ing)?|use(?:d|ing)?|underst(?:and|ands|ood|anding)|know|knew|deliver(?:ed|ing)?|return(?:ed|ing)?|restore(?:d|ing)?|open(?:ed|ing)?|bring(?:ing|brought)?|carry(?:ing|carried)?|share(?:d|ing)?|complete(?:d|ing)?|solve(?:d|ing)?|begin|began)\b/i.test(text);
}

function countProceduralBedtimeClosures(story) {
  const matches = String(story || "").match(/\b(climbed into bed|curled up comfortably|settled beneath the blankets|snuggled in|drifted into (?:a )?(?:deep, )?gentle sleep|settled into sleep|slipped into a calm, happy sleep)\b/gi);
  return matches ? matches.length : 0;
}

function detectProceduralAssemblyIssues(story, { name, discovery, goal, subj, customIdea } = {}) {
  const issues = [];
  const text = String(story || "");
  const paragraphs = text.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  const sentences = text.match(/[^.!?\n]+[.!?]+(?:["')\]]+)?/g) || [];

  if (/\{[A-Za-z][A-Za-z0-9_]*\}/.test(text)) {
    issues.push("placeholder");
  }

  if (/named [A-Z][a-z]+ who [^.!?\n]+, and [^.!?\n]+ was in /i.test(text)) {
    issues.push("awkward-opener");
  }

  if (countProceduralBedtimeClosures(text) > 1) {
    issues.push("duplicate-bedtime-close");
  }

  if (discovery) {
    const discoveryPattern = new RegExp(`\\b${escapeRegExp(discovery)}\\b`, "i");
    if (!discoveryPattern.test(text)) {
      issues.push("missing-discovery");
    }
  }

  if (goal && discovery && goalNeedsExplicitMechanism(goal)) {
    const hasMechanism = paragraphs.some((paragraph) => paragraphShowsGoalMechanism(paragraph, goal, discovery));
    if (!hasMechanism) {
      issues.push("weak-goal-mechanism");
    }
  }

  if (name && subj === "they") {
    const singularTheyPattern = new RegExp(`\\b${escapeRegExp(name)}\\b[^.\\n]{0,120}\\btheir\\b`, "i");
    if (singularTheyPattern.test(text)) {
      issues.push("named-singular-their");
    }
  }

  const seenSentences = new Set();
  for (const sentence of sentences) {
    const normalized = normalizeProceduralComparisonText(sentence);
    if (normalized.length < 25) continue;
    if (seenSentences.has(normalized)) {
      issues.push("duplicate-sentence");
      break;
    }
    seenSentences.add(normalized);
  }

  if (sentences.length >= 2 && hasRedundantMoodOverlap(sentences[0], sentences[1])) {
    issues.push("redundant-opening-mood");
  }

  for (let index = 1; index < paragraphs.length; index++) {
    const previousLead = extractTemporalLead(paragraphs[index - 1]);
    const currentLead = extractTemporalLead(paragraphs[index]);
    if (previousLead && currentLead && previousLead === currentLead) {
      issues.push("adjacent-temporal-repeat");
      break;
    }
  }

  if (discovery) {
    const discoveryPattern = new RegExp(`\\b${escapeRegExp(discovery)}\\b`, "i");
    for (let index = 1; index < paragraphs.length; index++) {
      if (
        discoveryPattern.test(paragraphs[index - 1]) &&
        discoveryPattern.test(paragraphs[index]) &&
        !discoveryMentionAdvancesStory(paragraphs[index], discovery)
      ) {
        issues.push("adjacent-discovery-repeat");
        break;
      }
    }
  }

  if (customIdea) {
    const ideaText = normalizeStoryIdea(customIdea).toLowerCase();
    const normalizedStory = text.toLowerCase();
    const ideaMentions = [ideaText, ...extractQuickWishFocusTerms(ideaText)]
      .filter(Boolean)
      .some((term) => normalizedStory.includes(term));
    const fidelityTerms = extractQuickWishFidelityTerms(ideaText);
    const missingFidelityTerms = fidelityTerms.filter((term) => {
      const pattern = new RegExp(`\b${escapeRegExp(term)}\b`, "i");
      return !pattern.test(text);
    });

    if (!ideaMentions) {
      issues.push("missing-custom-idea");
    } else if (isGenericFlyingWish(ideaText) && fidelityTerms.length && missingFidelityTerms.length === fidelityTerms.length) {
      issues.push("missing-custom-idea-detail");
    }
  }

  return issues;
}

function generateCharacter(name, gender) {
  const type =
    gender === "boy" ? "a little boy" :
    gender === "girl" ? "a little girl" :
    pick(neutralCharacterTypes);

  const personality = pick(personalities);
  const role = pick(roles);
  const magic = pick(magicTraits);
  const baseType = addAdjectiveToType(type, personality);
  const descriptiveClauses = [
    normalizeCharacterClause(personalizeCharacterClause(role, gender)),
    normalizeCharacterClause(personalizeCharacterClause(magic, gender)),
  ];
  const joinedClauses = joinNarrativeClauses(descriptiveClauses);

  return joinedClauses
    ? `${baseType} named ${name} who ${joinedClauses}`
    : `${baseType} named ${name}`;
}

function getSelectedChild() {
  const index = selectedChildIndex;
  if (index < 0 || index >= cachedChildren.length) return {};

  const child = cachedChildren[index] || {};
  const interestsArray = Array.isArray(child.interests)
    ? child.interests
    : String(child.interests || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

  return {
    name: child.name || "a little one",
    age: Number(child.age) || 5,
    gender: (child.gender || "neutral").toLowerCase(),
    interests: interestsArray,
    appearance: child.appearance || "",
  };
}

function selectChild(index) {
  selectedChildIndex = index;
  updateHomeChildCard();
  updateStreakDisplay();
  renderLibrary();
}

/**
 * Append gender and sibling context to the interests string so the AI
 * system prompt can personalise + age-match naturally. Kept within the
 * server's 200-char limit.
 */
function enrichInterestsWithContext(baseInterests, child, explicitSiblings = null) {
  const gender = (child.gender || "").toLowerCase();
  const genderLabel = gender === "girl" ? "girl" : gender === "boy" ? "boy" : "";
  // Include up to 4 siblings by name; beyond that summarise the rest.
  const allSiblings = Array.isArray(explicitSiblings) ? explicitSiblings : getSiblingsFor(child);
  const named = allSiblings.slice(0, 4);
  const extras = allSiblings.length - named.length;
  const siblingText = named
    .map((s) => {
      const rel = siblingRelation(s, gender);
      return s.age ? `${rel} ${formatName(s.name)} (${s.age})` : `${rel} ${formatName(s.name)}`;
    })
    .join(", ") + (extras > 0 ? `, +${extras} more` : "");

  let out = baseInterests || "";
  if (genderLabel) out = `${genderLabel}; ${out}`;
  if (siblingText) out = `${out}; siblings: ${siblingText}`;
  return out.slice(0, 200);
}

/**
 * Return the other registered children as "siblings" for story context.
 * Excludes the selected child, keeps name/age/gender only.
 */
function getSiblingsFor(child) {
  if (!child || !child.name) return [];
  return cachedChildren
    .filter((c) => c && c.name && c.name !== child.name)
    .map((c) => ({
      name: c.name,
      age: Number(c.age) || null,
      gender: (c.gender || "neutral").toLowerCase(),
    }));
}

/**
 * Render the Hero-mode sibling tickboxes for the currently selected child.
 * Hidden if there are no other children registered.
 */
function renderHeroSiblings() {
  const wrap = $("heroSiblingsWrap");
  const list = $("heroSiblings");
  if (!wrap || !list) return;

  const child = getSelectedChild();
  const siblings = getSiblingsFor(child);

  list.innerHTML = "";
  if (!child.name || child.name === "a little one" || siblings.length === 0) {
    wrap.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");
  const gender = child.gender || "neutral";
  siblings.forEach((s) => {
    const rel = siblingRelation(s, gender);
    const label = document.createElement("label");
    label.className = "sibling-option";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = s.name;
    cb.dataset.age = String(s.age || "");
    cb.dataset.gender = s.gender || "neutral";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = `Include ${formatName(s.name)}`;
    const metaSpan = document.createElement("span");
    metaSpan.className = "sibling-meta";
    metaSpan.textContent = s.age ? `(${rel}, ${s.age})` : `(${rel})`;
    label.appendChild(cb);
    label.appendChild(nameSpan);
    label.appendChild(metaSpan);
    list.appendChild(label);
  });
}

/** Return the names of siblings currently ticked in the Hero form. */
function getTickedHeroSiblings() {
  const list = $("heroSiblings");
  if (!list) return [];
  const boxes = list.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(boxes).map((cb) => ({
    name: cb.value,
    age: Number(cb.dataset.age) || null,
    gender: cb.dataset.gender || "neutral",
  }));
}

/** Update the series label + reset button for the currently selected child. */
function updateHeroSeriesLabel() {
  const label = $("heroSeriesLabel");
  const resetBtn = $("heroSeriesResetBtn");
  if (!label || !resetBtn) return;

  const child = getSelectedChild();
  if (!child.name || child.name === "a little one") {
    label.textContent = "Series: save a child profile to start one.";
    resetBtn.classList.add("hidden");
    return;
  }
  const series = cachedSeries[child.name];
  const nightCount = series?.nightCount || 0;
  if (nightCount === 0) {
    label.textContent = `Series: starting a new one for ${formatName(child.name)} tonight.`;
    resetBtn.classList.add("hidden");
  } else {
    const nextNight = nightCount + 1;
    const title = series?.lastTitle ? ` (last: "${series.lastTitle}")` : "";
    label.textContent = `Series: Night ${nextNight} for ${formatName(child.name)}${title}.`;
    resetBtn.classList.remove("hidden");
  }
}

/** Reset the series counter for the selected child (local + Firestore). */
async function resetHeroSeries() {
  const child = getSelectedChild();
  if (!child.name || child.name === "a little one") return;
  if (!confirm(`Start a brand-new series for ${formatName(child.name)}? Tonight will be Night 1.`)) return;

  delete cachedSeries[child.name];
  updateHeroSeriesLabel();

  if (!currentUser) return;
  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { [`series.${child.name}`]: null });
  } catch (e) {
    console.error("Reset series failed:", e);
  }
}

/** After a successful Hero generation, persist the next series state. */
async function advanceHeroSeries(childName, title, storyText) {
  if (!currentUser || !childName) return;
  const prev = cachedSeries[childName] || { nightCount: 0 };
  const summary = String(storyText || "").slice(0, 400);
  const next = {
    nightCount: (prev.nightCount || 0) + 1,
    lastTitle: title || prev.lastTitle || "",
    lastSummary: summary,
    lastSavedAt: new Date().toISOString(),
  };
  cachedSeries[childName] = next;
  updateHeroSeriesLabel();

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { [`series.${childName}`]: next });
  } catch (e) {
    console.error("Advance series failed:", e);
  }
}

// =============================================================================
// Sample Story (no-signup demo showcase)
// =============================================================================

const SAMPLE_STORY = {
  title: "Luna and the Moon Keeper",
  text: `Once upon a time, in a quiet valley where the stars came out one by one, there was a little girl named Luna.

Luna had always loved the moon. She waved to it every night through her bedroom window, and the moon seemed to wave back with a soft silver smile.

One evening, as Luna pressed her forehead to the cool glass, something magical happened. A small silver bird landed on her windowsill. Its feathers shimmered like moonlight, and in its tiny beak was a folded note.

Luna unfolded it carefully. "The moon needs a helper tonight," it read. "Will you come?"

Luna's heart glowed. She slipped on her slippers, opened her window, and the silver bird gently took her hand. Together, they drifted up — past the rooftops, past the sleepy clouds, all the way to a tiny floating harbour where the moon waited, round and warm.

"Thank you for coming, Luna," said the moon in a voice like a soft lullaby. "I've lost a little piece of my light, and I need someone brave and kind to help me find it."

Luna looked down. Far below, a single glowing pebble was resting in a field of sleeping daisies. "I see it!" she whispered.

She climbed gently into a boat made of starlight, and the silver bird steered them down, down, down, until Luna's toes touched the cool grass. The daisies yawned and nodded as she tiptoed past.

Luna picked up the glowing pebble. It was warm and soft, like a tiny heartbeat. She held it close to her chest and carried it carefully back to the boat.

When they returned, the moon smiled its biggest smile. "Thank you, Luna. You've given me back my gentle glow."

The moon placed the pebble softly into its own light, and the whole sky grew brighter and calmer. Then the moon leaned down and whispered, "Close your eyes, brave one. It's time to sleep now."

Luna closed her eyes. She felt the starlight boat drift gently home, past the clouds, past the rooftops, back through her window, back under her warm, soft blankets.

When she opened her eyes, she was tucked in tightly. The silver bird was perched on her pillow, nodding a sleepy goodnight.

Luna smiled, and the moon outside smiled back.

Then, carrying the memory of the little glowing pebble like a warm secret, Luna drifted into a deep, gentle sleep.`,
};

let isShowingSample = false;

function showSampleStory() {
  const readingMode = $("readingMode");
  const readingTitle = $("readingTitle");
  const readingText = $("readingText");
  const saveBtn = $("saveProgressBtn");
  if (!readingMode || !readingTitle || !readingText) return;

  isShowingSample = true;
  readingTitle.textContent = SAMPLE_STORY.title;
  readingText.textContent = SAMPLE_STORY.text;
  if (saveBtn) saveBtn.classList.add("hidden");

  // Apply saved reading preferences
  if (localStorage.getItem("readingDark") === "1") {
    readingMode.classList.add("dark");
  }
  const dyslexiaOn = localStorage.getItem("readingDyslexia") === "1";
  readingMode.classList.toggle("dyslexia", dyslexiaOn);

  readingMode.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  readingMode.scrollTop = 0;

  renderSampleCTA();
}

function renderSampleCTA() {
  let cta = document.getElementById("sampleCTA");
  if (cta) return;
  cta = document.createElement("div");
  cta.id = "sampleCTA";
  cta.className = "sample-cta-overlay";
  cta.innerHTML = `
    <p>Create stories like this for your own child</p>
    <button class="btn primary btn-lg" id="sampleCTABtn">Sign Up Free &mdash; 7-day trial</button>
  `;
  document.body.appendChild(cta);
  const btn = document.getElementById("sampleCTABtn");
  if (btn) btn.addEventListener("click", exitSampleStory);
}

function exitSampleStory() {
  const readingMode = $("readingMode");
  if (!readingMode) return;
  readingMode.classList.add("hidden");
  document.body.style.overflow = "";
  isShowingSample = false;
  const cta = document.getElementById("sampleCTA");
  if (cta) cta.remove();
  // Scroll the email field into view so signup is the obvious next step
  const emailInput = $("email");
  if (emailInput) {
    emailInput.focus({ preventScroll: true });
    emailInput.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// =============================================================================
// Free Trial (7 days, 7 stories, no Long Hero)
// =============================================================================

function daysBetween(isoA, isoB) {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

/** Initialise a trial record on first login if one does not yet exist. */
async function ensureTrialInitialised() {
  cachedTrial = {
    startedAt: new Date().toISOString(),
    storiesUsed: 0,
    status: "paid",
  };
}

/** Returns { active, expired, paid, daysLeft, storiesLeft } for the current user. */
function getTrialStatus() {
  return { active: false, expired: false, paid: true, daysLeft: Infinity, storiesLeft: Infinity };
}

/** Update the banner + paywall visibility based on current trial status. */
function renderTrialState() {
  const banner = $("trialBanner");
  const paywall = $("paywallCard");
  if (!banner || !paywall) return;

  const status = getTrialStatus();

  // Paid users: no banner, no paywall
  if (status.paid) {
    banner.classList.add("hidden");
    paywall.classList.add("hidden");
    lockLongHeroOption(false);
    return;
  }

  // Expired: hide banner, show paywall, lock long hero
  if (status.expired) {
    banner.classList.add("hidden");
    paywall.classList.remove("hidden");
    lockLongHeroOption(true);
    return;
  }

  // Active trial: show banner, hide paywall, lock long hero
  paywall.classList.add("hidden");
  lockLongHeroOption(true);
  const warn = status.daysLeft <= 2 || status.storiesLeft <= 2;
  banner.classList.toggle("warning", warn);
  const dayTxt = status.daysLeft === 1 ? "1 day" : `${status.daysLeft} days`;
  const storyTxt = status.storiesLeft === 1 ? "1 story" : `${status.storiesLeft} stories`;
  banner.textContent = `Free trial — ${dayTxt} left · ${storyTxt} remaining`;
  banner.classList.remove("hidden");
}

/** Disable or enable the "Long" option in the Hero length dropdown. */
function lockLongHeroOption(locked) {
  const select = $("heroLength");
  if (!select) return;
  const longOpt = select.querySelector('option[value="long"]');
  if (!longOpt) return;
  if (locked) {
    longOpt.disabled = true;
    longOpt.classList.add("option-locked");
    if (!longOpt.textContent.includes("Subscribe")) {
      longOpt.textContent = "Long (about 10 min read) — Subscribe to unlock";
    }
    // If currently selected, fall back to medium
    if (select.value === "long") select.value = "medium";
  } else {
    longOpt.disabled = false;
    longOpt.classList.remove("option-locked");
    longOpt.textContent = "Long (about 10 min read)";
  }
}

/** Call before any generate attempt. Returns true if allowed, false if gated. */
function canGenerateStory() {
  return true;
}

/** Increment the story counter after a successful generation. */
async function recordStoryUsed() {
  return;
}

/** Placeholder subscribe handler (payment wiring comes later). */
function handleSubscribe() {
  alert("Subscription coming soon. Payment will be wired in the next step.");
  // Future: open Stripe checkout, flip cachedTrial.status to "paid" on success.
}

/** Build a continuation header to prepend to customIdea on night 2+. */
function buildSeriesContinuationContext(childName) {
  const series = cachedSeries[childName];
  if (!series || !series.nightCount) return "";
  const nextNight = series.nightCount + 1;
  const titleLine = series.lastTitle
    ? `Previous title: "${String(series.lastTitle).trim()}".`
    : "";
  const summaryLine = series.lastSummary
    ? `Previous story summary: "${String(series.lastSummary).replace(/\s+/g, " ").trim().slice(0, 320)}".`
    : "";
  return [
    `This is Night ${nextNight} of ${formatName(childName)}'s ongoing bedtime series.`,
    "Keep the same core world logic, recurring companions, and gentle emotional continuity unless tonight's idea clearly changes part of the adventure.",
    titleLine,
    summaryLine,
  ].filter(Boolean).join(" ");
}

/**
 * Generate a complete procedural bedtime story.
 * Maintains consistent character, setting, companion, and tone throughout.
 */
/**
 * Format a list of names as natural English prose.
 * 1: "Finley"  2: "Finley and Luna"  3+: "Finley, Luna, and Max"
 */
function joinNamesNatural(names) {
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * Build a natural sibling sentence that scales from 1 to 5+ siblings.
 * Mentions up to 3 by name; beyond that summarises the rest as "brothers and sisters".
 */
function buildSiblingLine(name, gender, validSiblings) {
  if (!validSiblings.length) return null;

  const named = validSiblings.slice(0, 3).map((s) => formatName(s.name));
  const extras = validSiblings.length - named.length;

  if (validSiblings.length === 1) {
    const rel = siblingRelation(validSiblings[0], gender);
    return `${name}'s ${rel} ${named[0]} was nearby, and the two often shared bedtime adventures together.`;
  }

  // 2+ siblings — describe as a family group
  let list = joinNamesNatural(named);
  if (extras > 0) {
    list = `${list}, and ${extras} more little one${extras > 1 ? "s" : ""}`;
  }
  return `${name}'s brothers and sisters — ${list} — were close by too, always ready to share a gentle adventure.`;
}

function siblingRelation(sibling, mainGender) {
  const sg = (sibling?.gender || "").toLowerCase();
  if (sg === "girl") return "sister";
  if (sg === "boy") return "brother";
  // If the sibling's gender is unknown, use a gentle neutral term
  return mainGender === "girl" || mainGender === "boy" ? "sibling" : "sibling";
}

/**
 * Resolve pronouns for a child so every sentence stays grammatically
 * consistent with their gender. Falls back to the world's pronoun,
 * then to neutral "they/them/their".
 */
function resolvePronouns(child, worldPronoun) {
  const g = (child?.gender || "").toLowerCase();
  if (g === "girl") return { subj: "she", obj: "her", poss: "her" };
  if (g === "boy")  return { subj: "he",  obj: "him", poss: "his" };
  if (worldPronoun === "she") return { subj: "she", obj: "her", poss: "her" };
  if (worldPronoun === "he")  return { subj: "he",  obj: "him", poss: "his" };
  return { subj: "they", obj: "them", poss: "their" };
}

/**
 * Interpolate shared story placeholders used by the procedural templates.
 */
function fillPronouns(template, { name, companion, companionFull, discovery, gift, subj, obj, poss }) {
  const pair = companion ? `${name} and ${companion}` : name;
  const Pair = pair.charAt(0).toUpperCase() + pair.slice(1);
  return String(template || "")
    .replace(/\{Pair\}/g, Pair)
    .replace(/\{pair\}/g, pair)
    .replace(/\{name\}/g, name)
    .replace(/\{companionFull\}/g, companionFull || companion || "")
    .replace(/\{companion\}/g, companion || "")
    .replace(/\{discovery\}/g, discovery || "")
    .replace(/\{gift\}/g, gift || "")
    .replace(/\{Subj\}/g, subj.charAt(0).toUpperCase() + subj.slice(1))
    .replace(/\{subj\}/g, subj)
    .replace(/\{obj\}/g, obj)
    .replace(/\{poss\}/g, poss);
}

function deriveShortCompanionName(description) {
  const raw = String(description || "").trim().toLowerCase();
  if (!raw) return "a gentle friend";

  const withoutClause = raw.split(/\s+(?:with|who|that|whose|carrying|holding|watching|wearing|in)\s+/)[0];
  const withoutArticle = withoutClause.replace(/^(?:a|an|the)\s+/, "");
  const fillerWords = new Set([
    "kind", "little", "tiny", "gentle", "friendly", "sleepy", "cheerful",
    "clever", "calm", "cuddly", "brave", "wise", "helpful", "soft",
    "polite", "glowing", "warm", "small", "quiet", "baby",
  ]);
  const trailingRoleWords = new Set(["friend", "guide", "helper", "conductor", "coach", "sprite"]);
  const rolePreservingLeads = new Set([
    "moonlit", "shadow", "future", "royal", "classroom", "travel", "comfort",
    "library", "book", "badge-wearing", "paint-splashed", "map-reading",
    "clue-finding", "night-light", "teammate", "inventor", "ballet", "stage",
  ]);

  const words = withoutArticle.split(/\s+/).filter(Boolean);
  while (words.length > 1 && fillerWords.has(words[0])) {
    words.shift();
  }

  if (words.length >= 2 && trailingRoleWords.has(words[words.length - 1])) {
    const leadWord = words[words.length - 2];
    if (!rolePreservingLeads.has(leadWord)) {
      words.pop();
    }
  }

  return `the ${words.join(" ") || withoutArticle}`;
}

const recentStorySelections = {};

function rememberRecentSelection(key, value, maxEntries = 2) {
  if (!key || value === undefined || value === null) return;
  const history = recentStorySelections[key] || [];
  const next = [value, ...history.filter((entry) => entry !== value)].slice(0, maxEntries);
  recentStorySelections[key] = next;
}

function pickFreshValue(values, historyKey, maxEntries = 2) {
  if (!Array.isArray(values) || values.length === 0) return undefined;
  const history = recentStorySelections[historyKey] || [];
  const pool = values.filter((value) => !history.includes(value));
  const choice = pick(pool.length ? pool : values);
  rememberRecentSelection(historyKey, choice, maxEntries);
  return choice;
}

function pickStoryValue(bucket, primary, fallback, worldKey = "generic", maxEntries = 2) {
  const historyKey = `${worldKey || "generic"}:${bucket}`;
  if (Array.isArray(primary) && primary.length) {
    return pickFreshValue(primary, historyKey, maxEntries);
  }
  if (typeof primary === "string" && primary.trim()) {
    return primary;
  }
  if (Array.isArray(fallback) && fallback.length) {
    return pickFreshValue(fallback, `generic:${bucket}`, maxEntries);
  }
  return fallback;
}

function pickStoryVariant(bucket, options, worldKey = "generic", maxEntries = 3) {
  if (!Array.isArray(options) || !options.length) return undefined;
  return pickFreshValue(options, `${worldKey || "generic"}:variant:${bucket}`, maxEntries);
}

function lowerSentenceStart(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function buildHomewardEnding(returnLine, homecomingMoment, worldKey = "generic") {
  return pickStoryVariant("homewardEnding", [
    `${returnLine} ${homecomingMoment}`,
    `${homecomingMoment} ${returnLine}`,
    `${returnLine} On the way back, ${lowerSentenceStart(homecomingMoment)}`,
    `${homecomingMoment} The path back felt easy now, as though the night already knew exactly where home was.`,
  ], worldKey, 4);
}

function buildSleepClosing(name, sleepLine, finalSleepLine, worldKey = "generic") {
  return pickStoryVariant("sleepClosing", [
    `${sleepLine} ${finalSleepLine}`,
    `${finalSleepLine} ${sleepLine}`,
    `${sleepLine} The room around ${name} felt warm, still, and ready for rest.`,
    `${finalSleepLine} ${name} let that peaceful feeling stay close as sleep came gently nearer.`,
  ], worldKey, 4);
}

function buildEmergencyFallbackStory(childName = "A Little One") {
  const name = formatName(childName || "A Little One");
  return [
    `Once upon a time, ${name} stepped into a soft and sleepy little adventure where everything felt calm and safe.`,
    `${name} found a gentle path, a kind little friend, and just enough courage to follow the quiet magic of the night.`,
    `Soon, the path led ${name} to a small, comforting answer that made the whole adventure feel warm, clear, and complete.`,
    `When it was time to go home, ${name} carried that peaceful feeling all the way back to bed and drifted gently into rest.`,
  ].join("\n\n");
}

function buildSafeFallbackWishHope(name, wish) {
  const normalizedWish = normalizeStoryIdea(wish).toLowerCase();
  if (!normalizedWish) {
    return `${name} had one soft hope tonight: to follow the kind night and see where it might gently lead.`;
  }

  const alreadyFramed = /\b(fly|flying|swim|swimming|help|helping|meet|meeting|find|finding|discover|discovering|explore|exploring|be|being|become|becoming)\b/.test(normalizedWish);
  if (alreadyFramed) {
    return `${name} had one soft hope tonight: to follow the feeling of ${normalizedWish} and see where the kind night might lead.`;
  }

  const withArticle = /^(a|an|the)\s+/i.test(normalizedWish) ? normalizedWish : `a ${normalizedWish}`;
  return `${name} had one soft hope tonight: to step into a bedtime adventure about ${withArticle} and see where the kind night might lead.`;
}

function buildSafeProceduralQuickStory(child = {}, world = null, siblings = []) {
  const rawName = child.name || "a little one";
  const name = formatName(rawName);
  const wish = normalizeStoryIdea(child.customIdea || child.heroIdea || child.interests?.[0] || "a gentle bedtime surprise");
  const setting = pick([
    "a silver path under the stars",
    "a quiet moonlit garden",
    "a sleepy little trail of lantern light",
    "a soft night world full of calm surprises",
  ]);
  const companionChoice = pick([
    { full: "a kind little firefly", short: "the firefly" },
    { full: "a soft-footed bunny", short: "the bunny" },
    { full: "a gentle owl friend", short: "the owl friend" },
    { full: "a tiny star guide", short: "the star guide" },
  ]);
  const companionFull = companionChoice.full;
  const companion = companionChoice.short;
  const challenge = pick([
    "a winding path that seemed to turn just a little each time ${name} looked at it",
    "a small hill of silver stones that needed slow and careful steps",
    "a hush-filled bridge over a stream that shone like moonlight",
    "a patch of tall grass where the night whispered in every direction",
  ]).replace("${name}", name);
  const discovery = pick([
    "a tiny glowing treasure tucked beneath the leaves",
    "a warm little light waiting at the heart of the path",
    "a moon-bright secret that had been guiding the whole adventure",
    "a small, shining answer resting quietly in the night",
  ]);
  const gift = pick([
    "a ribbon of moonlight",
    "a tiny silver star",
    "a little lantern of calm light",
    "a soft glowing charm",
  ]);
  const siblingLine = Array.isArray(siblings) && siblings.length
    ? `${name} knew that family love was always nearby, even in the quietest part of the adventure.`
    : "";

  return [
    `Once upon a time, ${name} was in ${setting}, where everything felt calm, safe, and ready for a gentle adventure.`,
    siblingLine,
    buildSafeFallbackWishHope(name, wish),
    `Before long, ${name} met ${companionFull}, and somehow the whole path ahead felt friendlier straight away.`,
    `${name} and ${companion} went on together, one quiet step at a time, listening to the hush of the world around them.`,
    `Along the way they came to ${challenge}. They paused, took a calm breath, and kept going with gentle courage.`,
    `Soon they found ${discovery}, and in that small shining moment the whole adventure began to make warm and lovely sense.`,
    `${name} felt a peaceful understanding settle in, as though the night had been guiding ${name} kindly from the very beginning.`,
    `With that discovery close in heart, ${name} knew exactly how to keep going, and everything that had seemed uncertain now felt simple and beautifully clear.`,
    `Nothing loud was needed to celebrate. The quiet itself felt happy, and the night around ${name} seemed proud in its own gentle way.`,
    `Before it was time to go home, ${name} was given ${gift}, a quiet reminder that soft courage can stay close even after the adventure ends.`,
    `The way back felt easier than before, as though the path itself remembered every brave and thoughtful step.`,
    `${name} settled into bed with a soft smile, carrying that peaceful memory close while the whole room grew still and sleepy around them.`,
  ].filter(Boolean).join("\n\n");
}

function joinStoryBeats(...beats) {
  return beats
    .flat()
    .map((beat) => String(beat || "").trim())
    .filter(Boolean)
    .join(" ");
}

function splitParagraphIntoSentences(paragraph) {
  const text = String(paragraph || "").trim();
  if (!text) return [];

  const sentences = text.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) || [text];
  return sentences.map((sentence) => sentence.trim()).filter(Boolean);
}

function expandStoryPartsToMinimum(parts, minimumParagraphs = 8) {
  const expanded = parts.filter(Boolean);
  if (expanded.length >= minimumParagraphs) return expanded;

  for (let index = 0; index < expanded.length && expanded.length < minimumParagraphs; index++) {
    const sentences = splitParagraphIntoSentences(expanded[index]);
    if (sentences.length <= 1) continue;

    expanded.splice(index, 1, ...sentences);
    index += sentences.length - 1;
  }

  return expanded;
}

function countTextOccurrences(haystack, needle) {
  const source = String(haystack || "");
  const query = String(needle || "");
  if (!query) return 0;
  return source.split(query).length - 1;
}

function ensureGoalPayoffParagraph(parts, goal, payoffParagraph) {
  const normalizedParts = parts.filter(Boolean);
  if (!goal || !payoffParagraph) return normalizedParts;

  const joined = normalizedParts.join("\n\n");
  if (countTextOccurrences(joined, goal) >= 2) return normalizedParts;
  if (normalizedParts.some((part) => String(part).includes(payoffParagraph))) return normalizedParts;

  const insertAt = Math.max(normalizedParts.length - 2, 1);
  normalizedParts.splice(insertAt, 0, payoffParagraph);
  return normalizedParts;
}

function extractTemporalLead(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return "";

  const match = value.match(/^(once upon a time|a moment later|just then|that was when|soon|before long|along the way|at last|before leaving|after a while|by then|from just ahead|nearby|waiting beside the path|a soft sound made|when the adventure had settled into a peaceful hush)/i);
  return match ? match[1].toLowerCase() : "";
}

function extractMoodKeywords(text) {
  return new Set(
    (String(text || "").toLowerCase().match(/\b(calm|safe|warm|peaceful|still|quiet|soft|gentle|cosy|cozy|sleepy|kind)\b/g) || [])
  );
}

function hasRedundantMoodOverlap(firstText, secondText) {
  const first = extractMoodKeywords(firstText);
  const second = extractMoodKeywords(secondText);
  if (!first.size || !second.size) return false;

  let overlap = 0;
  for (const word of first) {
    if (second.has(word)) overlap += 1;
  }

  return overlap >= 2;
}

function pickStorySentenceAvoidingLead(bucket, options, worldKey = "generic", avoidTexts = [], maxEntries = 3) {
  if (!Array.isArray(options) || !options.length) return "";

  const blockedLeads = new Set(
    avoidTexts
      .map((text) => extractTemporalLead(text))
      .filter(Boolean)
  );

  const filtered = options.filter((option) => {
    const lead = extractTemporalLead(option);
    return !lead || !blockedLeads.has(lead);
  });

  return pickFreshValue(filtered.length ? filtered : options, `${worldKey || "generic"}:variant:${bucket}`, maxEntries);
}

function pickCompatibleOpeningAddon(openingText, primary, fallback, worldKey = "generic", maxEntries = 3) {
  const source = Array.isArray(primary) && primary.length
    ? primary
    : Array.isArray(fallback) && fallback.length
      ? fallback
      : [];

  if (!source.length) return typeof primary === "string" && primary.trim() ? primary : "";

  const filtered = source.filter((option) => !hasRedundantMoodOverlap(openingText, option));
  return pickFreshValue(filtered.length ? filtered : source, `${worldKey || "generic"}:openingAddonCompatible`, maxEntries);
}

function pickWorldValue(value, fallback) {
  if (Array.isArray(value) && value.length) return pick(value);
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function resolveWorldKey(world) {
  if (!world) return "";
  if (typeof world.worldKey === "string" && world.worldKey) return world.worldKey;
  for (const [key, value] of Object.entries(themeWorlds)) {
    if (value === world) return key;
  }
  return "";
}

function getWorldStoryKit(world) {
  const worldKey = resolveWorldKey(world);
  return worldKey ? worldStoryKits[worldKey] || null : null;
}

function detectFlyingSceneKey(idea = "") {
  const lower = normalizeStoryIdea(idea).toLowerCase();
  if (/dolphin|dolphins|whale|whales|ocean|sea|waves/.test(lower)) return "ocean";
  if (/desert|camel|camels|egypt|pyramid|pyramids|nile/.test(lower)) return "desert";
  if (/mountain|mountains|eagle|eagles|snow|snowy/.test(lower)) return "mountains";
  if (/jungle|parrot|parrots|rainforest|canopy|toucan/.test(lower)) return "jungle";
  if (/field|fields|farm|sheep|horse|horses|pony|ponies|meadow/.test(lower)) return "meadow";
  if (/forest|woods|woodland|owl|owls|treetops/.test(lower)) return "forest";
  if (/castle|palace|tower|royal|kingdom/.test(lower)) return "castle";
  if (/island|islands|lagoon|coast|shore|cliffs/.test(lower)) return "islands";
  if (/city|town|rooftops|lanterns|street/.test(lower)) return "city";
  return "random";
}

function getFlyingSceneLibrary() {
  return {
    ocean: {
      world: {
        settings: ["a moonlit sky above the ocean where dolphins leapt and whales sang softly below"],
        companions: ["a little moon-kite who loved the sea breeze", "a calm silver-winged gull who knew the wind paths"],
        discoveries: ["a sky-lantern glowing above the whale-song", "a silver feather-map pointing over the moonlit waves"],
        challenge: ["a swirl of sea-wind that curved above the moonlit waves"],
        goal: ["glide above the waves and help a little whale find its family song"],
      },
      backdrop: {
        setup: "over the moonlit ocean while dolphins leapt and whales glimmered below",
        inciting: "The whole adventure seemed to open above the moonlit ocean, where dolphins leapt and whales moved like silver shadows below.",
        action: "With {companion} close by, {name} glided in a slow, peaceful arc above the waves, watching dolphins dance and a whale trail shimmer through the water below.",
        midpoint: "{name} kept flying gently above the sea, noticing the quiet splash of dolphins, the slow song of whales, and the silver path of moonlight on the water.",
        payoff: "By the end of the journey, {name} had truly flown above the ocean in the calm, magical way first imagined, and the sight of dolphins and whales below helped {companion} and {name} {goal}.",
      },
    },
    desert: {
      world: {
        settings: ["a warm twilight sky above golden dunes where sleepy camels wandered below"],
        companions: ["a friendly sand-star bird", "a gentle little cloud guide drifting over the dunes"],
        discoveries: ["a glowing feather-map leading toward a moonlit oasis", "a ribbon of wind curling over the camel trail below"],
        challenge: ["a warm ribbon of desert wind above the drifting dunes"],
        goal: ["follow the wind to a moonlit oasis before the camels settled to sleep"],
      },
      backdrop: {
        setup: "over golden desert dunes where sleepy camels padded below",
        inciting: "The whole adventure seemed to open over glowing desert sands, where sleepy camels moved in gentle lines beneath the evening sky.",
        action: "With {companion} close by, {name} floated through the air in a calm, magical way, drifting above golden dunes and watching quiet camels wander below.",
        midpoint: "{name} kept flying in the gentlest way, high above the desert, noticing moonlit sand ripples, tiny caravan lights, and the calm shapes of camels below.",
        payoff: "By the end of the journey, {name} had truly flown over the desert in the calm, magical way first imagined, and the peaceful sight of camels below helped {companion} and {name} {goal}.",
      },
    },
    mountains: {
      world: {
        settings: ["a silver-blue sky above snowy mountains where quiet eagles glided on the wind"],
        companions: ["a small snow-feathered sky guide", "a patient cloud bird who knew every mountain current"],
        discoveries: ["a star-lantern hovering above the peaks", "a wind-map shining beside the highest ridge"],
        challenge: ["a high curling breeze weaving between the quiet mountain peaks"],
        goal: ["carry a gentle star-message across the mountains before the last light faded"],
      },
      backdrop: {
        setup: "above snowy mountains where quiet eagles glided on the wind",
        inciting: "The whole adventure seemed to open across a silver-blue mountain sky, where quiet eagles glided and snowy peaks shone softly below.",
        action: "With {companion} close by, {name} drifted through the air in a slow, peaceful arc above the mountains, following the gentlest wind-paths.",
        midpoint: "{name} kept flying softly above the peaks, watching far-off eagles, bright snowlines, and cloud-shadows slide over the mountains below.",
        payoff: "By the end of the journey, {name} had truly flown above the mountains in the calm, magical way first imagined, and the stillness of that high sky helped {companion} and {name} {goal}.",
      },
    },
    jungle: {
      world: {
        settings: ["a calm evening sky above a jungle canopy where parrots tucked themselves in below"],
        companions: ["a tiny wind-parrot with emerald feathers", "a soft cloud bird who glided above the treetops"],
        discoveries: ["a glowing feather-path above the canopy", "a little lantern of sky-light above the treetop leaves"],
        challenge: ["a winding drift of warm air above the whispering treetops"],
        goal: ["follow the sky path until the parrots' treetop lanterns glowed below"],
      },
      backdrop: {
        setup: "above a calm jungle canopy where parrots tucked themselves in for the night",
        inciting: "The whole adventure seemed to open over the jungle canopy, where treetops swayed softly and parrots settled into the leaves below.",
        action: "With {companion} close by, {name} soared in a slow, peaceful curve above the treetops, watching the green world below grow quiet and golden.",
        midpoint: "{name} kept flying softly above the jungle, noticing sleepy parrots, winding rivers, and lantern-like flowers glowing below the leaves.",
        payoff: "By the end of the journey, {name} had truly flown above the jungle in the calm, magical way first imagined, and that peaceful view helped {companion} and {name} {goal}.",
      },
    },
    meadow: {
      world: {
        settings: ["a soft cloud path above green fields where sheep and little horses looked tiny below"],
        companions: ["a gentle skylark guide", "a little cloud rabbit floating on the breeze"],
        discoveries: ["a wind-ribbon curling over the quiet fields", "a glowing sky charm above the moonlit meadow"],
        challenge: ["a long drifting bend in the evening breeze above the fields"],
        goal: ["circle over the fields and find the glowing place where the night breeze wanted them to land"],
      },
      backdrop: {
        setup: "above green fields where sheep and little horses looked tiny below",
        inciting: "The whole adventure seemed to open over a patchwork of quiet fields, where tiny sheep and little horses moved softly below the evening sky.",
        action: "With {companion} close by, {name} drifted along a soft cloud path above the fields, watching the peaceful shapes below grow silver in the moonlight.",
        midpoint: "{name} kept flying gently over the meadows, noticing sleepy sheep, little horses, and winding hedgerows below.",
        payoff: "By the end of the journey, {name} had truly flown above the fields in the calm, magical way first imagined, and that peaceful view helped {companion} and {name} {goal}.",
      },
    },
    forest: {
      world: {
        settings: ["a moonlit sky above a whispering forest where owls glided between the treetops below"],
        companions: ["a gentle owl guide", "a soft little cloud fox riding the breeze"],
        discoveries: ["a lantern-feather shining above the treetops", "a silver wind-path curling over the forest canopy"],
        challenge: ["a hush of cool air weaving between the tallest trees"],
        goal: ["follow the wind above the woods and find the glowing clearing hidden among the trees"],
      },
      backdrop: {
        setup: "above a whispering forest where owls glided between the treetops below",
        inciting: "The whole adventure seemed to open above the moonlit woods, where owls crossed between the treetops and silver clearings glowed below.",
        action: "With {companion} close by, {name} glided over the forest in a slow, peaceful arc, watching the treetops sway softly beneath.",
        midpoint: "{name} kept flying gently above the woods, noticing owl-wings, moonlit leaves, and little clearings brightening below.",
        payoff: "By the end of the journey, {name} had truly flown above the forest in the calm, magical way first imagined, and the peaceful woods below helped {companion} and {name} {goal}.",
      },
    },
    castle: {
      world: {
        settings: ["a silver evening sky above castle towers and royal gardens glowing quietly below"],
        companions: ["a little ribbon-winged bird", "a calm cloud swan drifting past the towers"],
        discoveries: ["a glowing feather-map above the palace roofs", "a tiny lantern star hovering over the tallest tower"],
        challenge: ["a curling breeze around the castle towers"],
        goal: ["follow the sky path above the castle and find the tower window glowing with a gentle secret"],
      },
      backdrop: {
        setup: "above silver castle towers where royal gardens shimmered softly below",
        inciting: "The whole adventure seemed to open above a moonlit castle, where quiet towers rose into the sky and royal gardens glimmered below.",
        action: "With {companion} close by, {name} floated through the air above the palace roofs, following the breeze past turrets and soft lantern-light.",
        midpoint: "{name} kept flying gently above the castle, noticing silvery rooftops, secret balconies, and moonlit garden paths below.",
        payoff: "By the end of the journey, {name} had truly flown above the castle in the calm, magical way first imagined, and that royal view helped {companion} and {name} {goal}.",
      },
    },
    islands: {
      world: {
        settings: ["a glowing sky above little islands and silver lagoons scattered across the sea below"],
        companions: ["a bright-winged seabird guide", "a tiny cloud dolphin-shaped kite"],
        discoveries: ["a shining sky-lantern above the lagoon", "a silver feather-path drifting from island to island"],
        challenge: ["a curling breeze between the little island cliffs"],
        goal: ["follow the sky path above the islands and find the lagoon that glowed like a lantern"],
      },
      backdrop: {
        setup: "above little islands and silver lagoons scattered peacefully below",
        inciting: "The whole adventure seemed to open over little islands and shining lagoons, where the sea below looked like a patchwork of sleepy silver lights.",
        action: "With {companion} close by, {name} glided between soft clouds above the islands, watching quiet shores and little coves drift below.",
        midpoint: "{name} kept flying gently over the islands, noticing moonlit lagoons, tiny beaches, and winding shorelines below.",
        payoff: "By the end of the journey, {name} had truly flown above the islands in the calm, magical way first imagined, and that peaceful view helped {companion} and {name} {goal}.",
      },
    },
    city: {
      world: {
        settings: ["a calm night sky above lantern-lit rooftops and quiet city streets glowing below"],
        companions: ["a gentle rooftop starling", "a little lantern-kite who knew the sleeping city"],
        discoveries: ["a glowing sky note drifting above the rooftops", "a silver feather-map tracing the quiet streets below"],
        challenge: ["a swirl of warm air above the lantern-lit rooftops"],
        goal: ["glide above the rooftops and follow the sky note to the quiet place where it belonged"],
      },
      backdrop: {
        setup: "above lantern-lit rooftops where the quiet city glowed softly below",
        inciting: "The whole adventure seemed to open over a sleeping city, where rooftops, chimneys, and little lanterns glowed warmly below.",
        action: "With {companion} close by, {name} drifted in a gentle curve above the rooftops, watching the quiet streets shine softly below.",
        midpoint: "{name} kept flying gently above the city, noticing lanterns, rooftop gardens, and silver streets winding below.",
        payoff: "By the end of the journey, {name} had truly flown above the city in the calm, magical way first imagined, and the quiet lights below helped {companion} and {name} {goal}.",
      },
    },
  };
}

function buildFlyingWorldVariant(idea = "") {
  const sceneKey = detectFlyingSceneKey(idea);
  const sceneLibrary = getFlyingSceneLibrary();
  const availableSceneKeys = Object.keys(sceneLibrary);
  const resolvedSceneKey = sceneKey === "random"
    ? pickFreshValue(availableSceneKeys, "flying:sceneKey", 6)
    : sceneKey;
  const variant = sceneLibrary[resolvedSceneKey] || sceneLibrary.meadow;
  return {
    ...themeWorlds.flying,
    ...variant.world,
    worldKey: "flying",
    flyingSceneKey: resolvedSceneKey,
    pronoun: "they",
  };
}

function pickFlyingBackdrop(idea = "", sceneKey = "") {
  const detectedSceneKey = sceneKey || detectFlyingSceneKey(idea);
  const sceneLibrary = getFlyingSceneLibrary();
  const availableSceneKeys = Object.keys(sceneLibrary);
  const resolvedSceneKey = detectedSceneKey === "random"
    ? pickFreshValue(availableSceneKeys, "flying:backdropSceneKey", 6)
    : detectedSceneKey;
  return (sceneLibrary[resolvedSceneKey] || sceneLibrary.meadow).backdrop;
}

function normalizeStoryIdea(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildOfflineIdeaArc(name, companion, customIdea, goal, flyingSceneKey = "") {
  const idea = normalizeStoryIdea(customIdea);
  if (!idea) return null;

  const lower = idea.toLowerCase();

  if (/\bfly|flying|glide|gliding|soar|soaring\b/.test(lower)) {
    const backdrop = pickFlyingBackdrop(lower, flyingSceneKey);
    return {
      setupLine: `${name} had one special hope tonight: to fly in a calm, magical way ${backdrop.setup} and ${goal}.`,
      incitingLine: backdrop.inciting,
      actionLine: backdrop.action
        .replaceAll("{name}", name)
        .replaceAll("{companion}", companion),
      midpointLine: backdrop.midpoint.replaceAll("{name}", name),
      payoffLine: backdrop.payoff
        .replaceAll("{name}", name)
        .replaceAll("{companion}", companion)
        .replaceAll("{goal}", goal),
      title: `${name} and the Gentle Flying Adventure`,
    };
  }

  if (/\bsuperhero|hero|cape|power|powers\b/.test(lower)) {
    return {
      setupLine: `${name} knew tonight's story was about being a gentle hero and ${goal}.`,
      incitingLine: `Even before the adventure fully began, ${name} could feel that tonight would call for a quiet kind of bravery.`,
      actionLine: `Staying close to ${companion}, ${name} moved on with the steady heart of a hero who knew that kindness could be a real superpower.`,
      midpointLine: `Each new step gave ${name} another chance to be exactly the kind of hero the night needed: calm, thoughtful, and ready to help.`,
      payoffLine: `By the end, ${name} had truly become the gentle hero the adventure had been asking for, and that brave kindness helped them ${goal}.`,
      title: `${name} and the Quiet Hero Mission`,
    };
  }

  if (/\bswim|swimming|sea|ocean|underwater\b/.test(lower)) {
    return {
      setupLine: `${name} set out with one soft, exciting idea in mind: to swim through a magical bedtime adventure and ${goal}.`,
      incitingLine: `The night seemed to ripple open around that idea, inviting ${name} onward in the gentlest possible way.`,
      actionLine: `With ${companion} nearby, ${name} moved through the adventure as though swimming through a calm, dreamlike world.`,
      midpointLine: `${name} let the journey flow gently onward, as though every quiet step were part of a peaceful bedtime swim.`,
      payoffLine: `By the end of the adventure, ${name} had truly lived that lovely swimming dream, and it helped them ${goal}.`,
      title: `${name} and the Moonlit Swim`,
    };
  }

  return {
    setupLine: `Tonight's whole adventure began with one beautiful idea: ${idea}. ${name} knew the night was going to shape itself around it.`,
    incitingLine: `As the adventure opened, ${name} could feel that the idea of ${idea} was no longer just a thought — it was becoming real in the gentlest way.`,
    actionLine: `Step by step, ${name} and ${companion} followed the quiet path of that idea, letting it become a real part of the journey.`,
    midpointLine: `The deeper ${name} went into the adventure, the more ${idea} seemed woven into every soft and thoughtful part of it.`,
    payoffLine: `By the end, ${name} had truly lived the idea of ${idea} in a calm, bedtime-safe way, and it helped them ${goal}.`,
    title: `${name}'s Special Bedtime Adventure`,
  };
}

function buildProceduralTitle(name, { mode = "random", customIdea = "", worldKey = "", world = null } = {}) {
  const formattedName = formatName(name || "A Little One");
  const ideaArc = buildOfflineIdeaArc(formattedName, "a gentle friend", customIdea, "complete a gentle bedtime quest", world?.flyingSceneKey || "");
  if (mode === "hero" && ideaArc?.title) return ideaArc.title;

  const settingHint = String(pickWorldValue(world?.settings, "")).toLowerCase();
  const goalHint = String(pickWorldValue(world?.goal, "")).toLowerCase();

  const keywordTitleSets = [
    {
      test: /school|classroom|playground|first day/,
      titles: [
        `${formattedName} and the Brave First Day`,
        `${formattedName} and the Classroom Secret`,
        `${formattedName}'s School-Day Courage`,
      ],
    },
    {
      test: /train|rail|station|engine/,
      titles: [
        `${formattedName} and the Lullaby Train`,
        `${formattedName} and the Lantern Line Home`,
        `${formattedName}'s Sleepy Station Journey`,
      ],
    },
    {
      test: /goalpost|goal|football|kick|score|match/,
      titles: [
        `${formattedName} and the Last Gentle Goal`,
        `${formattedName}'s Moonlit Match`,
        `${formattedName} and the Quiet Winning Kick`,
      ],
    },
    {
      test: /road|raceway|car|track|wheel|drive/,
      titles: [
        `${formattedName} and the Moonlit Road Home`,
        `${formattedName} and the Sleepy Little Speedway`,
        `${formattedName}'s Gentle Racing Night`,
      ],
    },
    {
      test: /art|paint|studio|colour|canvas|brush/,
      titles: [
        `${formattedName} and the Painted Moonlight`,
        `${formattedName}'s Quiet Colour Adventure`,
        `${formattedName} and the Sleeping Canvas`,
      ],
    },
  ];

  const matchedTitleSet = keywordTitleSets.find(({ test }) => test.test(`${settingHint} ${goalHint}`));
  if (matchedTitleSet) {
    return pickStoryVariant("proceduralTitle", matchedTitleSet.titles, worldKey || "generic", 5);
  }

  const themedTitles = {
    superheroes: `${formattedName} and the Gentle Hero Adventure`,
    princesses: `${formattedName} and the Moonlit Palace Secret`,
    space: `${formattedName} and the Sleepy Star Journey`,
    flying: `${formattedName} and the Gentle Flying Adventure`,
    robots: `${formattedName} and the Little Robot Mystery`,
    animals: `${formattedName} and the Woodland Goodnight`,
    magic: `${formattedName} and the Quiet Magic Trail`,
    bedtime: `${formattedName} and the Perfect Goodnight`,
  };

  if (themedTitles[worldKey]) return themedTitles[worldKey];

  return pickStoryVariant("proceduralTitle", [
    `${formattedName}'s Bedtime Story`,
    `${formattedName} and the Gentle Night Adventure`,
    `${formattedName} and the Quiet Moonlight Path`,
    `${formattedName}'s Little Goodnight Journey`,
  ], worldKey || "generic", 5);
}

function generateQuickStory(child = {}, world = null, siblings = [], attempt = 1) {
  const rawName = child.name || "a little one";
  const name = formatName(rawName);
  const age = Number(child.age) || 5;
  const gender = child.gender || "neutral";
  const requestedLength = String(child.requestedLength || child.length || "medium").trim().toLowerCase();
  const customIdea = normalizeStoryIdea(child.customIdea || child.heroIdea || "");
  const effectiveWorld = resolveWorldKey(world) === "flying"
    ? buildFlyingWorldVariant(customIdea || child.interests?.join(" ") || "")
    : world;
  const worldKey = resolveWorldKey(effectiveWorld) || "generic";

  // Build a sibling mention that scales to families of any size (1–5+ kids)
  const validSiblings = (siblings || [])
    .filter((s) => s && s.name && s.name !== rawName);
  const siblingLine = buildSiblingLine(name, gender, validSiblings);

  const character = generateCharacter(name, gender);
  const worldStoryKit = getWorldStoryKit(effectiveWorld);

  // Consistent world elements — chosen once, used throughout
  const setting = pickStoryValue("setting", effectiveWorld?.settings, settings, worldKey, 3);
  const companionObj = pickStoryValue("companion", effectiveWorld?.companions, companions, worldKey, 3);
  // Support both old string companions (from worlds) and new {full,short} objects
  const companionFull = typeof companionObj === "string" ? companionObj : companionObj.full;
  const companion = typeof companionObj === "string"
    ? deriveShortCompanionName(companionObj)
    : companionObj.short;
  const discoveryEntry = pickStoryValue("discoveryItem", effectiveWorld?.discoveries, discoveries, worldKey, 3);
  const challenge = pickStoryValue("challenge", effectiveWorld?.challenge, softChallenges, worldKey, 3);
  const goal = pickStoryValue("goal", effectiveWorld?.goal, ["complete a gentle bedtime quest"], worldKey, 3);
  const discoveryMeta = normalizeDiscoveryEntry(discoveryEntry, { goal });
  const discovery = discoveryMeta.text;
  const discoveryLead = capitalizeStoryFragment(discovery);
  const { subj, obj, poss } = resolvePronouns(child, effectiveWorld?.pronoun);
  const pronoun = subj; // kept for legacy uses below
  const fillCtx = { name, companion, companionFull, subj, obj, poss };
  const opening = fillPronouns(
    `${pickStoryValue("opening", worldStoryKit?.openings, openings, worldKey, 3)} ${pickStoryValue("openingAddon", worldStoryKit?.openingAddons, openingAddons, worldKey, 3)}`,
    fillCtx
  );

  const calming = pickStoryValue("calmingAction", null, calmingActions, worldKey, 3);
  const gift = fillPronouns(pickStoryValue("magicGift", null, magicGifts, worldKey, 3), fillCtx);
  const returnLine = fillPronouns(pickStoryValue("returnTransition", worldStoryKit?.returnTransitions, returnTransitions, worldKey, 3), fillCtx);
  const sleepLine = fillPronouns(pickStoryValue("sleepEnding", null, sleepEndings, worldKey, 3), fillCtx);
  const inciting = fillPronouns(pickStoryValue("inciting", worldStoryKit?.incitingMoments, incitingMoments, worldKey, 3), fillCtx);
  const companionIntro = fillPronouns(pickStoryValue("companionIntro", worldStoryKit?.companionIntros, companionIntros, worldKey, 3), fillCtx);
  const clueMoment = fillPronouns(pickStoryValue("clueMoment", worldStoryKit?.clueMoments, clueMoments, worldKey, 3), fillCtx);
  const helperMoment = fillPronouns(pickStoryValue("helperMoment", worldStoryKit?.helperMoments, helperMoments, worldKey, 3), fillCtx);
  const revealMoment = fillPronouns(pickStoryValue("revealMoment", worldStoryKit?.revealMoments, revealMoments, worldKey, 3), { ...fillCtx, discovery });
  const discoveryReflection = buildDiscoveryReflection(revealMoment, discovery, name);
  const resolutionMoment = fillPronouns(pickStoryValue("resolutionMoment", worldStoryKit?.resolutionMoments, resolutionMoments, worldKey, 3), fillCtx);
  const quietCelebration = fillPronouns(pickStoryValue("quietCelebration", worldStoryKit?.quietCelebrations, quietCelebrations, worldKey, 3), fillCtx);
  const homecomingMoment = fillPronouns(pickStoryValue("homecomingMoment", worldStoryKit?.homecomingMoments, homecomingMoments, worldKey, 3), fillCtx);
  const storyShape = customIdea
    ? "quest"
    : pickStoryValue("storyShape", worldStoryKit?.storyShapes, ["quest", "helper", "discovery", "comfort"], worldKey, 2);
  const goalPayoffLine = buildGoalPayoffLine(name, companion, goal, discoveryEntry, worldStoryKit?.goalPayoffOptions);
  const ideaArc = buildOfflineIdeaArc(name, companion, customIdea, goal, effectiveWorld?.flyingSceneKey || "");
  const openingGoalLine = pickStoryVariant("openingGoal", [
    `${name} had one gentle goal tonight: ${goal}.`,
    `Tonight, ${name} hoped to ${goal}.`,
    `${name} set out with one calm hope in mind: ${goal}.`,
    `${name} wanted the night to help them ${goal}.`,
  ], worldKey, 4);
  const neutralFeelingLine = pickStoryVariant("neutralFeeling", [
    `${name} felt that tonight was going to be special.`,
    `${name} had the quiet feeling that something gentle was about to begin.`,
    `There was something about the night that made ${name} feel calm, curious, and ready.`,
    `The stillness around ${name} made everything feel as though a gentle surprise might be waiting close by.`,
    `${name} could feel the sort of quiet wonder that only appears when the world is almost ready for sleep.`,
  ], worldKey, 4);

  // Interest line — connects to the child's real interests or the world goal
  let interestLine = neutralFeelingLine;
  if (world) {
    interestLine = openingGoalLine;
  } else {
    const enhancedInterests = enhanceInterests(child);
    if (enhancedInterests.length) {
      const interest = formatInterest(pick(enhancedInterests));
      const options = [
        `${name} had always loved ${interest}`,
        `${name} really enjoyed ${interest}`,
        `${name} had always had a special love for ${interest}`,
        `Thinking about ${interest} always made ${name} smile`,
        `${name} could never resist the thought of ${interest}`,
        `Thinking about ${interest} always made ${name} feel especially happy`,
      ];
      interestLine = `${pick(options)}, and tonight seemed full of gentle possibility.`;
    }
  }

  const gentleActionOptions = [
    `${name} and ${companion} followed the path together, one calm step at a time.`,
    `With ${companion} close by, ${name} moved forward, feeling safe and steady.`,
    `${name} stayed close to ${companion}, listening to the soft sounds of the night.`,
    `${name} and ${companion} kept going together, letting the quiet world show them the way.`,
    `Side by side, ${name} and ${companion} moved onward with calm hearts and careful steps.`,
    `${name} and ${companion} let the night unfold around them slowly, trusting each gentle clue that appeared.`,
    `Keeping close to ${companion}, ${name} followed the quiet rhythm of the adventure without any need to hurry.`,
  ];

  // Subject stays plural — the child and companion discover together
  const discoveryOptions = [
    `Soon, ${name} and ${companion} found ${discovery}, and its quiet meaning began to make the next step clear.`,
    `Before long, they found ${discovery}, glowing softly in the night as though it had come to help.`,
    `At the end of the path, ${name} and ${companion} noticed ${discovery}, calm and welcoming, as though it had been waiting for them.`,
    `${name} and ${companion} soon came upon ${discovery}, and the whole adventure suddenly made gentler, clearer sense.`,
    `${discoveryLead} lay waiting ahead, right where the night had led them.`,
  ];

  if (discoveryMeta.discoveryEffect) {
    discoveryOptions.unshift(
      `Soon, ${name} and ${companion} found ${discovery}, and ${discoveryMeta.discoveryEffect}.`,
      `Before long, they came upon ${discovery}, and ${discoveryMeta.discoveryEffect}.`
    );
  }

  const closingMagicOptions = [
    `As a special gift, ${name} received ${gift} — a gentle reminder of quiet courage.`,
    `Before leaving, ${name} was given ${gift}, and everything felt peaceful.`,
    `${name} tucked away ${gift}, knowing its soft magic would stay close.`,
    `${name} carried home ${gift}, certain it would help this gentle adventure stay close in memory.`,
    `For one last quiet surprise, ${name} was given ${gift}, and it felt thoughtful and true.`,
    `As the adventure softened toward bedtime, ${name} was given ${gift}, and it felt like a little promise to remember the night by.`,
  ];

  const themedGentleAction = fillPronouns(
    pickStoryValue("gentleAction", worldStoryKit?.gentleActionOptions, gentleActionOptions, worldKey, 3),
    fillCtx
  );
  const themedDiscovery = fillPronouns(
    pickStoryValue("discoveryBeat", worldStoryKit?.discoveryOptions, discoveryOptions, worldKey, 3),
    { ...fillCtx, discovery }
  );
  const themedClosingMagic = fillPronouns(
    pickStoryValue("closingMagic", worldStoryKit?.closingMagicOptions, closingMagicOptions, worldKey, 3),
    { ...fillCtx, gift }
  );
  const challengeIsAbstract = !/^(?:a|an|the)\b/i.test(String(challenge || "").trim());
  const buildChallengeBeat = (concreteOptions, abstractOptions) => pick(challengeIsAbstract ? abstractOptions : concreteOptions);
  const nextStepLine = pickStoryVariant("nextStep", [
    `${inciting} Feeling calm and curious, ${name} decided to continue.`,
    `${inciting} ${name} took a slow breath and followed where the gentle mystery led.`,
    `${inciting} With a quiet spark of wonder, ${name} kept going to see what the night was trying to show.`,
    `${inciting} The adventure seemed to open a little wider, and ${name} stepped forward with a calm, hopeful heart.`,
  ], worldKey, 4);
  const challengeOptionsConcrete = [
    `Along the way, ${name} and ${companion} reached ${challenge}. ${calming}`,
    `Soon, ${name} and ${companion} came to ${challenge}. ${calming}`,
    `Before long, the path led ${name} and ${companion} to ${challenge}. ${calming}`,
  ];
  const challengeOptionsAbstract = [
    `Along the way, ${name} and ${companion} faced a gentle challenge: ${challenge}. ${calming}`,
    `Soon, it was time for ${name} and ${companion} to meet a gentle challenge: ${challenge}. ${calming}`,
    `Before long, the night asked ${name} and ${companion} for something brave and calm: ${challenge}. ${calming}`,
  ];
  const challengeLine = buildChallengeBeat(
    challengeOptionsConcrete,
    challengeOptionsAbstract
  );
  const helperChallengeOptionsConcrete = [
    `Soon, ${name} and ${companion} reached ${challenge}. ${calming}`,
    `Before long, ${name} and ${companion} came to ${challenge}. ${calming}`,
    `The path soon brought ${name} and ${companion} to ${challenge}. ${calming}`,
  ];
  const helperChallengeOptionsAbstract = [
    `Soon, ${name} and ${companion} faced a gentle challenge: ${challenge}. ${calming}`,
    `Before long, it was time for ${name} and ${companion} to handle something important: ${challenge}. ${calming}`,
    `The path soon asked ${name} and ${companion} for calm bravery: ${challenge}. ${calming}`,
  ];
  const helperChallengeLine = buildChallengeBeat(
    helperChallengeOptionsConcrete,
    helperChallengeOptionsAbstract
  );
  const comfortLeadLine = pickStoryVariant("comfortLead", [
    `${inciting} ${name} listened carefully and followed the feeling of quiet magic ahead.`,
    `${inciting} ${name} stayed still for a moment, then followed the gentle feeling onward.`,
    `${inciting} Trusting the calm glow ahead, ${name} moved forward one quiet step at a time.`,
    `${inciting} ${name} let the gentle feeling settle, then followed it with slow and steady steps.`,
  ], worldKey, 4);
  const comfortChallengeOptionsConcrete = [
    `Before long, ${name} and ${companion} came to ${challenge}. ${calming}`,
    `Soon, the path led ${name} and ${companion} to ${challenge}. ${calming}`,
    `A little further on, ${name} and ${companion} reached ${challenge}. ${calming}`,
  ];
  const comfortChallengeOptionsAbstract = [
    `Before long, ${name} and ${companion} faced something gentle but important: ${challenge}. ${calming}`,
    `Soon, the night asked ${name} and ${companion} for a little calm courage: ${challenge}. ${calming}`,
    `A little further on, ${name} and ${companion} reached a quiet turning point: ${challenge}. ${calming}`,
  ];
  const comfortChallengeLine = buildChallengeBeat(
    comfortChallengeOptionsConcrete,
    comfortChallengeOptionsAbstract
  );
  const finalSleepLine = pickStoryVariant("finalSleep", [
    `The room stayed quiet, holding the last little glow of the adventure.`,
    `${name} kept that gentle memory close as the night grew still.`,
    `Outside, everything felt settled, as though the story itself were whispering goodnight.`,
    `The adventure faded softly into the hush of bedtime.`,
    `Even the quiet around ${name} seemed to settle down for sleep.`,
    `The last little feeling of wonder rested softly nearby as bedtime grew stiller and stiller.`,
  ], worldKey, 4);

  // Simpler structure for very young children (age 4 and under)
  const simple = age <= 4;
  const shortStory = requestedLength === "short";
  const longStory = requestedLength === "long";
  const firstLine = pickStoryVariant(
    "openingFrame",
    simple
      ? [
          `Once upon a time, ${name} was in ${setting}. ${opening}`,
          `In ${setting}, ${name} was ready for a quiet little adventure. ${opening}`,
          `${opening} In ${setting}, ${name} felt calm, safe, and ready to see what the night might bring.`,
        ]
      : [
          `Once upon a time, ${character} was in ${setting}. ${opening}`,
          `In ${setting}, there was ${character}. ${opening}`,
          `${opening} In ${setting}, ${character} was ready for a gentle adventure.`,
        ],
    worldKey,
    4
  );
  const extraLongBeat = longStory
    ? (ideaArc?.midpointLine || `${clueMoment} ${helperMoment}`)
    : "";
  const coreInterestLine = ideaArc?.setupLine || interestLine;
  const coreNextStepLine = ideaArc?.incitingLine || nextStepLine;
  const coreActionLine = ideaArc?.actionLine || themedGentleAction;
  const corePayoffLine = ideaArc?.payoffLine || goalPayoffLine;
  const homewardEnding = buildHomewardEnding(returnLine, homecomingMoment, worldKey);
  const sleepClosing = buildSleepClosing(name, sleepLine, finalSleepLine, worldKey);
  const storyCadence = pickStoryVariant("storyCadence", ["classic", "companion-first", "reordered"], worldKey, 3);
  const shortBlueprint = pickStoryVariant(
    "shortBlueprint",
    customIdea
      ? ["quest-glide", "quest-trail", "quest-homecoming"]
      : ["trail", "mission", "glow", "homecoming"],
    worldKey,
    4
  );
  const mediumBlueprint = pickStoryVariant(
    "mediumBlueprint",
    customIdea
      ? ["quest-classic", "quest-lilt", "quest-echo"]
      : ["classic", "lantern", "ripple", "returning", "mood", "drift"],
    worldKey,
    4
  );
  const storyBlueprint = shortStory ? shortBlueprint : mediumBlueprint;
  const combinedResolution = joinStoryBeats(resolutionMoment, quietCelebration);
  const softResolution = pickStoryVariant("softResolution", [resolutionMoment, quietCelebration, combinedResolution], worldKey, 4);
  const discoveryWithReflection = joinStoryBeats(themedDiscovery, shortStory ? "" : discoveryReflection);
  const includeGiftBeat = !shortStory && pickStoryVariant("giftPresence", ["with-gift", "no-gift", "with-gift", "no-gift"], worldKey, 4) === "with-gift";
  const payoffStyle = pickStoryVariant("payoffStyle", ["explicit", "implicit", "blended"], worldKey, 4);
  const explicitOutcomeBeat = payoffStyle === "implicit" ? "" : goalPayoffLine;
  const outcomeResolutionBeat = joinStoryBeats(explicitOutcomeBeat, payoffStyle === "blended" ? softResolution : combinedResolution);
  const optionalGiftBeat = includeGiftBeat ? themedClosingMagic : "";
  const giftAndHomeward = joinStoryBeats(optionalGiftBeat, homewardEnding);
  const clueTrailLine = joinStoryBeats(interestLine, clueMoment);
  const helperLeadLine = joinStoryBeats(inciting, helperMoment);
  const actionThenChallenge = joinStoryBeats(coreActionLine, challengeLine);
  const comfortIntroLine = buildComfortSetupLine(name);

  let parts;

  if (customIdea) {
    if (storyBlueprint === "quest-glide") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        joinStoryBeats(coreInterestLine, companionIntro),
        joinStoryBeats(coreNextStepLine, coreActionLine),
        extraLongBeat,
        challengeLine,
        discoveryWithReflection,
        joinStoryBeats(corePayoffLine, combinedResolution),
        giftAndHomeward,
        sleepClosing,
      ];
    } else if (storyBlueprint === "quest-homecoming") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        coreInterestLine,
        companionIntro,
        joinStoryBeats(coreNextStepLine, challengeLine),
        extraLongBeat,
        joinStoryBeats(themedDiscovery, corePayoffLine),
        combinedResolution,
        joinStoryBeats(homewardEnding, sleepClosing),
      ];
    } else if (storyBlueprint === "quest-lilt") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        companionIntro,
        coreInterestLine,
        coreActionLine,
        coreNextStepLine,
        extraLongBeat,
        challengeLine,
        discoveryWithReflection,
        corePayoffLine,
        combinedResolution,
        shortStory ? "" : themedClosingMagic,
        homewardEnding,
        sleepClosing,
      ];
    } else if (storyBlueprint === "quest-echo") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        joinStoryBeats(coreInterestLine, coreNextStepLine),
        companionIntro,
        joinStoryBeats(coreActionLine, extraLongBeat),
        challengeLine,
        discoveryWithReflection,
        joinStoryBeats(corePayoffLine, shortStory ? combinedResolution : ""),
        shortStory ? "" : combinedResolution,
        giftAndHomeward,
        sleepClosing,
      ];
    } else {
      parts = storyCadence === "companion-first"
        ? [
            firstLine,
            shortStory ? "" : siblingLine,
            companionIntro,
            coreInterestLine,
            coreActionLine,
            coreNextStepLine,
            extraLongBeat,
            challengeLine,
            themedDiscovery,
            shortStory ? "" : discoveryReflection,
            corePayoffLine,
            combinedResolution,
            shortStory ? "" : themedClosingMagic,
            homewardEnding,
            sleepClosing,
          ]
        : [
            firstLine,
            shortStory ? "" : siblingLine,
            coreInterestLine,
            companionIntro,
            coreNextStepLine,
            coreActionLine,
            extraLongBeat,
            challengeLine,
            themedDiscovery,
            shortStory ? "" : discoveryReflection,
            corePayoffLine,
            combinedResolution,
            shortStory ? "" : themedClosingMagic,
            homewardEnding,
            sleepClosing,
          ];
    }
  } else if (storyShape === "helper") {
    if (storyBlueprint === "mission") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        joinStoryBeats(interestLine, companionIntro),
        joinStoryBeats(helperLeadLine, themedGentleAction),
        extraLongBeat,
        helperChallengeLine,
        joinStoryBeats(discoveryWithReflection, explicitOutcomeBeat),
        softResolution,
        giftAndHomeward,
        sleepClosing,
      ];
    } else if (storyBlueprint === "homecoming") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        companionIntro,
        helperLeadLine,
        helperChallengeLine,
        joinStoryBeats(themedDiscovery, goalPayoffLine),
        combinedResolution,
        joinStoryBeats(homewardEnding, sleepClosing),
      ];
    } else if (storyBlueprint === "lantern") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        joinStoryBeats(companionIntro, interestLine),
        helperLeadLine,
        joinStoryBeats(themedGentleAction, extraLongBeat),
        helperChallengeLine,
        discoveryWithReflection,
        goalPayoffLine,
        combinedResolution,
        giftAndHomeward,
        sleepClosing,
      ];
    } else {
      parts = storyCadence === "reordered"
        ? [
            firstLine,
            shortStory ? "" : siblingLine,
            helperLeadLine,
            companionIntro,
            interestLine,
            themedGentleAction,
            extraLongBeat,
            helperChallengeLine,
            themedDiscovery,
            shortStory ? "" : discoveryReflection,
            goalPayoffLine,
            combinedResolution,
            homewardEnding,
            sleepClosing,
          ]
        : [
            firstLine,
            shortStory ? "" : siblingLine,
            interestLine,
            companionIntro,
            helperLeadLine,
            themedGentleAction,
            extraLongBeat,
            helperChallengeLine,
            themedDiscovery,
            shortStory ? "" : discoveryReflection,
            goalPayoffLine,
            combinedResolution,
            homewardEnding,
            sleepClosing,
          ];
    }
  } else if (storyShape === "discovery") {
    if (storyBlueprint === "trail") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        clueTrailLine,
        companionIntro,
        joinStoryBeats(themedGentleAction, extraLongBeat),
        challengeLine,
        discoveryWithReflection,
        joinStoryBeats(explicitOutcomeBeat, shortStory ? softResolution : ""),
        shortStory ? "" : softResolution,
        giftAndHomeward,
        sleepClosing,
      ];
    } else if (storyBlueprint === "glow") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        companionIntro,
        joinStoryBeats(clueTrailLine, themedDiscovery),
        joinStoryBeats(themedGentleAction, challengeLine),
        shortStory ? "" : discoveryReflection,
        outcomeResolutionBeat,
        giftAndHomeward,
        sleepClosing,
      ];
    } else {
      parts = storyCadence === "companion-first"
        ? [
            firstLine,
            shortStory ? "" : siblingLine,
            companionIntro,
            clueTrailLine,
            themedGentleAction,
            extraLongBeat,
            challengeLine,
            themedDiscovery,
            shortStory ? "" : discoveryReflection,
            goalPayoffLine,
            shortStory ? "" : themedClosingMagic,
            homewardEnding,
            sleepClosing,
          ]
        : [
            firstLine,
            shortStory ? "" : siblingLine,
            clueTrailLine,
            companionIntro,
            themedGentleAction,
            extraLongBeat,
            challengeLine,
            themedDiscovery,
            shortStory ? "" : discoveryReflection,
            goalPayoffLine,
            shortStory ? "" : themedClosingMagic,
            homewardEnding,
            sleepClosing,
          ];
    }
  } else if (storyShape === "comfort") {
    if (storyBlueprint === "glow") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        joinStoryBeats(comfortIntroLine, companionIntro),
        joinStoryBeats(comfortLeadLine, extraLongBeat),
        comfortChallengeLine,
        discoveryWithReflection,
        softResolution,
        giftAndHomeward,
        sleepClosing,
      ];
    } else if (storyBlueprint === "homecoming") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        comfortIntroLine,
        companionIntro,
        comfortChallengeLine,
        joinStoryBeats(themedDiscovery, combinedResolution),
        joinStoryBeats(homewardEnding, sleepClosing),
      ];
    } else {
      parts = storyCadence === "reordered"
        ? [
            firstLine,
            shortStory ? "" : siblingLine,
            comfortLeadLine,
            comfortIntroLine,
            companionIntro,
            extraLongBeat,
            comfortChallengeLine,
            themedDiscovery,
            shortStory ? "" : discoveryReflection,
            combinedResolution,
            shortStory ? "" : themedClosingMagic,
            homewardEnding,
            sleepClosing,
          ]
        : [
            firstLine,
            shortStory ? "" : siblingLine,
            comfortIntroLine,
            companionIntro,
            comfortLeadLine,
            extraLongBeat,
            comfortChallengeLine,
            themedDiscovery,
            shortStory ? "" : discoveryReflection,
            combinedResolution,
            shortStory ? "" : themedClosingMagic,
            homewardEnding,
            sleepClosing,
          ];
    }
  } else {
    if (storyBlueprint === "trail") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        clueTrailLine,
        companionIntro,
        joinStoryBeats(nextStepLine, themedGentleAction),
        extraLongBeat,
        challengeLine,
        discoveryWithReflection,
        outcomeResolutionBeat,
        giftAndHomeward,
        sleepClosing,
      ];
    } else if (storyBlueprint === "mission") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        joinStoryBeats(interestLine, companionIntro),
        joinStoryBeats(nextStepLine, themedGentleAction),
        actionThenChallenge,
        joinStoryBeats(themedDiscovery, explicitOutcomeBeat),
        softResolution,
        optionalGiftBeat,
        joinStoryBeats(homewardEnding, sleepClosing),
      ];
    } else if (storyBlueprint === "glow") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        companionIntro,
        joinStoryBeats(interestLine, nextStepLine),
        joinStoryBeats(themedGentleAction, extraLongBeat),
        challengeLine,
        discoveryWithReflection,
        outcomeResolutionBeat,
        giftAndHomeward,
        sleepClosing,
      ];
    } else if (storyBlueprint === "homecoming") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        interestLine,
        companionIntro,
        joinStoryBeats(nextStepLine, challengeLine),
        joinStoryBeats(themedDiscovery, explicitOutcomeBeat),
        softResolution,
        joinStoryBeats(homewardEnding, sleepClosing),
      ];
    } else if (storyBlueprint === "lantern") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        companionIntro,
        interestLine,
        nextStepLine,
        joinStoryBeats(themedGentleAction, extraLongBeat),
        challengeLine,
        discoveryWithReflection,
        explicitOutcomeBeat,
        softResolution,
        optionalGiftBeat,
        homewardEnding,
        sleepClosing,
      ];
    } else if (storyBlueprint === "ripple") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        joinStoryBeats(interestLine, nextStepLine),
        companionIntro,
        themedGentleAction,
        joinStoryBeats(extraLongBeat, challengeLine),
        discoveryWithReflection,
        outcomeResolutionBeat,
        giftAndHomeward,
        sleepClosing,
      ];
    } else if (storyBlueprint === "returning") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        interestLine,
        joinStoryBeats(companionIntro, nextStepLine),
        actionThenChallenge,
        joinStoryBeats(themedDiscovery, explicitOutcomeBeat),
        softResolution,
        optionalGiftBeat,
        joinStoryBeats(homewardEnding, sleepClosing),
      ];
    } else if (storyBlueprint === "mood") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        joinStoryBeats(companionIntro, interestLine),
        joinStoryBeats(nextStepLine, themedGentleAction),
        challengeLine,
        discoveryWithReflection,
        softResolution,
        joinStoryBeats(homewardEnding, sleepClosing),
      ];
    } else if (storyBlueprint === "drift") {
      parts = [
        firstLine,
        shortStory ? "" : siblingLine,
        clueTrailLine,
        companionIntro,
        joinStoryBeats(themedGentleAction, challengeLine),
        joinStoryBeats(themedDiscovery, softResolution),
        optionalGiftBeat,
        joinStoryBeats(homewardEnding, sleepClosing),
      ];
    } else {
      parts = storyCadence === "companion-first"
        ? [
            firstLine,
            shortStory ? "" : siblingLine,
            companionIntro,
            interestLine,
            nextStepLine,
            themedGentleAction,
            extraLongBeat,
            challengeLine,
            themedDiscovery,
            explicitOutcomeBeat,
            softResolution,
            optionalGiftBeat,
            homewardEnding,
            sleepClosing,
          ]
        : storyCadence === "reordered"
          ? [
              firstLine,
              shortStory ? "" : siblingLine,
              clueTrailLine,
              companionIntro,
              themedGentleAction,
              extraLongBeat,
              challengeLine,
              themedDiscovery,
              shortStory ? "" : discoveryReflection,
              explicitOutcomeBeat,
              softResolution,
              optionalGiftBeat,
              homewardEnding,
              sleepClosing,
            ]
          : [
              firstLine,
              shortStory ? "" : siblingLine,
              interestLine,
              nextStepLine,
              companionIntro,
              themedGentleAction,
              extraLongBeat,
              challengeLine,
              themedDiscovery,
              explicitOutcomeBeat,
              softResolution,
              optionalGiftBeat,
              homewardEnding,
              sleepClosing,
            ];
    }
  }

  const expandedParts = shortStory ? parts.filter(Boolean) : expandStoryPartsToMinimum(parts, 8);
  const normalizedParts = shortStory
    ? expandedParts
    : ensureGoalPayoffParagraph(expandedParts, goal, explicitOutcomeBeat || corePayoffLine);
  const story = normalizedParts.join("\n\n");
  const assemblyIssues = detectProceduralAssemblyIssues(story, { name, discovery, goal, subj, customIdea });

  if (!assemblyIssues.length || attempt >= 4) {
    return story;
  }

  return generateQuickStory(child, world, siblings, attempt + 1);
}

// =============================================================================
// Story Formatting
// =============================================================================

function formatStory(text) {
  if (!text) return "";
  return String(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((p) => p.replace(/\s+([,.;!?])/g, "$1").replace(/\s{2,}/g, " ").trim())
    .filter((p) => p.length > 0)
    .join("\n\n");
}

// =============================================================================
// Reading Mode
// =============================================================================

function enterReadingMode() {
  const readingMode = $("readingMode");
  const readingTitle = $("readingTitle");
  const readingText = $("readingText");
  const saveBtn = $("saveProgressBtn");
  if (!readingMode || !readingTitle || !readingText) return;

  readingTitle.textContent = currentStoryTitle || "Your Story";
  readingText.textContent = formatStory(currentStoryText);

  // Show save button only for AI-generated Hero stories
  if (saveBtn) {
    saveBtn.classList.toggle("hidden", currentStoryTitle === "Quick Story");
  }

  // Restore saved preferences (dark mode + dyslexia font) before showing
  if (localStorage.getItem("readingDark") === "1") {
    readingMode.classList.add("dark");
  }
  const dyslexiaOn = localStorage.getItem("readingDyslexia") === "1";
  readingMode.classList.toggle("dyslexia", dyslexiaOn);
  const dyslexiaBtn = $("toggleDyslexiaFont");
  if (dyslexiaBtn) dyslexiaBtn.classList.toggle("active", dyslexiaOn);

  readingMode.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // Prevent background scroll

  // Restore saved scroll position
  const saved = localStorage.getItem("readingScroll");
  if (saved && !isNaN(saved)) {
    readingMode.scrollTop = parseInt(saved, 10);
  }

  // Record streak for the selected child (the "listened" moment)
  const child = getSelectedChild();
  if (child?.name && child.name !== "a little one") {
    recordStreakForChild(child.name);
  }
}

function exitReadingMode() {
  const readingMode = $("readingMode");
  if (!readingMode) return;

  // Persist scroll position
  localStorage.setItem("readingScroll", readingMode.scrollTop || 0);
  readingMode.classList.add("hidden");
  document.body.style.overflow = ""; // Restore scroll
}

function setupReadingModeEvents() {
  const backBtn = $("backFromReading");
  const toggleBtn = $("toggleReadingMode");
  const dyslexiaBtn = $("toggleDyslexiaFont");
  const saveProgressBtn = $("saveProgressBtn");
  const readingMode = $("readingMode");
  if (!readingMode) return;

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (isShowingSample) exitSampleStory();
      else exitReadingMode();
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      readingMode.classList.toggle("dark");
      localStorage.setItem("readingDark", readingMode.classList.contains("dark") ? "1" : "0");
    });
  }

  if (dyslexiaBtn) {
    dyslexiaBtn.addEventListener("click", () => {
      readingMode.classList.toggle("dyslexia");
      const on = readingMode.classList.contains("dyslexia");
      localStorage.setItem("readingDyslexia", on ? "1" : "0");
      dyslexiaBtn.classList.toggle("active", on);
    });
  }

  if (saveProgressBtn) {
    saveProgressBtn.addEventListener("click", () => {
      localStorage.setItem("readingScroll", readingMode.scrollTop || 0);
      saveProgressBtn.textContent = "Saved!";
      setTimeout(() => {
        saveProgressBtn.textContent = "Continue Tomorrow";
      }, 2000);
    });
  }

  // Escape key closes reading mode
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !readingMode.classList.contains("hidden")) {
      exitReadingMode();
    }
  });
}

// =============================================================================
// UI — Page Navigation
// =============================================================================

const ALL_PAGES = ["authScreen", "pageHome", "pageChildren", "pageQuick", "pageToday", "pageHero", "pageLibrary", "pageSettings", "pagePrivacy", "pageTerms", "storyCard"];

function navigateTo(page) {
  previousPage = currentPage;
  currentPage = page;

  // Map page name to DOM id
  const pageIdMap = {
    auth: "authScreen",
    home: "pageHome",
    children: "pageChildren",
    quick: "pageQuick",
    today: "pageToday",
    hero: "pageHero",
    library: "pageLibrary",
    settings: "pageSettings",
    privacy: "pagePrivacy",
    terms: "pageTerms",
    story: "storyCard",
  };

  const targetId = pageIdMap[page];
  ALL_PAGES.forEach((id) => {
    const el = $(id);
    if (el) el.classList.toggle("hidden", id !== targetId);
  });

  // Bottom nav visibility + active state
  const nav = $("bottomNav");
  if (nav) {
    nav.classList.toggle("hidden", page === "auth");
    nav.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === page);
    });
  }

  // Page-specific setup
  if (page === "home") {
    updateHomeChildCard();
    updateStreakDisplay();
    renderTrialState();
  } else if (page === "children") {
    renderChildrenList();
    clearChildForm();
    setEditMode(null);
  } else if (page === "quick") {
    const child = getSelectedChild();
    const label = $("quickChildLabel");
    if (label) label.textContent = child.name !== "a little one" ? `Story for ${child.name}` : "";
  } else if (page === "today") {
    const child = getSelectedChild();
    const label = $("todayChildLabel");
    if (label) label.textContent = child.name !== "a little one" ? `Story for ${child.name}` : "";
  } else if (page === "hero") {
    // Auto-fill Hero form from selected child profile
    const child = getSelectedChild();
    if (child.name && child.name !== "a little one") {
      const heroName = $("heroName");
      const heroAge = $("heroAge");
      const heroIdea = $("heroIdea");
      if (heroName && !heroName.value) heroName.value = child.name;
      if (heroAge && !heroAge.value) heroAge.value = child.age || "";
      if (heroIdea && !heroIdea.value && child.interests?.length) {
        heroIdea.value = child.interests.join(", ");
      }
    }
    renderHeroSiblings();
    updateHeroSeriesLabel();
  } else if (page === "library") {
    renderLibrary();
    renderLibraryChildFilter();
  } else if (page === "settings") {
    const emailEl = $("settingsEmail");
    if (emailEl && currentUser) emailEl.textContent = currentUser.email || "";
    renderDialectControls();
  }

  // Scroll to top of the new page
  const targetEl = $(targetId);
  const scrollEl = targetEl?.querySelector(".page-scroll");
  if (scrollEl) scrollEl.scrollTop = 0;
}

function closeStoryCard() {
  navigateTo(previousPage || "home");
}

/** Update the active child card + story choices on the home page. */
function updateHomeChildCard() {
  const childCard = $("activeChildCard");
  const nameEl = $("activeChildName");
  const metaEl = $("activeChildMeta");
  const choicesEl = $("storyChoices");
  const welcomeEl = $("welcomeBanner");

  if (cachedChildren.length === 0) {
    if (childCard) childCard.classList.add("hidden");
    if (choicesEl) choicesEl.classList.add("hidden");
    if (welcomeEl) welcomeEl.classList.remove("hidden");
    return;
  }

  if (welcomeEl) welcomeEl.classList.add("hidden");

  // Clamp index
  if (selectedChildIndex >= cachedChildren.length) selectedChildIndex = 0;
  const child = cachedChildren[selectedChildIndex] || {};

  if (childCard) childCard.classList.remove("hidden");
  if (nameEl) nameEl.textContent = child.name || "Child";
  if (metaEl) {
    const parts = [`Age ${child.age || "?"}`];
    const g = (child.gender || "").toLowerCase();
    if (g === "girl" || g === "boy") parts.push(g.charAt(0).toUpperCase() + g.slice(1));
    metaEl.textContent = parts.join(" \u2022 ");
  }
  if (choicesEl) choicesEl.classList.remove("hidden");
}

/** Render the children list on the children page. */
function renderChildrenList() {
  const container = $("childrenList");
  if (!container) return;
  container.innerHTML = "";

  if (cachedChildren.length === 0) return;

  cachedChildren.forEach((child, index) => {
    const item = document.createElement("div");
    item.className = `child-list-item${index === selectedChildIndex ? " selected" : ""}`;

    const info = document.createElement("div");
    info.className = "child-list-info";
    const name = document.createElement("h3");
    name.textContent = child.name || "Child";
    const meta = document.createElement("p");
    const parts = [`Age ${child.age || "?"}`];
    const g = (child.gender || "").toLowerCase();
    if (g === "girl" || g === "boy") parts.push(g.charAt(0).toUpperCase() + g.slice(1));
    if (child.interests?.length) {
      const interestStr = Array.isArray(child.interests) ? child.interests.join(", ") : child.interests;
      parts.push(interestStr);
    }
    meta.textContent = parts.join(" \u2022 ");
    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "child-list-actions";

    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.textContent = index === selectedChildIndex ? "Active" : "Select";
    selectBtn.disabled = index === selectedChildIndex;
    selectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      selectChild(index);
      renderChildrenList();
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editChildByIndex(index);
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "delete-child-btn";
    delBtn.textContent = "Remove";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChildByIndex(index);
    });

    actions.appendChild(selectBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(info);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

/** Render the child filter dropdown on the library page (if 2+ children). */
function renderLibraryChildFilter() {
  const filterCard = $("libraryChildFilter");
  const select = $("childSelect");
  if (!filterCard || !select) return;

  if (cachedChildren.length < 2) {
    filterCard.classList.add("hidden");
    return;
  }

  filterCard.classList.remove("hidden");
  select.innerHTML = "";
  cachedChildren.forEach((child, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = child.name || "Child";
    if (index === selectedChildIndex) option.selected = true;
    select.appendChild(option);
  });
}

function editChildByIndex(index) {
  if (index < 0 || index >= cachedChildren.length) return;
  const child = cachedChildren[index] || {};
  $("childName").value = child.name || "";
  $("childAge").value = child.age || "";
  $("childGender").value = (child.gender || "").toLowerCase();
  $("childInterests").value = Array.isArray(child.interests)
    ? child.interests.join(", ")
    : String(child.interests || "");
  const ap = $("childAppearance");
  if (ap) ap.value = child.appearance || "";
  setEditMode(index);
  $("childFormCard")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function deleteChildByIndex(index) {
  if (!currentUser || index < 0 || index >= cachedChildren.length) return;
  const child = cachedChildren[index];
  const childName = child?.name || "this child";
  if (!confirm(`Remove ${childName}? Their saved stories and series will also be cleared.`)) return;

  const updated = cachedChildren.filter((_, i) => i !== index);
  try {
    const userRef = doc(db, "users", currentUser.uid);
    const cleanupUpdates = { children: updated };
    if (childName) {
      cleanupUpdates[`streaks.${childName}`] = null;
      cleanupUpdates[`series.${childName}`] = null;
      cleanupUpdates.library = cachedLibrary.filter((s) => s.childName !== childName);
    }
    await updateDoc(userRef, cleanupUpdates);
    await loadChildren();
    renderChildrenList();
  } catch (error) {
    console.error("Delete child failed:", error);
    alert("Could not remove child. Please try again.");
  }
}

// =============================================================================
// UI — Loading state
// =============================================================================

function showLoading() {
  const overlay = $("loadingOverlay");
  if (overlay) overlay.classList.remove("hidden");
}

function hideLoading() {
  const overlay = $("loadingOverlay");
  if (overlay) overlay.classList.add("hidden");
}

// =============================================================================
// UI — Display story
// =============================================================================

function displayStory(title, text, context = {}) {
  currentStoryTitle = title;
  currentStoryText = text;
  currentStoryChildName = context.childName || currentStoryChildName || "";
  currentStoryMode = context.mode || currentStoryMode || "";

  const storyCard = $("storyCard");
  const storyTitle = $("storyTitle");
  const storyOutput = $("storyOutput");
  const saveLibBtn = $("saveToLibraryBtn");

  if (storyTitle) storyTitle.textContent = title;

  // FIX: Use textContent instead of innerHTML to prevent XSS
  if (storyOutput) storyOutput.textContent = formatStory(text);

  // Only offer opt-in save for Quick Stories (Hero stories auto-save).
  // Error-ish placeholders ("Oops!", the empty-output message) are not savable.
  if (saveLibBtn) {
    const isError = title === "Oops!" || !text || text.startsWith("No story was returned");
    const isQuick = currentStoryMode === "random" || currentStoryMode === "" && title === "Quick Story";
    saveLibBtn.classList.toggle("hidden", !(isQuick && !isError));
    saveLibBtn.textContent = "★ Save to Library";
  }

  if (storyCard) {
    storyCard.classList.remove("hidden");
    navigateTo("story");
  }
}

// =============================================================================
// Authentication
// =============================================================================

async function signup() {
  const email = ($("email")?.value || "").trim();
  const password = $("password")?.value || "";

  if (!email || !password) {
    alert("Please enter your email and password.");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email,
      subscribed: false,
      children: [],
      storyDialect: DIALECT_BRITISH,
      storyLocale: DIALECT_BRITISH,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Signup failed:", error);
    const message =
      error.code === "auth/email-already-in-use" ? "This email is already registered. Please log in." :
      error.code === "auth/invalid-email" ? "Please enter a valid email address." :
      error.code === "auth/weak-password" ? "Password must be at least 6 characters." :
      "Signup failed. Please try again.";
    alert(message);
  }
}

async function login() {
  const email = ($("email")?.value || "").trim();
  const password = $("password")?.value || "";

  if (!email || !password) {
    alert("Please enter your email and password.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Login failed:", error);
    const message =
      error.code === "auth/user-not-found" ? "No account found with this email." :
      error.code === "auth/wrong-password" ? "Incorrect password. Please try again." :
      error.code === "auth/invalid-credential" ? "Incorrect email or password." :
      "Login failed. Please try again.";
    alert(message);
  }
}

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

async function resetPassword() {
  const email = ($("email")?.value || "").trim();
  if (!email) {
    alert("Please type your email address in the email box first, then tap 'Forgot password?' again.");
    $("email")?.focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    alert(`We've sent a password reset link to ${email}. Check your inbox (and spam folder).`);
  } catch (error) {
    console.error("Password reset failed:", error);
    const message =
      error.code === "auth/invalid-email" ? "Please enter a valid email address." :
      error.code === "auth/user-not-found" ? "No account found with this email." :
      "We couldn't send a reset email. Please try again.";
    alert(message);
  }
}

async function deleteAccount() {
  if (!currentUser) {
    alert("You need to be logged in to delete your account.");
    return;
  }

  const confirm1 = confirm(
    "Delete your DreamTalez account?\n\n" +
    "This will permanently remove all your children's profiles, saved stories, streaks, and series history. " +
    "This cannot be undone."
  );
  if (!confirm1) return;

  const confirm2 = prompt(
    'To confirm, type DELETE in capital letters:'
  );
  if (confirm2 !== "DELETE") {
    alert("Account deletion cancelled.");
    return;
  }

  const password = prompt("Please enter your password to confirm:");
  if (!password) {
    alert("Account deletion cancelled.");
    return;
  }

  try {
    // Re-authenticate first (required by Firebase for sensitive operations)
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);

    // Delete Firestore user document (children, streaks, library, series, trial)
    await deleteDoc(doc(db, "users", currentUser.uid));

    // Delete the auth account itself
    await deleteUser(currentUser);

    alert("Your account has been deleted. We're sorry to see you go.");
    // onAuthStateChanged will handle the UI return to the auth screen
  } catch (error) {
    console.error("Account deletion failed:", error);
    const message =
      error.code === "auth/wrong-password" ? "Incorrect password. Account not deleted." :
      error.code === "auth/invalid-credential" ? "Incorrect password. Account not deleted." :
      error.code === "auth/requires-recent-login" ? "For security, please log out, log back in, and try again." :
      "We couldn't delete your account. Please try again.";
    alert(message);
  }
}

// =============================================================================
// Child Management
// =============================================================================

// Index of the child currently being edited, or null for "add new" mode.
let editingChildIndex = null;

function setEditMode(index) {
  editingChildIndex = index;
  const saveBtn = $("saveChildBtn");
  const cancelBtn = $("cancelEditBtn");
  const heading = $("childFormHeading");
  if (saveBtn) saveBtn.textContent = index === null ? "Save Child" : "Update Child";
  if (cancelBtn) cancelBtn.classList.toggle("hidden", index === null);
  if (heading) heading.textContent = index === null ? "Add a Child" : "Edit Child";
}

function clearChildForm() {
  $("childName").value = "";
  $("childAge").value = "";
  $("childGender").value = "";
  $("childInterests").value = "";
  const ap = $("childAppearance");
  if (ap) ap.value = "";
}

function cancelEditChild() {
  clearChildForm();
  setEditMode(null);
}

// editSelectedChild removed — replaced by editChildByIndex in page navigation

// deleteSelectedChild removed — replaced by deleteChildByIndex in page navigation

async function saveChild() {
  if (!currentUser) {
    alert("Please log in first.");
    return;
  }

  const name = ($("childName")?.value || "").trim();
  const age = ($("childAge")?.value || "").trim();
  const gender = ($("childGender")?.value || "neutral").trim().toLowerCase();
  const interestsInput = ($("childInterests")?.value || "").trim();
  const interests = interestsInput
    .split(",")
    .map((i) => i.trim().toLowerCase())
    .filter(Boolean);
  const appearance = ($("childAppearance")?.value || "").trim().slice(0, 200);

  if (!name) {
    alert("Please enter a child's name.");
    return;
  }

  if (!age || isNaN(age) || age < 1 || age > 18) {
    alert("Please enter a valid age (1–18).");
    return;
  }

  // Cap at 10 children per account — enough for big families + sleepover cousins
  const MAX_CHILDREN = 10;
  if (editingChildIndex === null && cachedChildren.length >= MAX_CHILDREN) {
    alert(`You can have up to ${MAX_CHILDREN} children on one account. Please remove a profile before adding a new one.`);
    return;
  }

  const nextRecord = { name, age, gender, interests, appearance };

  try {
    const userRef = doc(db, "users", currentUser.uid);

    if (editingChildIndex === null) {
      // Add new child
      await updateDoc(userRef, { children: arrayUnion(nextRecord) });
    } else {
      // Update existing: replace the full children array preserving order
      const prev = cachedChildren[editingChildIndex] || {};
      const updated = cachedChildren.map((c, i) => (i === editingChildIndex ? nextRecord : c));
      const updates = { children: updated };
      // If the child was renamed, migrate per-child keys (streaks, series, library)
      if (prev.name && prev.name !== name) {
        const prevStreak = cachedStreaks[prev.name];
        const prevSeries = cachedSeries[prev.name];
        updates[`streaks.${prev.name}`] = null;
        updates[`series.${prev.name}`] = null;
        if (prevStreak) updates[`streaks.${name}`] = prevStreak;
        if (prevSeries) updates[`series.${name}`] = prevSeries;
        updates.library = cachedLibrary.map((e) =>
          e.childName === prev.name ? { ...e, childName: name } : e
        );
      }
      await updateDoc(userRef, updates);
    }

    clearChildForm();
    setEditMode(null);
    await loadChildren();
    renderChildrenList();

    // If this was the first child, auto-select them
    if (cachedChildren.length === 1) selectedChildIndex = 0;
  } catch (error) {
    console.error("Save child failed:", error);
    alert("Could not save child. Please try again.");
  }
}

async function loadChildren() {
  if (!currentUser) return;

  try {
    const userRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) return;

    const data = snap.data();
    cachedChildren = Array.isArray(data.children) ? data.children : [];
    cachedStreaks = data.streaks && typeof data.streaks === "object" ? data.streaks : {};
    cachedLibrary = Array.isArray(data.library) ? data.library : [];
    cachedSeries = data.series && typeof data.series === "object" ? data.series : {};
    cachedTrial = data.trial && typeof data.trial === "object" ? data.trial : null;
    cachedDialect = normalizeDialect(data.storyLocale || data.storyDialect);
    await ensureTrialInitialised();

    // Clamp selected index
    if (selectedChildIndex >= cachedChildren.length) selectedChildIndex = Math.max(0, cachedChildren.length - 1);

    renderTrialState();
    updateHomeChildCard();
    updateStreakDisplay();
    renderLibrary();
    renderDialectControls();
  } catch (error) {
    console.error("Load children failed:", error);
  }
}

// =============================================================================
// Bedtime Streaks
// =============================================================================

/**
 * Return YYYY-MM-DD in the user's local timezone for "today".
 * Using local-date strings keeps streaks intuitive for parents across timezones.
 */
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Number of calendar days between two YYYY-MM-DD keys (b - a). */
function dayDiff(a, b) {
  const da = new Date(a + "T00:00:00");
  const dbb = new Date(b + "T00:00:00");
  return Math.round((dbb - da) / 86400000);
}

/**
 * Record that a story was listened to for a child. Increments streak on
 * consecutive days, keeps same-day opens as no-op, resets if a day was missed.
 */
async function recordStreakForChild(childName) {
  if (!currentUser || !childName) return;
  const today = todayKey();
  const prev = cachedStreaks[childName] || { lastDate: null, count: 0 };

  let next;
  if (prev.lastDate === today) {
    return; // already counted today
  } else if (prev.lastDate && dayDiff(prev.lastDate, today) === 1) {
    next = { lastDate: today, count: (prev.count || 0) + 1 };
  } else {
    next = { lastDate: today, count: 1 };
  }

  cachedStreaks[childName] = next;
  updateStreakDisplay();

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { [`streaks.${childName}`]: next });
  } catch (error) {
    console.error("Streak save failed:", error);
  }
}

/** Show the streak panel for the currently selected child. */
function updateStreakDisplay() {
  const el = $("streakDisplay");
  if (!el) return;

  const child = getSelectedChild();
  const name = child?.name;
  const streak = name ? cachedStreaks[name] : null;
  if (!streak || !streak.count) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }

  const today = todayKey();
  const gap = streak.lastDate ? dayDiff(streak.lastDate, today) : 99;
  // Only show streak if still alive (today or yesterday)
  if (gap > 1) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }

  const nights = streak.count === 1 ? "night" : "nights";
  el.textContent = `🌙 ${name} · ${streak.count} ${nights} in a row`;
  el.classList.remove("hidden");
}

// =============================================================================
// Story Library
// =============================================================================

function formatSavedDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/** Render the library filtered to the currently selected child. */
function renderLibrary() {
  const list = $("libraryList");
  const hint = $("libraryHint");
  if (!list) return;

  const child = getSelectedChild();
  const name = child?.name;

  const items = (name && name !== "a little one")
    ? cachedLibrary
        .filter((s) => s && s.childName === name)
        .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")))
    : [];

  list.innerHTML = "";

  if (items.length === 0) {
    if (hint) hint.textContent = name ? `No saved stories for ${name} yet.` : "Add a child to see their stories.";
    return;
  }

  if (hint) hint.textContent = `${items.length} saved ${items.length === 1 ? "story" : "stories"} for ${name}.`;

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "library-item";

    const body = document.createElement("div");
    body.className = "library-item-body";

    const title = document.createElement("div");
    title.className = "library-item-title";
    title.textContent = item.title || "Untitled Story";

    const meta = document.createElement("div");
    meta.className = "library-item-meta";
    const modeLabel = item.mode === "hero" ? "Hero" : item.mode === "today" ? "Today" : "Quick";
    meta.textContent = `${modeLabel} · ${formatSavedDate(item.savedAt)}`;

    body.appendChild(title);
    body.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "library-item-actions";

    const readBtn = document.createElement("button");
    readBtn.type = "button";
    readBtn.textContent = "Read again";
    readBtn.addEventListener("click", () => reReadFromLibrary(item.id));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "delete-btn";
    delBtn.setAttribute("aria-label", "Remove from library");
    delBtn.textContent = "×";
    delBtn.addEventListener("click", () => deleteFromLibrary(item.id));

    actions.appendChild(readBtn);
    actions.appendChild(delBtn);

    li.appendChild(body);
    li.appendChild(actions);
    list.appendChild(li);
  });
}

/** Save a story into the library. Safe to call even if already saved — dedupes by id. */
async function saveStoryToLibrary({ childName, title, text, mode }) {
  if (!currentUser || !childName || !text) return false;

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    childName,
    title: title || "Bedtime Story",
    text,
    mode: mode || "random",
    savedAt: new Date().toISOString(),
  };

  // Update local cache first for instant UI feedback
  cachedLibrary = [entry, ...cachedLibrary];
  renderLibrary();

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { library: arrayUnion(entry) });
    return true;
  } catch (error) {
    console.error("Library save failed:", error);
    // Roll back local cache
    cachedLibrary = cachedLibrary.filter((s) => s.id !== entry.id);
    renderLibrary();
    return false;
  }
}

/** User-clickable: save the story currently on screen (Quick Stories). */
async function saveCurrentStoryToLibrary() {
  const btn = $("saveToLibraryBtn");
  if (!currentStoryText || !currentStoryChildName) {
    if (btn) {
      btn.textContent = "Pick a child first";
      setTimeout(() => (btn.textContent = "★ Save to Library"), 1800);
    }
    return;
  }

  // Prevent double-saving the same session story
  const dupe = cachedLibrary.find(
    (s) => s.childName === currentStoryChildName && s.text === currentStoryText
  );
  if (dupe) {
    if (btn) {
      btn.textContent = "Already saved";
      setTimeout(() => (btn.textContent = "★ Save to Library"), 1800);
    }
    return;
  }

  const ok = await saveStoryToLibrary({
    childName: currentStoryChildName,
    title: currentStoryTitle,
    text: currentStoryText,
    mode: currentStoryMode || "random",
  });

  if (btn) {
    btn.textContent = ok ? "Saved!" : "Could not save";
    setTimeout(() => (btn.textContent = "★ Save to Library"), 1800);
  }
}

/** Remove a story from the library by id. */
async function deleteFromLibrary(id) {
  if (!currentUser || !id) return;
  const entry = cachedLibrary.find((s) => s.id === id);
  if (!entry) return;
  if (!confirm(`Remove "${entry.title}" from the library?`)) return;

  // Optimistic update
  const prev = cachedLibrary;
  cachedLibrary = cachedLibrary.filter((s) => s.id !== id);
  renderLibrary();

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { library: arrayRemove(entry) });
  } catch (error) {
    console.error("Library delete failed:", error);
    cachedLibrary = prev;
    renderLibrary();
    alert("Could not remove the story. Please try again.");
  }
}

/** Re-read a story from the library (no API call). */
function reReadFromLibrary(id) {
  const entry = cachedLibrary.find((s) => s.id === id);
  if (!entry) return;
  displayStory(entry.title, entry.text, { childName: entry.childName, mode: entry.mode });
  enterReadingMode();
}

// =============================================================================
// Story Generation — Main handler
// =============================================================================

// Re-entry guard: prevents double-clicks from eating 2 trial stories
let generationInProgress = false;
// Expose to story-cache.js so background fill pauses during user generation
window._dtGenerationInProgress = () => generationInProgress;

async function handleGenerate(mode) {
  const storyOutput = $("storyOutput");
  if (!storyOutput) return;

  // Silently ignore if a generation is already running
  if (generationInProgress) return;
  generationInProgress = true;

  // ---- Trial gate: block if trial exhausted (unless paid) ----
  if (!canGenerateStory()) {
    generationInProgress = false;
    navigateTo("home"); // paywall is on the home page
    return;
  }

  // Build the request payload based on mode
  let payload;
  let buttonId;

  if (mode === "tonight") {
    // ---- Random Story: auto-fill from child profile ----
    const child = getSelectedChild();
    const name = child.name || "a little one";
    const age = String(child.age || 5);
    // Optional: child's wish for tonight (parent types what the child said)
    const childWish = ($("tonightWish")?.value || "").trim().slice(0, 120);
    const baseInterests = child.interests?.length
      ? child.interests.join(", ")
      : pick(interestsByAge[getAgeGroup(child.age || 5)]);
    const randomStoryInterests = childWish
      ? `${childWish}, ${baseInterests}`
      : baseInterests;
    const interests = enrichInterestsWithContext(randomStoryInterests, child);

    payload = {
      name: formatName(name),
      age,
      interests,
      length: "short",
      mode: "random",
      dialect: getCurrentDialect(),
      childWish: childWish || undefined,
      appearance: child.appearance || undefined,
    };
    buttonId = "generateTonightBtn";
  } else if (mode === "today") {
    // ---- Story from Today: weave real day-beats into a gentle story ----
    const child = getSelectedChild();
    if (!child.name || child.name === "a little one") {
      alert("Please add and choose a child first.");
      return;
    }
    const dayBeats = ($("todayBeats")?.value || "").trim().slice(0, 400);
    const dayMood = $("todayMood")?.value || "";

    if (!dayBeats) {
      alert("Please share 2–3 things from your child's day so we can weave them into the story.");
      return;
    }

    const name = child.name;
    const age = String(child.age || 5);
    const baseInterests = child.interests?.length
      ? child.interests.join(", ")
      : pick(interestsByAge[getAgeGroup(child.age || 5)]);
    const interests = enrichInterestsWithContext(baseInterests, child);

    payload = {
      name: formatName(name),
      age,
      interests,
      length: "medium",
      mode: "today",
      dialect: getCurrentDialect(),
      dayBeats,
      dayMood: dayMood || undefined,
      appearance: child.appearance || undefined,
    };
    buttonId = "generateTodayBtn";
  } else if (mode === "hero") {
    // ---- Hero Story: use parent's custom inputs ----
    const name = ($("heroName")?.value || "").trim();
    const age = ($("heroAge")?.value || "").trim();
    const rawIdea = ($("heroIdea")?.value || "").trim();
    const length = $("heroLength")?.value || "medium";

    if (!name || !age || !rawIdea) {
      alert("Please fill in the child's name, age, and story idea.");
      return;
    }

    // Get child's general interests from their profile (for enrichment)
    const child = getSelectedChild();
    const baseInterests = child.interests?.length
      ? child.interests.join(", ")
      : rawIdea;
    // Only include siblings the parent has ticked for this story
    const tickedSiblings = getTickedHeroSiblings();
    const interests = enrichInterestsWithContext(baseInterests, child, tickedSiblings);

    const seriesContext = buildSeriesContinuationContext(child.name || name);

    payload = {
      name: formatName(name),
      age,
      interests,
      length,
      mode: "hero",
      dialect: getCurrentDialect(),
      customIdea: rawIdea,
      seriesContext: seriesContext || undefined,
      appearance: child.appearance || undefined,
    };
    buttonId = "generateHeroBtn";
  } else {
    return;
  }

  // ---- Shared AI generation flow ----
  const button = $(buttonId);
  const originalText = button?.textContent || "";

  showLoading();
  if (button) {
    button.disabled = true;
    button.textContent = "Creating...";
  }

  try {
    // All modes hit the AI pipeline when online.
    // Network failures fall through to the procedural catch block
    // so bedtime always happens offline too.
    const response = await fetch("/generate", {
      method: "POST",
      headers: await buildAuthenticatedJsonHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error (${response.status})`);
    }

    const data = await response.json();
    if (data?.fallback) {
      throw Object.assign(new Error("AI unavailable, using procedural fallback."), {
        proceduralFallback: true,
      });
    }

    const story = typeof data?.story === "string" && data.story.trim()
      ? applyDialectToText(data.story, payload.dialect)
      : "No story was returned. Please try again.";
    const title = applyDialectToText(data?.title || `${payload.name}'s Bedtime Story`, payload.dialect);

    const storyChildName = getSelectedChild()?.name || payload.name;
    const storyMode = mode === "hero" ? "hero" : mode === "today" ? "today" : "random";
    displayStory(title, story, { childName: storyChildName, mode: storyMode });

    // Auto-save bespoke stories (Hero + Today) — both are personal keepsakes.
    if ((storyMode === "hero" || storyMode === "today") && story && !story.startsWith("No story was returned")) {
      saveStoryToLibrary({ childName: storyChildName, title, text: story, mode: storyMode });
      if (storyMode === "hero") advanceHeroSeries(storyChildName, title, story);
    }

    // Clear the Quick Story wish so tomorrow's child can pick fresh
    const wishInput = $("tonightWish");
    if (wishInput && mode === "tonight") wishInput.value = "";

    // Clear today-story form so tomorrow starts fresh
    if (mode === "today") {
      const beatsInput = $("todayBeats");
      const moodInput = $("todayMood");
      if (beatsInput) beatsInput.value = "";
      if (moodInput) moodInput.value = "";
    }

    // Count this story against the trial cap
    if (story && !story.startsWith("No story was returned")) {
      recordStoryUsed();
    }

    // Navigation is handled by displayStory → navigateTo("story")

    enterReadingMode();
  } catch (error) {
    if (!error?.proceduralFallback) {
      console.warn("AI generation unavailable, using procedural fallback.", error);
    }

    // OFFLINE CACHE: Before falling back to the procedural engine, check if we
    // have a pre-generated AI story stored in IndexedDB for this child. Serves
    // a real AI story on airplane mode for Medium / Long modes.
    // Quick (tonight) skips this — procedural is intentional for quick stories.
    if (window.StoryCache && mode !== "tonight") {
      try {
        const offlineChild = getSelectedChild();
        const offlineMode = mode === "hero" ? "hero" : "medium";
        const cached = await window.StoryCache.claimCachedStory(
          offlineChild?.name || "",
          offlineMode
        );
        if (cached) {
          const storyText = applyDialectToText(cached.text, getCurrentDialect());
          const storyTitle = applyDialectToText(cached.title, getCurrentDialect());
          displayStory(storyTitle, storyText, {
            childName: offlineChild?.name,
            mode: offlineMode,
          });
          recordStoryUsed();
          enterReadingMode();
          // Replenish the slot we just consumed when back online
          window.StoryCache.scheduleBackgroundFill(
            cachedChildren,
            () => currentUser?.getIdToken(),
            getCurrentDialect()
          );
          return;
        }
      } catch (cacheErr) {
        console.warn("[StoryCache] claim failed:", cacheErr);
      }
    }

    // FALLBACK: If API fails, serve a procedural story so bedtime still happens.
    // Works for both Quick and Hero modes — quality insurance for parents.
    const selectedChild = getSelectedChild();
    let fallbackChild = selectedChild;
    let fallbackTitle = "Quick Story";
    let fallbackMode = "random";
    let heroIdea = "";

    if (mode === "hero") {
      // Build a pseudo-child from the hero form so the procedural engine can run
      const heroName = ($("heroName")?.value || "").trim() || selectedChild?.name || "a little one";
      const heroAge = Number(($("heroAge")?.value || "").trim()) || Number(selectedChild?.age) || 5;
      heroIdea = ($("heroIdea")?.value || "").trim();
      const heroLength = $("heroLength")?.value || "medium";
      const heroGender = selectedChild?.gender || "neutral";
      const heroInterestsBase = selectedChild?.interests?.length
        ? selectedChild.interests
        : [heroIdea].filter(Boolean);
      fallbackChild = {
        name: heroName,
        age: heroAge,
        gender: heroGender,
        interests: heroInterestsBase,
        customIdea: heroIdea,
        requestedLength: heroLength,
      };
      fallbackMode = "hero";
    }

    fallbackChild = {
      ...fallbackChild,
      requestedLength: fallbackChild?.requestedLength || payload?.length || "medium",
    };

    console.log("API failed, falling back to procedural story engine");
    const quickWish = mode === "tonight"
      ? ($("tonightWish")?.value || "").trim().toLowerCase()
      : "";
    const quickFallbackChild = quickWish
      ? { ...fallbackChild, interests: [quickWish] }
      : fallbackChild;
    const heroFallbackChild = heroIdea
      ? { ...fallbackChild, interests: [heroIdea] }
      : fallbackChild;
    const selectedWorld = mode === "tonight"
      ? (quickWish ? (findQuickWishMatchedWorld(quickWish, quickFallbackChild) || pickRandomSuitableWorld(fallbackChild)) : pickRandomSuitableWorld(fallbackChild))
      : mode === "hero"
        ? (heroIdea ? (findQuickWishMatchedWorld(heroIdea, heroFallbackChild) || pickSuitableWorld(heroFallbackChild)) : pickSuitableWorld(fallbackChild))
        : pickSuitableWorld(fallbackChild);
    const siblings = mode === "hero" ? getTickedHeroSiblings() : getSiblingsFor(fallbackChild);
    const proceduralChild = mode === "hero" ? heroFallbackChild : quickFallbackChild;
    let finalText = "";
    let displayTitle = fallbackTitle;

    try {
      const rawFallback = applyDialectToText(generateQuickStory(proceduralChild, selectedWorld, siblings), getCurrentDialect());
      const fallbackWorldKey = resolveWorldKey(selectedWorld);
      displayTitle = buildProceduralTitle(fallbackChild?.name, {
        mode: fallbackMode,
        customIdea: heroIdea,
        worldKey: fallbackWorldKey,
        world: selectedWorld,
      }) || fallbackTitle;

      finalText = rawFallback;
      // Offline-safe polish: if the device has network, upgrade the procedural
      // draft with a Sonnet polish pass for Disney-grade prose. If offline, or
      // the polish call fails for any reason, we still serve the raw procedural
      // story so bedtime always happens.
      const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
      if (isOnline) {
        try {
          const polishResponse = await fetch("/polish", {
            method: "POST",
            headers: await buildAuthenticatedJsonHeaders(),
            body: JSON.stringify({
              story: rawFallback,
              dialect: getCurrentDialect(),
              mode: mode === "tonight" ? "rewrite" : "edit",
            }),
          });
          if (polishResponse.ok) {
            const polishData = await polishResponse.json();
            finalText = applyDialectToText(polishData.story || rawFallback, getCurrentDialect());
          }
        } catch {
          // Polish failed — serve raw procedural story, bedtime still happens.
        }
      }
    } catch (fallbackError) {
      console.error("Procedural fallback failed:", fallbackError);
      try {
        finalText = applyDialectToText(buildSafeProceduralQuickStory(proceduralChild, selectedWorld, siblings), getCurrentDialect());
        const fallbackWorldKey = resolveWorldKey(selectedWorld);
        displayTitle = buildProceduralTitle(fallbackChild?.name, {
          mode: fallbackMode,
          customIdea: heroIdea,
          worldKey: fallbackWorldKey,
          world: selectedWorld,
        }) || fallbackTitle;
      } catch (safeFallbackError) {
        console.error("Safe procedural fallback failed:", safeFallbackError);
        finalText = applyDialectToText(buildEmergencyFallbackStory(fallbackChild?.name), getCurrentDialect());
        displayTitle = fallbackTitle;
      }
    }

    const ctx = { childName: fallbackChild?.name, mode: fallbackMode };
    displayStory(displayTitle || fallbackTitle, finalText, ctx);

    // Count it toward the trial only if the child was really generated for
    recordStoryUsed();
    enterReadingMode();
  } finally {
    hideLoading();
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
    generationInProgress = false;
  }
}

// =============================================================================
// Auth State Observer
// =============================================================================

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadChildren();
    navigateTo("home");
    // Start background cache fill once children are loaded
    if (window.StoryCache) {
      window.StoryCache.pruneOldEntries();
      window.StoryCache.scheduleBackgroundFill(
        cachedChildren,
        () => currentUser?.getIdToken(),
        getCurrentDialect()
      );
      window.StoryCache.updateOfflineIndicator();
    }
  } else {
    currentUser = null;
    cachedChildren = [];
    cachedStreaks = {};
    cachedLibrary = [];
    cachedSeries = {};
    cachedTrial = null;
    cachedDialect = DIALECT_BRITISH;
    selectedChildIndex = 0;
    navigateTo("auth");
  }
});

// =============================================================================
// Event Listeners — consolidated in one place
// =============================================================================

// When the device regains internet, replenish the offline cache
window.addEventListener("online", () => {
  if (window.StoryCache && cachedChildren.length && currentUser) {
    window.StoryCache.scheduleBackgroundFill(
      cachedChildren,
      () => currentUser?.getIdToken(),
      getCurrentDialect()
    );
  }
});

// Hero "Start a new series" button
const seriesResetBtn = $("heroSeriesResetBtn");
if (seriesResetBtn) {
  seriesResetBtn.addEventListener("click", resetHeroSeries);
}

// Subscribe button (paywall)
const subscribeBtn = $("subscribeBtn");
if (subscribeBtn) {
  subscribeBtn.addEventListener("click", handleSubscribe);
}

// Sample story button (landing page, no-signup demo)
const sampleBtn = $("sampleStoryBtn");
if (sampleBtn) {
  sampleBtn.addEventListener("click", showSampleStory);
}

// Reading mode events
setupReadingModeEvents();

// Library child filter — when user changes selected child from library page
const childSelectEl = $("childSelect");
if (childSelectEl) {
  childSelectEl.addEventListener("change", () => {
    selectedChildIndex = Number(childSelectEl.value) || 0;
    renderLibrary();
  });
}

const dialectBritishBtn = $("dialectBritishBtn");
if (dialectBritishBtn) {
  dialectBritishBtn.addEventListener("click", () => saveStoryDialect(DIALECT_BRITISH));
}

const dialectAmericanBtn = $("dialectAmericanBtn");
if (dialectAmericanBtn) {
  dialectAmericanBtn.addEventListener("click", () => saveStoryDialect(DIALECT_AMERICAN));
}

// Expose to HTML onclick attributes
window.navigateTo = navigateTo;
window.closeStoryCard = closeStoryCard;
window.handleGenerate = handleGenerate;
window.signup = signup;
window.login = login;
window.logout = logout;
window.resetPassword = resetPassword;
window.deleteAccount = deleteAccount;
window.saveChild = saveChild;
window.cancelEditChild = cancelEditChild;
window.enterReadingMode = enterReadingMode;
window.saveCurrentStoryToLibrary = saveCurrentStoryToLibrary;
