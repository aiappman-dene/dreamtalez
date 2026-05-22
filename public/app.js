
// =============================================================================
// 🔥 FIREBASE SETUP (MUST BE AT VERY TOP)
// =============================================================================

// ✅ Import from firebase-init.js — unified single instance for all tabs
// All Firebase functions exported from one source to prevent instance duplication
import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  getAppCheckToken,
} from "./firebase-init.js?v=20260522b";

// Magical loading experience — owns its DOM/CSS/timers. See public/components/loading.js
import { start as dtLoadingStart, stop as dtLoadingStop } from "./components/loading.js";
// Line-by-line story reveal — owns DOM, CSS transitions, reduced-motion handling.
import {
  revealStory as dtRevealStory,
  cancelReveal as dtCancelReveal,
  getActiveReveal as dtGetActiveReveal
} from "./components/story-reveal.js";

import { getCurrentLanguage, setCurrentLanguage, t, applyUILanguage, LS_LANG_KEY, SUPPORTED_LANGUAGES, LANGUAGE_LABELS, RTL_LANGUAGES } from './modules/i18n.js?v=20260522b';
import { pick, formatName } from './modules/utils.js';
import { isInputSafe } from './modules/safety.js?v=20260522b';
import { generateQuickStory, buildProceduralTitle, buildSafeProceduralQuickStory, buildEmergencyFallbackStory, buildSafeFallbackWishHope, buildOfflineIdeaArc, buildSeriesContinuationContext, findQuickWishMatchedWorld, getAgeGroup, pickSuitableWorld, resolveWorldKey, siblingRelation, generateCharacter, findInterestMatchedWorld, pickRandomSuitableWorld } from './modules/story-engine.js';
import { state } from './modules/app-state.js';
import { showToast } from './modules/toast.js';
import { updateStreakDisplay, recordStreakForChild, showMilestoneCelebration, todayKey, dayDiff, configure as configureStreaks } from './modules/streaks.js?v=20260522b';
import { renderLibrary, saveStoryToLibrary, saveCurrentStoryToLibrary, deleteFromLibrary, reReadFromLibrary, formatSavedDate, configure as configureLibrary } from './modules/library.js?v=20260522b';
import { signup, login, logout as authLogout, resetPassword, deleteAccount, closeDeleteModal, confirmDeleteAccount } from './modules/auth.js';
import { getSelectedChild, selectChild, buildPersonalWorld, enrichInterestsWithContext, getSiblingsFor, renderHeroSiblings, getTickedHeroSiblings, updateHeroSeriesLabel, resetHeroSeries, advanceHeroSeries, setEditMode, clearChildForm, cancelEditChild, saveChild, loadChildren, saveContinuationToFirestore, clearContinuationFromFirestore, configure as configureChildren } from './modules/children.js?v=20260522b';

// =============================================================================
// APP CONFIGURATION
// =============================================================================

const APP_VERSION = "2026.05.14";

let isGenerating = false;
let loadingInterval = null;
let lastGenerationTime = 0;
const COOLDOWN_MS = 5000;

// showToast — imported from ./modules/toast.js
// logout    — imported from ./modules/auth.js
window.logout = () => authLogout();

// =============================================================================
// Welcome Screen Logic
// =============================================================================
async function showWelcomeScreenIfNeeded(user) {
  if (!user) return false;
  const userDocRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userDocRef);
  if (!userSnap.exists()) return false;
  const data = userSnap.data();
  if (data.welcomeShown) return false;
  // Show welcome screen
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const welcomePage = document.getElementById('pageWelcome');
  if (welcomePage) welcomePage.classList.remove('hidden');
  // Animate floating stars
  setupWelcomeStars();
  // Set flag in Firebase immediately
  await updateDoc(userDocRef, { welcomeShown: true });
  // Button handler
  const btn = document.getElementById('welcomeBeginBtn');
  if (btn) {
    btn.onclick = () => {
      welcomePage.classList.add('hidden');
      navigateTo('home');
    };
  }
  return true;
}

function setupWelcomeStars() {
  const starsEl = document.querySelector('.welcome-stars');
  if (!starsEl) return;
  starsEl.innerHTML = '';
  for (let i = 0; i < 18; i++) {
    const star = document.createElement('span');
    star.textContent = '★';
    star.style.left = Math.random() * 98 + '%';
    star.style.bottom = Math.random() * 60 + 10 + 'px';
    star.style.fontSize = (0.9 + Math.random() * 0.7) + 'em';
    star.style.opacity = (0.5 + Math.random() * 0.5).toFixed(2);
    star.style.animationDelay = (Math.random() * 3.5) + 's';
    starsEl.appendChild(star);
  }
}
// =============================================================================
// Teddy Currency System — Frontend Logic
// =============================================================================
let teddyCount = null;
let teddyLastReset = null;
let teddyGlowTimeout = null;

async function fetchTeddyCount() {
  if (!state.currentUser) return;
  try {
    const headers = await buildAuthenticatedJsonHeaders();
    const res = await fetch(`${API_BASE}/api/teddy-topup`, { method: "GET", headers });
    if (!res.ok) throw new Error("Failed to fetch teddies");
    const data = await res.json();
    teddyCount = data.teddies_remaining;
    teddyLastReset = data.teddies_last_reset;
    // Trust the server on premium status (accounts for dev bypass + subscriptions)
    if (data.is_premium === true) {
      state.cachedIsPremium = true;
    }
    updateTeddyCounterUI();
  } catch (e) {
    teddyCount = null;
    updateTeddyCounterUI();
  }
}

function updateTeddyCounterUI() {
  const teddyBtn = document.getElementById("addTeddiesBtn");
  const teddySpan = document.getElementById("teddyCount");
  if (!teddyBtn || !teddySpan) return;
  teddySpan.textContent = teddyCount == null ? "--" : teddyCount;
  teddyBtn.disabled = true; // Stripe coming soon
  // Glow effect
  if (!teddyBtn.querySelector('.teddy-glow')) {
    const glow = document.createElement('span');
    glow.className = 'teddy-glow';
    teddyBtn.appendChild(glow);
  }
  // Low/zero teddy messages
  if (teddyCount !== null && teddyCount <= 3) {
    teddyBtn.title = teddyCount === 0
      ? "All stories used — subscribe to continue 🌙"
      : "Running low on stories! 🧸";
    teddyBtn.style.filter = teddyCount === 0 ? 'grayscale(0.7)' : '';
  } else {
    teddyBtn.title = "Stories remaining";
    teddyBtn.style.filter = '';
  }
}

function animateTeddySparkle() {
  const teddyBtn = document.getElementById("addTeddiesBtn");
  if (!teddyBtn) return;
  let sparkle = teddyBtn.querySelector('.teddy-sparkle');
  if (!sparkle) {
    sparkle = document.createElement('span');
    sparkle.className = 'teddy-sparkle';
    sparkle.textContent = '✨';
    teddyBtn.appendChild(sparkle);
  }
  sparkle.style.opacity = 1;
  sparkle.style.animation = 'teddySparkle 1.2s ease-in-out';
  setTimeout(() => { sparkle.style.opacity = 0; }, 1200);
}

// Call this after login and after every story generation/top-up/reset
async function refreshTeddyState(animated = false) {
  await fetchTeddyCount();
  if (animated) animateTeddySparkle();
}

// (onAuthStateChanged handler moved above, see initialization section)
// =============================================================================
// DreamTalez — Frontend Application
// =============================================================================
// Accessibility Modes: Dyslexia Friendly & Neurodivergent Friendly
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const dyslexiaToggle = document.getElementById('dyslexiaToggle');
  const neuroToggle = document.getElementById('neuroToggle');
  const readingToggle = document.getElementById("readingModeToggle");

  if (!localStorage.getItem("dt-reading-mode")) {
    localStorage.setItem("dt-reading-mode", "auto");
  }

  // =============================
  // READING MODE TOGGLE
  // =============================
  if (readingToggle) {
    // Load saved state
    readingToggle.checked = getReadingMode() === "tap";

    // Save on change
    readingToggle.addEventListener("change", () => {
      setReadingMode(readingToggle.checked ? "tap" : "auto");
    });
  }

  // Load saved state
  if (localStorage.getItem('dt-dyslexia') === '1') {
    document.body.classList.add('dyslexia');
    if (dyslexiaToggle) dyslexiaToggle.checked = true;
  }
  if (localStorage.getItem('dt-neuro') === '1') {
    document.body.classList.add('neuro');
    if (neuroToggle) neuroToggle.checked = true;
  }
  // Toggle handlers
  if (dyslexiaToggle) {
    dyslexiaToggle.addEventListener('change', () => {
      if (dyslexiaToggle.checked) {
        document.body.classList.add('dyslexia');
        localStorage.setItem('dt-dyslexia', '1');
      } else {
        document.body.classList.remove('dyslexia');
        localStorage.removeItem('dt-dyslexia');
      }
    });
  }
  if (neuroToggle) {
    neuroToggle.addEventListener('change', () => {
      if (neuroToggle.checked) {
        document.body.classList.add('neuro');
        localStorage.setItem('dt-neuro', '1');
      } else {
        document.body.classList.remove('neuro');
        localStorage.removeItem('dt-neuro');
      }
    });
  }
});
// =============================================================================
// Custom Story — Magical Adventures & Help Stories UI Logic
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Magical Adventure example cards
  document.querySelectorAll('.adventure-card').forEach(btn => {
    btn.addEventListener('click', e => {
      const idea = btn.getAttribute('data-prompt') || btn.textContent;
      submitCustomStoryIdea(idea, 'adventure');
    });
  });
  // Magical Adventure open input
  const advInput = document.getElementById('customAdventureInput');
  const advGo = document.getElementById('customAdventureGo');
  if (advInput && advGo) {
    advGo.addEventListener('click', () => {
      const idea = advInput.value.trim();
      if (idea) submitCustomStoryIdea(idea, 'adventure');
    });
    advInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const idea = advInput.value.trim();
        if (idea) submitCustomStoryIdea(idea, 'adventure');
      }
    });
  }
  // Magical Help situation cards
  document.querySelectorAll('.help-card').forEach(btn => {
    if (btn.classList.contains('help-card-other')) return;
    btn.addEventListener('click', e => {
      const situation = btn.getAttribute('data-situation') || btn.textContent;
      submitCustomStoryIdea(situation, 'help');
    });
  });
  // Magical Help open input
  const helpInput = document.getElementById('customHelpInput');
  const helpGo = document.getElementById('customHelpGo');
  if (helpInput && helpGo) {
    helpGo.addEventListener('click', () => {
      const situation = helpInput.value.trim();
      if (situation) submitCustomStoryIdea(situation, 'help');
    });
    helpInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const situation = helpInput.value.trim();
        if (situation) submitCustomStoryIdea(situation, 'help');
      }
    });
  }
});

/**
 * Submits a custom story idea or situation for instant generation.
 * @param {string} idea - The idea or situation text.
 * @param {string} type - 'adventure' or 'help'.
 */
function submitCustomStoryIdea(idea, type) {
  if (!idea) return;
  // For help stories, flag as therapeutic mode
  if (type === 'help') {
    window.handleGenerate && handleGenerate({ mode: 'therapeutic', situation: idea });
  } else {
    // Adventure: treat as custom idea
    window.handleGenerate && handleGenerate({ mode: 'custom', idea });
  }
}

window.toggleFeelings = function () {
  const section = document.getElementById("feelingsSection");
  if (!section) return;
  section.classList.toggle("hidden");
};

// Big Feelings removed from UI — kept internally for feelings chips / startFeeling()
// titleKey/subKey reference i18n keys so cards re-render in the active language
const STORY_TYPES = [
  { type: "sleepy",       icon: "🌙",  titleKey: "card_sleepy_name",    subKey: "card_sleepy_dur" },
  { type: "adventure",    icon: "✨",  titleKey: "card_adventure_name", subKey: "card_adventure_sub" },
  { type: "family-magic", icon: "🏡",  titleKey: "card_family_name",    subKey: "card_family_sub",    badgeKey: "card_custom_new" },
  { type: "hero",         icon: "✨",  titleKey: "card_hero_name",      subKey: "card_hero_sub" },
];

function renderStoryCards() {
  const container = document.getElementById("quickGrid");
  if (!container) return;

  container.replaceChildren();

  STORY_TYPES.forEach((card) => {
    const btn = document.createElement("button");
    btn.className = "story-mode-card";
    btn.type = "button";

    const iconEl = document.createElement("div");
    iconEl.className = "story-mode-icon";
    iconEl.textContent = card.icon;

    const contentEl = document.createElement("div");
    contentEl.className = "story-mode-content";

    const headerEl = document.createElement("div");
    headerEl.className = "story-mode-header";

    const titleEl = document.createElement("h3");
    titleEl.textContent = t(card.titleKey);
    headerEl.appendChild(titleEl);

    if (card.badgeKey) {
      const badgeEl = document.createElement("span");
      badgeEl.className = "mode-badge";
      badgeEl.textContent = t(card.badgeKey);
      headerEl.appendChild(badgeEl);
    }

    const subEl = document.createElement("p");
    subEl.textContent = t(card.subKey);

    contentEl.appendChild(headerEl);
    contentEl.appendChild(subEl);

    btn.appendChild(iconEl);
    btn.appendChild(contentEl);

    btn.addEventListener("click", () => selectStoryType(card.type));
    container.appendChild(btn);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyUILanguage();
  renderStoryCards();
});

window.selectStoryType = function (type) {
  if (type === "hero") {
    startHeroStory();
    return;
  }
  if (type === "sleepy") {
    startSleepyStory();
    return;
  }
  if (type === "adventure") {
    startAdventureStory();
    return;
  }
  if (type === "family-magic") {
    startFamilyMagicStory();
    return;
  }
  if (type === "feelings") {
    toggleFeelings();
  }
};

window.startCustomStory = function () {
  const idea = document.getElementById("storyInput")?.value?.trim();

  if (!idea) {
    showToast("Type something magical first ✨", "info");
    return;
  }

  handleGenerate({
    mode: "custom",
    idea
  });
};

window.startHeroStory = function () {
  handleGenerate({
    mode: "hero"
  });
};

window.startSleepyStory = function () {
  handleGenerate({
    mode: "sleepy"
  });
};

window.startAdventureStory = function () {
  handleGenerate({
    mode: "long-surprise"
  });
};

window.startFamilyMagicStory = function () {
  const child = getSelectedChild();
  if (!child || !child.name || child.name === "a little one") {
    showToast(t("alert_add_child"), "error");
    return;
  }

  if (child.familyMagic?.enabled) {
    // Already onboarded — go straight to story generation
    handleGenerate({ mode: "family-magic" });
  } else {
    showFamilyMagicOnboarding();
  }
};

function showFamilyMagicOnboarding() {
  const modal = $("familyMagicModal");
  if (!modal) return;

  // Reset form state
  familyMagicMembersReset();
  const feelingEl = $("fmCozyFeeling");
  const placeEl = $("fmMagicalPlace");
  if (feelingEl) feelingEl.value = "";
  if (placeEl) placeEl.value = "";

  // Reset comfort item selections
  modal.querySelectorAll(".fm-comfort-item").forEach((btn) => btn.classList.remove("selected"));

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

window.closeFamilyMagicModal = function () {
  const modal = $("familyMagicModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
};

// Family member dynamic list state
let _fmMembers = [];

function familyMagicMembersReset() {
  _fmMembers = [];
  renderFamilyMemberList();
}

window.addFamilyMember = function () {
  const relEl = $("fmRelationship");
  const nameEl = $("fmMemberName");
  const rel = (relEl?.value || "").trim();
  const name = (nameEl?.value || "").trim();

  if (!rel || !name) {
    showToast("Please enter both a relationship and a name ✨", "info");
    return;
  }
  if (_fmMembers.length >= 6) {
    showToast("Maximum 6 family members", "info");
    return;
  }

  _fmMembers.push({ relationship: rel.slice(0, 30), name: name.slice(0, 30) });
  if (relEl) relEl.value = "";
  if (nameEl) nameEl.value = "";
  renderFamilyMemberList();
};

window.removeFamilyMember = function (index) {
  _fmMembers.splice(index, 1);
  renderFamilyMemberList();
};

function renderFamilyMemberList() {
  const list = $("fmMemberList");
  if (!list) return;
  list.replaceChildren();

  _fmMembers.forEach((m, i) => {
    const chip = document.createElement("div");
    chip.className = "fm-member-chip";
    const span = document.createElement("span");
    span.textContent = `${m.relationship} — ${m.name}`;
    const removeBtn = document.createElement("button");
    removeBtn.setAttribute("aria-label", "Remove");
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => removeFamilyMember(i));
    chip.appendChild(span);
    chip.appendChild(removeBtn);
    list.appendChild(chip);
  });
}

window.saveFamilyMagicSetup = async function () {
  if (!state.currentUser) return;

  const modal = $("familyMagicModal");
  const feelingEl = $("fmCozyFeeling");
  const placeEl = $("fmMagicalPlace");

  const comfortItems = [];
  modal?.querySelectorAll(".fm-comfort-item.selected").forEach((btn) => {
    comfortItems.push(btn.dataset.item);
  });

  const familyMagic = {
    enabled: true,
    familyMembers: _fmMembers,
    comfortItems,
    favoriteCozyFeeling:  (feelingEl?.value || "").trim().slice(0, 100),
    favoriteMagicalPlace: (placeEl?.value || "").trim().slice(0, 100),
  };

  // Save to the current child's Firestore record
  const child = getSelectedChild();
  if (!child?.name) return;

  const updatedChildren = state.cachedChildren.map((c) =>
    c.name === child.name ? { ...c, familyMagic } : c
  );

  try {
    const userRef = doc(db, "users", state.currentUser.uid);
    await updateDoc(userRef, { children: updatedChildren });
    state.cachedChildren = updatedChildren;
    closeFamilyMagicModal();
    // Launch story immediately after saving
    handleGenerate({ mode: "family-magic" });
  } catch (err) {
    console.error("Family Magic save failed:", err.code || err.message);
    showToast("Couldn't save Family Magic settings — check your connection.", "info");
  }
};

window.toggleFmComfortItem = function (btn) {
  btn.classList.toggle("selected");
};

window.startFeeling = function (situation) {
  handleGenerate({
    mode: "therapeutic",
    situation
  });
};

window.startWorld = function (world) {
  handleGenerate({
    mode: "custom",
    idea: world
  });
};

// Production-quality bedtime story generator
// =============================================================================

window.addEventListener("error", () => {
  hideLoading();
  setGeneratingState(false);
});
window.addEventListener("unhandledrejection", () => {
  hideLoading();
  setGeneratingState(false);
});

// =============================================================================
// API
// =============================================================================

// Same-origin in all environments — the page and API always share the host.
const API_BASE = "";

// =============================================================================
// App State — all mutable session state lives in the shared state object.
// Modules import { state } from './modules/app-state.js' and mutate properties.
// =============================================================================

const TRIAL_DAYS = 7;
const TRIAL_STORY_CAP = 7;

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

function $(id) {
  return document.getElementById(id);
}

async function buildAuthenticatedJsonHeaders() {
  const headers = { "Content-Type": "application/json" };

  if (state.currentUser) {
    try {
      const idToken = await state.currentUser.getIdToken();
      if (idToken) headers.Authorization = `Bearer ${idToken}`;
    } catch (error) {
      console.error("Fetching auth token failed:", error.code || error.message);
    }
  }

  try {
    const acToken = await getAppCheckToken();
    if (acToken) headers["X-Firebase-AppCheck"] = acToken;
  } catch {}

  return headers;
}

function normalizeDialect(value) {
  const key = String(value || "").trim().toLowerCase();
  return DIALECT_ALIASES[key] || DIALECT_BRITISH;
}

function getCurrentDialect() {
  return normalizeDialect(state.cachedDialect);
}

function getDialectLabel(dialect = getCurrentDialect()) {
  return dialect === DIALECT_AMERICAN ? "American English" : "British English";
}

// =============================================================================
// Global Idea Bank — community learning system
// Stores successful story ideas so future generations can be inspired by
// what worked well for children of similar ages worldwide.
// =============================================================================

async function saveToGlobalIdeaBank({ originalIdea, storyTitle, ageGroup, type, language }) {
  if (!state.currentUser || !originalIdea) return;
  try {
    // Use shared db instance from firebase-init.js (never create new instance)
    await addDoc(collection(db, "globalIdeaBank"), {
      originalIdea,
      storyTitle: storyTitle || null,
      ageGroup,
      type,
      language,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Non-critical — silently ignore
  }
}

async function getGlobalIdeaInspiration(ageGroup, language) {
  try {
    // Use shared db instance from firebase-init.js (never create new instance)
    const q = query(
      collection(db, "globalIdeaBank"),
      where("ageGroup", "==", ageGroup),
      where("language", "==", language),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data().originalIdea).filter(Boolean);
  } catch {
    return [];
  }
}


async function saveLanguageToFirestore(langCode) {
  // Always persist locally first — instant, works offline, survives CSP issues
  try { localStorage.setItem(LS_LANG_KEY, langCode); } catch {}
  if (!state.currentUser) return;
  try {
    // Use shared db instance from firebase-init.js (never create new instance)
    await setDoc(doc(db, "users", state.currentUser.uid), { language: langCode }, { merge: true });
  } catch (err) {
    console.error("Failed to save language preference:", err);
  }
}

async function loadUserProfile() {
  if (!state.currentUser) return { isNewUser: false };
  try {
    // Use shared db instance from firebase-init.js (never create new instance)
    const snap = await getDoc(doc(db, "users", state.currentUser.uid));
    if (!snap.exists()) {
      // Brand new user — show language screen
      return { isNewUser: true };
    }
    const data = snap.data();
    // language === null means signup created the doc but the user hasn't
    // chosen a language yet — treat as new user and show the language screen.
    if (data.language === null) {
      return { isNewUser: true };
    }
    if (data.language && SUPPORTED_LANGUAGES.includes(data.language)) {

      setCurrentLanguage(data.language);
  
      // Keep state.cachedDialect in sync for en-GB/en-US
      if (data.language === "en-US") state.cachedDialect = "en-US";
      else state.cachedDialect = "en-GB";
    } else {
      // Existing user with no language set — default silently

      setCurrentLanguage("en-GB");
  
      saveLanguageToFirestore("en-GB");
    }
    return { isNewUser: false };
  } catch (err) {
    console.error("loadUserProfile failed:", err.code || err.message);
    showToast("Couldn't load your profile — check your connection and try again.", "info");
    return { isNewUser: false };
  }
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
  // Dialect substitution only applies to English variants
  if (!["en-GB", "en-US"].includes(dialect)) return String(text);

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
  if (normalized === state.cachedDialect) {
    renderDialectControls();
    return;
  }

  const previousDialect = state.cachedDialect;
  state.cachedDialect = normalized;
  renderDialectControls();

  if (!state.currentUser) return;

  try {
    const userRef = doc(db, "users", state.currentUser.uid);
    await updateDoc(userRef, {
      storyDialect: normalized,
      storyLocale: normalized,
    });
  } catch (error) {
    state.cachedDialect = previousDialect;
    renderDialectControls();
    console.error("Saving dialect preference failed:", error);
    showToast(t("alert_lang_save_fail"), "error");
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
  state.cachedTrial = {
    startedAt: new Date().toISOString(),
    storiesUsed: 0,
    status: "paid",
  };
}

/** Returns { active, expired, paid, daysLeft, storiesLeft } for the current user. */
function getTrialStatus() {
  return { active: false, expired: false, paid: true, daysLeft: Infinity, storiesLeft: Infinity };
}

function updatePackVisibility() {
  const packBtn = document.getElementById("packBtn");
  if (!packBtn) return;
  const show = state.cachedIsPremium && state.cachedStoriesRemaining <= 5;
  packBtn.classList.toggle("hidden", !show);
}

function renderPremiumUI() {
  // Premium status UI removed — not displayed in the app
}

/** Update the banner + paywall visibility based on current trial status. */
function renderTrialState() {
  renderPremiumUI();
  updatePackVisibility();

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

/**
 * Returns true iff the user has the right to generate a story right now —
 * either an active subscription or at least one paid credit (one-off or
 * extras). The server is the source of truth via consumeStory; this client
 * check is purely to avoid serving a free local procedural story when the
 * API path is unavailable (offline, server error, rate limit).
 */
function canGenerateStory() {
  if (state.cachedIsPremium) return true;
  if (typeof teddyCount === "number" && teddyCount > 0) return true;
  // teddyCount === null means we haven't fetched credit state yet. Be
  // conservative: refuse the procedural fallback rather than risk handing
  // out a free story to an unknown user.
  return false;
}

function isReadingModeOpen() {
  const readingMode = $("readingMode");
  return !!readingMode && !readingMode.classList.contains("hidden");
}

/** Decrement local teddy count after a successful generation and refresh from server. */
async function recordStoryUsed() {
  // Optimistic local decrement for instant UI feedback
  if (teddyCount !== null && teddyCount > 0) {
    teddyCount -= 1;
    updateTeddyCounterUI();
  }
  // Re-fetch authoritative count from server in background
  try {
    await fetchTeddyCount();
  } catch (_) {
    // Non-critical — UI already updated optimistically
  }
}

async function handleSubscribe(type = "subscription") {
  const isSub = type === "subscription";
  const btn = isSub
    ? $("subscribeBtn")
    : ($("oneOffBtn") || $("authOneOffBtn"));
  const originalText = btn?.textContent || "";
  if (btn) { btn.disabled = true; btn.textContent = "Loading…"; }

  try {
    const token = state.currentUser ? await state.currentUser.getIdToken() : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/checkout`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type }),
    });
    const data = await res.json();

    if (res.status === 401 && type !== "oneoff") {
      showToast("Please log in or sign up first to buy your 99p story", "info");
      return;
    }

    if (data.url) {
      trackEvent("checkout_started", { type });
      window.location.href = data.url;
    } else if (data.disabled) {
      showPaymentComingSoon();
    } else {
      throw new Error(data.error || "No checkout URL returned");
    }
  } catch (err) {
    console.error("Checkout error:", err);
    showPaymentComingSoon();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}

function getGuestCheckoutSessionFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  const paid = params.get("paid");
  const cs = params.get("cs");
  if (paid === "oneoff" && cs) return cs;
  return null;
}

function showSoftPremiumUpsell(childName) {
  if (isReadingModeOpen()) return;
  const existing = document.getElementById("softUpsellCard");
  if (existing) existing.remove();

  const card = document.createElement("div");
  card.id = "softUpsellCard";
  card.className = "guest-soft-upsell";
  card.innerHTML = `
    <div class="guest-soft-upsell-glow" aria-hidden="true"></div>
    <div class="guest-soft-upsell-stars" aria-hidden="true">★ ✦ ★</div>
    <div class="guest-soft-upsell-content">
      <div class="guest-soft-upsell-text">
        <p class="guest-soft-upsell-title">That was just a taste ✨</p>
        <p class="guest-soft-upsell-subtitle">Subscribe for nightly adventures — with memory, continuing characters, and keepsake rewards that grow with ${childName || "your child"}.</p>
      </div>
      <div class="guest-soft-upsell-actions">
        <button id="softUpsellClose" class="btn secondary">Maybe later</button>
        <button id="softUpsellBuy" class="btn primary">&pound;6.99/month</button>
      </div>
    </div>
  `;
  document.body.appendChild(card);
  card.querySelector("#softUpsellClose")?.addEventListener("click", () => card.remove());
  card.querySelector("#softUpsellBuy")?.addEventListener("click", () => {
    card.remove();
    handleSubscribe("subscription");
  });
}

function openGuestOneoffPrompt(sessionId) {
  if (!sessionId) return;
  const existing = document.getElementById("guestOneoffModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "guestOneoffModal";
  modal.className = "guest-oneoff-modal";
  modal.innerHTML = `
    <div class="guest-oneoff-panel">
      <div class="guest-oneoff-panel-stars" aria-hidden="true">★ ✦ ★</div>
      <h3 class="guest-oneoff-title">Payment confirmed</h3>
      <p class="guest-oneoff-subtitle">Tell us who tonight's magical story is for.</p>

      <label class="guest-oneoff-label" for="guestChildName">Child's first name</label>
      <input id="guestChildName" class="guest-oneoff-input" type="text" maxlength="50" placeholder="e.g. Sophia" />

      <label class="guest-oneoff-label" for="guestChildGender">Boy or girl?</label>
      <select id="guestChildGender" class="guest-oneoff-input">
        <option value="girl">Girl</option>
        <option value="boy">Boy</option>
        <option value="neutral">Other</option>
      </select>

      <div class="guest-oneoff-actions">
        <button id="guestOneoffLater" class="btn secondary">Later</button>
        <button id="guestOneoffGenerate" class="btn primary">Create magical story</button>
      </div>
      <p id="guestOneoffStatus" class="guest-oneoff-status" aria-live="polite"></p>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#guestOneoffLater")?.addEventListener("click", () => modal.remove());
  modal.querySelector("#guestOneoffGenerate")?.addEventListener("click", async () => {
    const name = (modal.querySelector("#guestChildName")?.value || "").trim();
    const gender = modal.querySelector("#guestChildGender")?.value || "neutral";
    const genBtn = modal.querySelector("#guestOneoffGenerate");
    const laterBtn = modal.querySelector("#guestOneoffLater");
    const panel = modal.querySelector(".guest-oneoff-panel");
    const statusEl = modal.querySelector("#guestOneoffStatus");
    const phases = [
      "✨ Gathering stardust...",
      "🌙 Weaving your magical story...",
      "📖 Polishing every page for bedtime...",
    ];
    let phaseIndex = 0;
    let phaseTimer = null;
    if (!name) {
      showToast("Please add your child's first name", "info");
      return;
    }

    try {
      // Show loading state inside the modal so user sees feedback immediately
      if (genBtn) { genBtn.disabled = true; genBtn.textContent = "✨ Writing your story…"; }
      if (laterBtn) laterBtn.disabled = true;
      if (panel) panel.style.opacity = "0.8";
      if (statusEl) {
        statusEl.textContent = phases[0];
        statusEl.classList.add("active");
      }
      phaseTimer = setInterval(() => {
        phaseIndex = (phaseIndex + 1) % phases.length;
        if (statusEl) statusEl.textContent = phases[phaseIndex];
      }, 2600);

      const payload = {
        checkoutSessionId: sessionId,
        name,
        gender,
        language: getCurrentLanguage(),
        dialect: state.cachedDialect,
      };

      const _guestAcToken = await getAppCheckToken().catch(() => null);
      const _guestHeaders = { "Content-Type": "application/json" };
      if (_guestAcToken) _guestHeaders["X-Firebase-AppCheck"] = _guestAcToken;

      let res;
      let lastErr;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          res = await fetchWithTimeout(
            `${API_BASE}/api/guest/generate-oneoff`,
            {
              method: "POST",
              headers: _guestHeaders,
              body: JSON.stringify(payload),
            },
            150000
          );
          break;
        } catch (err) {
          lastErr = err;
          const msg = String(err?.message || "");
          const isTransient = msg.includes("timed out") || msg.includes("Failed to fetch") || msg.includes("NetworkError");
          if (!isTransient || attempt === 2) throw err;
        }
      }
      if (!res) throw lastErr || new Error("Could not generate your one-off story.");

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Could not generate your one-off story.");
      }

      modal.remove();
      localStorage.removeItem("dt-guest-oneoff-cs");
      state.guestOneoffSessionId = null;

      const story = typeof data?.story === "string" && data.story.trim()
        ? applyDialectToText(data.story, getCurrentLanguage())
        : "No story was returned. Please try again.";
      const title = applyDialectToText(data?.title || t("story_for", { name }), getCurrentLanguage());
      displayStory(title, story, { childName: name, mode: "random" });
      enterReadingMode();
      showSoftPremiumUpsell(name);
    } catch (error) {
      const msg = String(error?.message || "");
      const paymentError = /payment|checkout|purchase validation/i.test(msg);
      if (paymentError) {
        showToast(msg || "Payment validation failed. Please try again.", "error");
      } else {
        showToast(msg || "Could not generate your one-off story. Please try again.", "error");
      }
    } finally {
      if (phaseTimer) clearInterval(phaseTimer);
      // If generation fails and modal is still open, restore controls.
      if (modal.isConnected) {
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = "Create magical story"; }
        if (laterBtn) laterBtn.disabled = false;
        if (panel) panel.style.opacity = "1";
        if (statusEl) {
          statusEl.classList.remove("active");
          statusEl.textContent = "";
        }
      }
      hideLoading();
    }
  });
}

function showPaymentComingSoon() {
  const el = document.createElement("div");
  el.className = "card coming-soon-toast";
  el.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;padding:14px 24px;text-align:center;";
  el.textContent = "Payments coming soon — check back shortly!";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showUpsell(childName) {
  const name = childName || "your little one";
  document.querySelector(".upsell-card")?.remove();

  const el = document.createElement("div");
  el.className = "upsell-card";
  el.innerHTML = `
    <div class="upsell-overlay" aria-hidden="true"></div>
    <div class="upsell-panel card">
      <div class="upsell-stars" aria-hidden="true">★ ✦ ★</div>
      <h2 class="upsell-title">A magical story for ${name}</h2>
      <p class="upsell-copy">Create magical ongoing adventures that continue night after night — with memory, continuity, and a world built just for your child.</p>
      <p class="upsell-meta">40 premium adventures/month · Story memory · Continue tomorrow · No ads</p>
      <div class="upsell-actions">
        <button class="btn primary btn-lg" id="upsellOneOffBtn">Tonight's story — 99p</button>
        <button class="btn secondary btn-lg" id="upsellSubBtn">Start the adventure — £6.99/month</button>
      </div>
      <button class="btn ghost" id="upsellDismissBtn">Maybe later</button>
    </div>
  `;

  document.body.appendChild(el);
  el.querySelector("#upsellOneOffBtn").addEventListener("click", () => { el.remove(); handleSubscribe("oneoff"); });
  el.querySelector("#upsellSubBtn").addEventListener("click", () => { el.remove(); handleSubscribe("subscription"); });
  el.querySelector("#upsellDismissBtn").addEventListener("click", () => el.remove());
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

// =============================================================================
// Story Sharing — warm, sentimental export via Web Share API or clipboard
// =============================================================================

async function shareStory() {
  const title = state.currentStoryTitle || "A Bedtime Story";
  const text = state.currentStoryText || "";
  const childName = state.currentStoryChildName;

  if (!text) {
    showToast("Nothing to share yet — generate a story first.", "info");
    return;
  }

  // Sentimental intro line, not a promotional tagline
  const intro = childName
    ? `✨ A magical bedtime story for ${childName}`
    : `✨ A magical bedtime story`;

  const fullText = `${intro}\n"${title}"\n\n${text}`;

  // Native Web Share API (Android share sheet, iOS sheet, etc.)
  if (navigator.share) {
    try {
      await navigator.share({
        title: `"${title}" — DreamTalez`,
        text: fullText.slice(0, 3000), // keep within share sheet limits
      });
      trackEvent("story_shared", { method: "native", childName });
      return;
    } catch (err) {
      if (err.name === "AbortError") return; // user cancelled — not an error
      // Fall through to clipboard
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(fullText);
    showToast("✨ Story copied — paste anywhere to share the magic.", "success");
    trackEvent("story_shared", { method: "clipboard", childName });
  } catch {
    showToast("Select the story text and copy it to share.", "info");
  }
}

function enterReadingMode() {
  const readingMode = $("readingMode");
  const readingTitle = $("readingTitle");
  const readingText = $("readingText");
  const saveBtn = $("saveProgressBtn");
  if (!readingMode || !readingTitle || !readingText) return;

  readingTitle.textContent = state.currentStoryTitle || t("your_story");
  renderStoryWithReveal(formatStory(state.currentStoryText), getReadingMode());

  // Continuation is a subscription-only feature — hide the button for guests and oneoff users
  if (saveBtn) {
    const isQuick = state.currentStoryTitle === "Quick Story";
    const isOneoff = state.currentStoryIsOneoff === true;
    saveBtn.classList.toggle("hidden", isQuick || !state.cachedIsPremium || isOneoff);
  }

  // Share button — shown for any AI-generated story (not Quick Story placeholder)
  const shareBtn = $("shareStoryBtn");
  if (shareBtn) {
    shareBtn.classList.toggle("hidden", !state.currentStoryText || state.currentStoryTitle === "Quick Story");
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
  trackEvent("story_read", { childName: child?.name, mode: state.currentStoryMode });

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
  const readTogetherBtn = $("toggleReadTogether");
  const saveProgressBtn = $("saveProgressBtn");
  const readingMode = $("readingMode");
  if (!readingMode) return;

  if (backBtn) {
    backBtn.addEventListener("click", () => exitReadingMode());
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

  if (readTogetherBtn) {
    if (localStorage.getItem("readingTogether") === "1") {
      readingMode.classList.add("read-together");
      readTogetherBtn.classList.add("active");
    }
    readTogetherBtn.addEventListener("click", () => {
      readingMode.classList.toggle("read-together");
      const on = readingMode.classList.contains("read-together");
      localStorage.setItem("readingTogether", on ? "1" : "0");
      readTogetherBtn.classList.toggle("active", on);
    });
  }

  if (saveProgressBtn) {
    saveProgressBtn.addEventListener("click", async () => {
      // Continuation is a premium (subscription) feature only
      if (!state.cachedIsPremium) {
        showSoftPremiumUpsell(state.currentStoryChildName);
        return;
      }

      localStorage.setItem("readingScroll", readingMode.scrollTop || 0);

      const text = state.currentStoryText || "";
      const words = text.trim().split(/\s+/).filter(Boolean);
      // Compact ~150-word narrative summary — enough context for a rich sequel
      const summaryWords = Math.min(180, Math.floor(words.length / 3));
      const summary = words.slice(0, summaryWords).join(" ") + (summaryWords < words.length ? "…" : "");

      const child = getSelectedChild();
      // Pull the full profile (raw cache has pet, bestFriend, favToy etc.)
      const rawChild = state.cachedChildren[state.selectedChildIndex] || {};

      // Build the richest possible character list from everything we know
      const characters = [rawChild.pet, rawChild.bestFriend, rawChild.favToy]
        .filter(Boolean)
        .map(s => String(s).trim().slice(0, 40));

      // Derive emotional tone from mode so the sequel starts in the right register
      const TONE_BY_MODE = {
        sleepy: "calm and dreamy",
        hero: "adventurous and brave",
        feelings: "warm and reflective",
        today: "personal and real",
        "family-magic": "magical and family-centred",
        adventure: "exciting and wonder-filled",
        random: "magical and warm",
      };
      const emotionalTone = TONE_BY_MODE[state.currentStoryMode] || "magical and warm";

      const continuation = {
        title: state.currentStoryTitle || "",
        summary,
        childName: state.currentStoryChildName || "",
        mode: state.currentStoryMode || "hero",
        ageBand: state.currentStoryAgeBand || "",
        savedAt: new Date().toISOString(),
        recurringCharacters: characters,
        emotionalTone,
        interests: Array.isArray(child.interests) ? child.interests.slice(0, 5) : [],
        seriesContinuityData: {
          age: child.age || rawChild.age || 5,
          gender: child.gender || rawChild.gender || "neutral",
          world: state.currentStoryMode || "hero",
        },
      };

      // Firestore-backed sync — survives reinstalls and device switches
      await saveContinuationToFirestore(continuation);

      saveProgressBtn.textContent = "✓ Saved — the adventure continues tonight ✨";
      saveProgressBtn.disabled = true;
      setTimeout(() => {
        saveProgressBtn.textContent = t("continue_tomorrow");
        saveProgressBtn.disabled = false;
      }, 3000);

      updateContinueSection();
    });
  }

  // Share button
  const shareStoryBtn = $("shareStoryBtn");
  if (shareStoryBtn) {
    shareStoryBtn.addEventListener("click", () => shareStory());
  }

  // Escape key closes reading mode
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !readingMode.classList.contains("hidden")) {
      exitReadingMode();
    }
  });
}

// =============================================================================
// Analytics — fire-and-forget event ping
// =============================================================================

// Fetch with a hard client-side timeout — matches the 90s server-side budget.
// Merges Content-Type into headers automatically; throws a clear error on timeout.
async function fetchWithTimeout(url, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Request timed out");
    throw err;
  } finally {
    clearTimeout(id);
  }
}

// Poll /api/job/:jobId until the story is ready (max 5 min).
// First check fires after 800ms so a fast lean job is visible quickly,
// then every 1500ms — short enough to feel snappy, long enough to avoid
// thrashing Firestore reads.
async function pollJob(jobId, maxWaitMs = 5 * 60 * 1000) {
  const start = Date.now();
  let delay = 800;
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = 1500;
    try {
      const headers = {};
      if (state.currentUser) {
        try {
          const tok = await state.currentUser.getIdToken();
          if (tok) headers["Authorization"] = `Bearer ${tok}`;
        } catch {}
      }
      const res = await fetch(`${API_BASE}/api/job/${jobId}`, { headers });
      if (res.status === 401) {
        throw Object.assign(new Error("AI unavailable, using procedural fallback."), { proceduralFallback: true });
      }
      const data = await res.json();
      if (data.status === "done") return data;
      if (data.status === "failed" || data.status === "expired") {
        throw Object.assign(new Error("AI unavailable, using procedural fallback."), { proceduralFallback: true });
      }
      // status === "pending" — keep polling
    } catch (err) {
      if (err.proceduralFallback) throw err;
      // Network blip — keep trying
    }
  }
  throw Object.assign(new Error("AI unavailable, using procedural fallback."), { proceduralFallback: true });
}

// When the phone wakes and the app becomes visible again, resume polling
// any in-progress job rather than leaving the user on a blank loading screen.
// Guards against the main flow's pollJob() also resolving simultaneously: whoever
// removes "dt-pending-job" from localStorage first is the one that displays the
// story — JS is single-threaded so this check+remove is atomic across microtasks.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  const pendingJobId = localStorage.getItem("dt-pending-job");
  if (!pendingJobId || !generationInProgress) return;

  try {
    const data = await pollJob(pendingJobId);
    // If the main flow already handled this job while we were polling, bail.
    // localStorage ops are synchronous; this check is safe across concurrent microtasks.
    if (!localStorage.getItem("dt-pending-job")) return;
    localStorage.removeItem("dt-pending-job");
    if (data?.story) {
      const story = applyDialectToText(data.story, getCurrentLanguage());
      const title = applyDialectToText(data.title || "Your Story", getCurrentLanguage());
      const child = getSelectedChild();
      displayStory(title, story, { childName: child?.name, mode: state.currentStoryMode || "random" });
      document.body.style.overflow = "";
      document.getElementById("story-loading")?.classList.add("hidden");
      generationInProgress = false;
      enterReadingMode();
    }
  } catch {
    // If resume fails, leave the loading screen — the main flow's catch will handle it
  }
});

function trackEvent(event, data = {}) {
  try {
    (async () => {
      const headers = { "Content-Type": "application/json" };
      if (state.currentUser) {
        try {
          const tok = await state.currentUser.getIdToken();
          if (tok) headers["Authorization"] = `Bearer ${tok}`;
        } catch {}
      }
      fetch(`${API_BASE}/track`, {
        method: "POST",
        headers,
        body: JSON.stringify({ event, data, ts: Date.now() }),
      }).catch(() => {});
    })();
  } catch {}
}

// =============================================================================
// Return User Detection
// =============================================================================

function checkReturnUser() {
  try {
    const lastVisit = localStorage.getItem("dt-last-visit");
    const today = new Date().toDateString();
    if (!lastVisit) {
      trackEvent("first_open");
    } else if (lastVisit !== today) {
      trackEvent("returned_next_day");
      // Show a warm welcome-back toast after the home page settles
      setTimeout(() => {
        const child = getSelectedChild();
        const name = child?.name && child.name !== "a little one" ? ` ${child.name}` : "";
        const toast = document.createElement("div");
        toast.style.cssText =
          "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);" +
          "background:rgba(30,20,60,0.97);color:#fff;border:1px solid rgba(255,208,96,0.4);" +
          "border-radius:20px;padding:12px 22px;font-size:14px;font-weight:600;" +
          "z-index:9999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.45);" +
          "text-align:center;";
        toast.textContent = `🌙 Welcome back! Ready for${name}'s story tonight?`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
      }, 1800);
    }
    localStorage.setItem("dt-last-visit", today);
  } catch {}
}

// =============================================================================
// Hot Story Cache (localStorage, 10-min TTL)
// Serves the 2nd+ surprise story INSTANTLY — zero loading time.
// After each generated story, a replacement is silently pre-generated
// so the next tap feels like magic.
// =============================================================================

const HOT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function _hotKey(childName, length) {
  return `dt-hot-${childName}-${length}`;
}

function getHotCachedStory(childName, length) {
  try {
    const raw = localStorage.getItem(_hotKey(childName, length));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > HOT_CACHE_TTL) {
      localStorage.removeItem(_hotKey(childName, length));
      return null;
    }
    return parsed;
  } catch { return null; }
}

function saveHotCachedStory(childName, length, title, text) {
  try {
    localStorage.setItem(_hotKey(childName, length), JSON.stringify({ title, text, ts: Date.now() }));
  } catch {}
}

function clearHotCachedStory(childName, length) {
  try { localStorage.removeItem(_hotKey(childName, length)); } catch {}
}

async function preloadHotStory(child, storyLength) {
  if (!state.currentUser || !child?.name || child.name === "a little one") return;
  if (generationInProgress) return;
  if (getHotCachedStory(child.name, storyLength)) return; // already cached

  try {
    const token = await state.currentUser.getIdToken();
    if (!token) return;
    const baseInterests = child.interests?.length
      ? child.interests.join(", ")
      : "adventure, animals, magic";
    const res = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        name: formatName(child.name),
        age: String(child.age || 5),
        interests: enrichInterestsWithContext(baseInterests, child),
        length: storyLength,
        mode: "random",
        language: getCurrentLanguage(),
        dialect: state.cachedDialect,
        appearance: child.appearance || undefined,
        personalWorld: buildPersonalWorld(child),
      }),
    });
    const remaining = Number(res.headers.get("X-RateLimit-Remaining") ?? 99);
    if (remaining < 4) return;
    if (!res.ok) return;
    const data = await res.json();
    if (data?.fallback || !data?.story) return;
    saveHotCachedStory(child.name, storyLength,
      data.title || `${child.name}'s Story`,
      applyDialectToText(data.story, getCurrentLanguage())
    );
  } catch { /* silent — user never knows this ran */ }
}

// =============================================================================
// Onboarding Wizard (new users: name → age/gender → interests → first story)
// =============================================================================

const _wizardData = { name: "", age: 5, gender: "", interests: [] };

function wizardNext(step) {
  if (step === 1) {
    const nameVal = ($("wizardName")?.value || "").trim();
    if (!nameVal) return;
    if (!isClientInputSafe(nameVal)) { showSafetyMessage(); return; }
    _wizardData.name = nameVal;
    const displays = document.querySelectorAll("#wizardNameDisplay, #wizardNameDisplay3");
    displays.forEach((el) => { el.textContent = nameVal; });
    $("wizardStep1")?.classList.add("hidden");
    $("wizardStep2")?.classList.remove("hidden");
    _wizardDots(2);
  } else if (step === 2) {
    const age = parseInt($("wizardAge")?.value || "5");
    if (!age || age < 1 || age > 18) return;
    _wizardData.age = age;
    $("wizardStep2")?.classList.add("hidden");
    $("wizardStep3")?.classList.remove("hidden");
    _wizardDots(3);
  }
}
window.wizardNext = wizardNext;

function wizardSelectGender(btn) {
  document.querySelectorAll(".wizard-gender-btn").forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");
  _wizardData.gender = btn.dataset.gender || "";
  const btn2 = $("wizardNext2");
  const age = parseInt($("wizardAge")?.value || "0");
  if (btn2) btn2.disabled = !(age >= 1 && age <= 18);
}
window.wizardSelectGender = wizardSelectGender;

function wizardToggleChip(chip) {
  const interest = chip.dataset.interest;
  if (!interest) return;
  const idx = _wizardData.interests.indexOf(interest);
  if (idx === -1) {
    _wizardData.interests.push(interest);
    chip.classList.add("selected");
  } else {
    _wizardData.interests.splice(idx, 1);
    chip.classList.remove("selected");
  }
  const btn3 = $("wizardNext3");
  if (btn3) btn3.disabled = _wizardData.interests.length === 0;
}
window.wizardToggleChip = wizardToggleChip;

function _wizardDots(active) {
  for (let i = 1; i <= 3; i++) {
    const dot = $(`wDot${i}`);
    if (!dot) continue;
    dot.classList.toggle("active", i === active);
    dot.classList.toggle("done", i < active);
  }
}

async function wizardFinish() {
  // Save child to Firestore using existing saveChild machinery
  const { name, age, gender, interests } = _wizardData;
  if (!name || !interests.length) return;

  try { localStorage.setItem("dt-wizard-done", "1"); } catch {}
  trackEvent("onboarding_wizard_complete", { name, age, gender, interests: interests.length });

  // Temporarily populate the child form fields and call saveChild
  const nameEl = $("childName"); if (nameEl) nameEl.value = name;
  const ageEl = $("childAge"); if (ageEl) ageEl.value = String(age);
  const genderEl = $("childGender"); if (genderEl) genderEl.value = gender;
  const interestsEl = $("childInterests"); if (interestsEl) interestsEl.value = interests.join(", ");

  await saveChild(); // saves to Firestore + updates state.cachedChildren
  navigateTo("home");

  // Immediately generate their first story
  await new Promise((r) => setTimeout(r, 400)); // let home settle
  handleGenerate("medium-surprise");
}
window.wizardFinish = wizardFinish;

// =============================================================================
// UI — Page Navigation
// =============================================================================

const ALL_PAGES = ["authScreen", "pageLanguage", "pageIntro", "pageWizard", "pageHome", "pageChildren", "pageCreate", "pageToday", "pageLibrary", "pageSettings", "pagePrivacy", "pageTerms", "storyCard"];

function navigateTo(page) {
  // Trust & Safety page navigation
  if (page === 'trust') {
    window.location.href = '/trust.html';
    return;
  }
  state.previousPage = state.currentPage;
  state.currentPage = page;

  // Map page name to DOM id
  const pageIdMap = {
    auth: "authScreen",
    language: "pageLanguage",
    intro: "pageIntro",
    wizard: "pageWizard",
    home: "pageHome",
    children: "pageChildren",
    create: "pageCreate",
    today: "pageToday",
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
    nav.classList.toggle("hidden", page === "auth" || page === "intro" || page === "wizard");
    nav.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === page);
    });
  }

  // Page-specific setup
  if (page === "home") {
    renderStoryCards();
    updateHomeChildCard();
    updateStreakDisplay();
    renderTrialState();
  } else if (page === "children") {
    renderChildrenList();
    clearChildForm();
    setEditMode(null);
  } else if (page === "today") {
    const child = getSelectedChild();
    const label = $("todayChildLabel");
    if (label) label.textContent = child.name !== "a little one" ? t("story_for", { name: child.name }) : "";
  } else if (page === "create") {
    const child = getSelectedChild();
    const label = $("createChildLabel");
    const titleEl = $("createPageTitle");
    const lengthInput = $("createLength");
    const length = lengthInput?.value || "medium";
    if (label) label.textContent = child.name !== "a little one" ? t("story_for", { name: child.name }) : "";
    if (titleEl) titleEl.textContent = length === "long" ? t("long_my_idea") : t("medium_my_idea");
  } else if (page === "library") {
    renderLibrary();
    renderLibraryChildFilter();
  } else if (page === "settings") {
    const emailEl = $("settingsEmail");
    if (emailEl && state.currentUser) emailEl.textContent = state.currentUser.email || "";
    const verEl = $("settingsVersion");
    if (verEl) verEl.textContent = `DreamTalez v${APP_VERSION}`;
    renderDialectControls();
    // Highlight active language in settings grid
    const sGrid = $("settingsLangGrid");
    if (sGrid) {
      sGrid.querySelectorAll(".lang-btn").forEach((b) => {
        b.classList.toggle("selected", b.dataset.lang === getCurrentLanguage());
      });
    }
    const sStatus = $("settingsLangStatus");
    if (sStatus) sStatus.textContent = `${t("lang_saved_status")} ${LANGUAGE_LABELS[getCurrentLanguage()] || getCurrentLanguage()}`;
  }

  // Re-apply translations so page-setup functions can't override them
  applyUILanguage();

  // Scroll to top of the new page
  const targetEl = $(targetId);
  const scrollEl = targetEl?.querySelector(".page-scroll");
  if (scrollEl) scrollEl.scrollTop = 0;
}

function openCreatePage(length) {
  const lengthInput = $("createLength");
  if (lengthInput) lengthInput.value = length || "medium";
  const ideaInput = $("createIdea");
  if (ideaInput) ideaInput.value = "";
  navigateTo("create");
}

function closeStoryCard() {
  navigateTo(state.previousPage || "home");
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return t("hero_greeting_morning");
  if (h < 17) return t("hero_greeting_afternoon");
  if (h < 21) return t("hero_greeting_evening");
  return t("hero_greeting_night");
}

/** Update the active child card + story choices on the home page. */
function updateHomeChildCard() {
  const childCard = $("activeChildCard");
  const nameEl = $("activeChildName");
  const metaEl = $("activeChildMeta");
  const choicesEl = $("storyChoices");
  const welcomeEl = $("welcomeBanner");
  const greetingEl = $("homeGreeting");
  const heroTitleEl = $("heroTitle");
  const avatarEl = $("homeAvatar");

  if (state.cachedChildren.length === 0) {
    if (childCard) childCard.classList.add("hidden");
    if (choicesEl) choicesEl.classList.add("hidden");
    if (welcomeEl) welcomeEl.classList.remove("hidden");
    return;
  }

  if (welcomeEl) welcomeEl.classList.add("hidden");

  // Clamp index
  if (state.selectedChildIndex >= state.cachedChildren.length) state.selectedChildIndex = 0;
  const child = state.cachedChildren[state.selectedChildIndex] || {};

  if (childCard) childCard.classList.remove("hidden");
  if (nameEl) nameEl.textContent = child.name || "Child";
  if (metaEl) {
    const parts = [`${t("age_label")} ${child.age || "?"}`];
    const g = (child.gender || "").toLowerCase();
    if (g === "girl" || g === "boy") parts.push(t(`gender_${g}`));
    metaEl.textContent = parts.join(" \u2022 ");
  }
  if (greetingEl) greetingEl.textContent = getTimeGreeting();
  if (heroTitleEl) heroTitleEl.textContent = t("hero_title", { name: child.name || "Your child" });
  if (avatarEl) avatarEl.textContent = (child.name || "?").charAt(0).toUpperCase();

  // Set hero section background-image based on child gender (cinematic, full-bleed)
  const heroSection = document.querySelector('.home-hero-v2');
  if (heroSection) {
    const g = (child.gender || "").toLowerCase();
    let bgUrl = "/images/girl-hero.png";
    if (g === "boy" || g === "male") {
      bgUrl = "/images/boy-hero.png";
    } else if (g === "girl" || g === "female") {
      bgUrl = "/images/girl-hero.png";
    }
    heroSection.style.backgroundImage = `url('${bgUrl}')`;
    heroSection.style.backgroundSize = 'cover';
    heroSection.style.backgroundPosition = 'center top';
    heroSection.style.backgroundRepeat = 'no-repeat';
  }

  if (choicesEl) choicesEl.classList.remove("hidden");
  updateContinueSection();
}

/** Populate the "Continue Your Last Story" strip on the home page. */
function updateContinueSection() {
  const section = $("continueSection");
  const titleEl = $("continueTitle");
  const metaEl = $("continueMeta");
  const playBtn = $("continuePlayBtn");
  const sequelBtn = $("continueStoryBtn");
  if (!section) return;

  if (state.cachedChildren.length === 0 || state.cachedLibrary.length === 0) {
    section.classList.add("hidden");
    return;
  }

  const child = state.cachedChildren[state.selectedChildIndex] || {};
  const stories = state.cachedLibrary
    .filter((s) => s && s.childName === child.name)
    .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));

  if (stories.length === 0) {
    section.classList.add("hidden");
    return;
  }

  const last = stories[0];
  if (titleEl) titleEl.textContent = last.title || "Untitled Story";
  if (metaEl) metaEl.textContent = formatSavedDate(last.savedAt) || t("continue_last_meta");
  if (playBtn) playBtn.onclick = () => reReadFromLibrary(last.id);

  // Show sequel button when a Firestore-synced continuation exists for this child
  if (sequelBtn) {
    // Firestore (state) is authoritative; localStorage is offline fallback
    let savedState = state.cachedContinuation;
    if (!savedState) {
      try { savedState = JSON.parse(localStorage.getItem("continuationState") || "null"); } catch {}
    }
    const hasSequel = savedState && savedState.childName === child.name;
    sequelBtn.classList.toggle("hidden", !hasSequel);
    if (hasSequel && savedState) {
      sequelBtn.textContent = t("continue_sequel_dynamic", { title: savedState.title || t("continue_last_meta") });
    }
  }

  section.classList.remove("hidden");
}

/**
 * Generate a sequel to the last saved story using the stored continuation
 * context as seriesContext. Called by the "Continue story tonight" button.
 */
function continueLastStory() {
  // Firestore (state) is authoritative; localStorage is offline fallback
  let saved = state.cachedContinuation;
  if (!saved) {
    try { saved = JSON.parse(localStorage.getItem("continuationState") || "null"); } catch {}
  }
  if (!saved || !saved.childName) {
    showToast("No saved story to continue — save a story first.", "info");
    return;
  }

  // Build a rich series context so the AI knows exactly where to pick up
  const toneNote = saved.emotionalTone ? ` Keep the tone: ${saved.emotionalTone}.` : "";
  const charNote = saved.recurringCharacters?.length
    ? ` Recurring companions: ${saved.recurringCharacters.join(", ")}.`
    : "";
  const seriesContext = `Continuing "${saved.title}". Story so far: ${saved.summary}.${toneNote}${charNote}`;

  // Clear from both Firestore and localStorage — it's been used now
  clearContinuationFromFirestore();

  handleGenerate({
    mode: saved.mode || "hero",
    idea: seriesContext,
    _seriesContext: seriesContext,
    _recurringCharacters: saved.recurringCharacters || [],
    _lastStorySummary: saved.summary || "",
    _emotionalTone: saved.emotionalTone || "",
  });
}

// =============================================================================
// Keepsake Story Generation — triggered by 7-night streak milestone
// =============================================================================

/**
 * Generate a special personalised keepsake story for the child and permanently
 * add it to their library. Called automatically after 7 consecutive nights.
 */
async function generateKeepsake(childName) {
  const child = state.cachedChildren.find(c => c.name === childName);
  if (!child || !state.currentUser) return;

  // Build a rich keepsake brief — pulls everything we know about the child
  const interests = Array.isArray(child.interests) ? child.interests.join(", ") : "magical adventures";
  const companions = [child.pet, child.bestFriend, child.favToy].filter(Boolean).join(", ");
  const familyNote = companions ? ` Their most treasured companions are: ${companions}.` : "";

  const keepsakeIdea = [
    `A deeply personal keepsake adventure celebrating ${child.name}'s bedtime story journey.`,
    `This is a special commemorative story — richer, warmer, and more emotionally resonant than usual.`,
    `Weave in: their love of ${interests}.${familyNote}`,
    `This story should feel like a treasured memory they will want to revisit for years.`,
    `End with a warm, poetic celebration of ${child.name}'s imagination and the magic of bedtime stories.`,
  ].join(" ");

  try {
    const headers = await buildAuthenticatedJsonHeaders();
    const res = await fetchWithTimeout(`${API_BASE}/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: child.name,
        age: String(child.age || 5),
        interests,
        length: "long",
        mode: "keepsake",
        storyType: "keepsake",
        language: getCurrentLanguage(),
        dialect: state.cachedDialect,
        customIdea: keepsakeIdea,
        appearance: child.appearance || undefined,
        personalWorld: buildPersonalWorld(child),
      }),
    }, 25000);

    if (!res.ok) return;
    const initData = await res.json();
    if (!initData?.jobId) return;

    const data = await pollJob(initData.jobId);
    if (!data?.story) return;

    const title = data.title || `${child.name}'s Keepsake Story ✨`;
    const text = data.story;

    await saveStoryToLibrary({
      childName: child.name,
      title,
      text,
      mode: "keepsake",
      ageBand: state.currentStoryAgeBand || "",
      interests: Array.isArray(child.interests) ? child.interests : [],
      isKeepsake: true,
    });

    showToast("✨ A special keepsake story has been added to your magical library tonight.", "success", 7000);
  } catch (e) {
    console.error("Keepsake generation failed:", e.message);
  }
}

/** Render the children list on the children page. */
function renderChildrenList() {
  const container = $("childrenList");
  if (!container) return;
  container.innerHTML = "";

  if (state.cachedChildren.length === 0) return;

  state.cachedChildren.forEach((child, index) => {
    const item = document.createElement("div");
    item.className = `child-list-item${index === state.selectedChildIndex ? " selected" : ""}`;

    const info = document.createElement("div");
    info.className = "child-list-info";
    const name = document.createElement("h3");
    name.textContent = child.name || "Child";
    const meta = document.createElement("p");
    const parts = [`${t("age_label")} ${child.age || "?"}`];
    const g = (child.gender || "").toLowerCase();
    if (g === "girl" || g === "boy") parts.push(t(`gender_${g}`));
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
    selectBtn.textContent = index === state.selectedChildIndex ? t("active") : t("select_child");
    selectBtn.disabled = index === state.selectedChildIndex;
    selectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      selectChild(index);
      renderChildrenList();
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = t("edit");
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editChildByIndex(index);
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "delete-child-btn";
    delBtn.textContent = t("remove");
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

  // Hide the add-child form when at the limit and not currently editing
  const formCard = $("childFormCard");
  if (formCard) {
    const atLimit = state.cachedChildren.length >= 10 && editingChildIndex === null;
    formCard.style.display = atLimit ? "none" : "";
    if (atLimit) {
      showToast("Maximum of 10 children reached.", "info");
    }
  }
}

/** Render the child filter dropdown on the library page (if 2+ children). */
function renderLibraryChildFilter() {
  const filterCard = $("libraryChildFilter");
  const select = $("childSelect");
  if (!filterCard || !select) return;

  if (state.cachedChildren.length < 2) {
    filterCard.classList.add("hidden");
    return;
  }

  filterCard.classList.remove("hidden");
  select.innerHTML = "";
  state.cachedChildren.forEach((child, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = child.name || "Child";
    if (index === state.selectedChildIndex) option.selected = true;
    select.appendChild(option);
  });
}

function editChildByIndex(index) {
  if (index < 0 || index >= state.cachedChildren.length) return;
  const child = state.cachedChildren[index] || {};
  $("childName").value = child.name || "";
  $("childAge").value = child.age || "";
  $("childGender").value = (child.gender || "").toLowerCase();
  $("childInterests").value = Array.isArray(child.interests)
    ? child.interests.join(", ")
    : String(child.interests || "");
  const ap = $("childAppearance");
  if (ap) ap.value = child.appearance || "";
  const petEl = $("childPet"); if (petEl) petEl.value = child.pet || "";
  const bfEl = $("childBestFriend"); if (bfEl) bfEl.value = child.bestFriend || "";
  const toyEl = $("childFavToy"); if (toyEl) toyEl.value = child.favToy || "";
  setEditMode(index);
  $("childFormCard")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function deleteChildByIndex(index) {
  if (!state.currentUser || index < 0 || index >= state.cachedChildren.length) return;
  const child = state.cachedChildren[index];
  const childName = child?.name || "this child";
  if (!confirm(`Remove ${childName}? Their saved stories and series will also be cleared.`)) return;

  const updated = state.cachedChildren.filter((_, i) => i !== index);
  try {
    const userRef = doc(db, "users", state.currentUser.uid);
    const cleanupUpdates = { children: updated };
    if (childName) {
      cleanupUpdates[`streaks.${childName}`] = null;
      cleanupUpdates[`series.${childName}`] = null;
      cleanupUpdates.library = state.cachedLibrary.filter((s) => s.childName !== childName);
    }
    await updateDoc(userRef, cleanupUpdates);
    await loadChildren();
    renderChildrenList();
  } catch (error) {
    console.error("Delete child failed:", error);
    showToast(t("alert_remove_child_fail"), "error");
  }
}

// =============================================================================
// UI — Loading state
// -----------------------------------------------------------------------------
// Thin shims that delegate to the magical loading component
// (see public/components/loading.js). The component owns:
//   - bedtime message registry + i18n hook
//   - slow fade rotation (4.2s, 700ms cross-fade)
//   - body scroll lock
// Call sites everywhere else continue to use showLoading()/hideLoading();
// the API surface is preserved, only the experience changes.
// =============================================================================

function showLoading(message) {
  // `loadingInterval` is no longer used here, but kept for back-compat with
  // any legacy code that may inspect it. The component manages its own timers.
  if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
  dtLoadingStart({ initialMessage: message || null });
}

function hideLoading() {
  dtLoadingStop();
}

function setGeneratingState(state) {
  isGenerating = state;

  document.querySelectorAll(".btn, .story-card, .quick-card, .story-mode-card").forEach((el) => {
    el.style.pointerEvents = state ? "none" : "";
    el.style.opacity = state ? "0.6" : "";
  });
}

// =============================================================================
// STORY REVEAL SYSTEM
// -----------------------------------------------------------------------------
// Thin shims that delegate to the line-by-line reveal component
// (see public/components/story-reveal.js). The component owns:
//   - paragraph splitting + DOM creation (mirrored across both containers)
//   - calm bedtime cadence (850-1200ms; "sleepy" stretches to 1350ms)
//   - tap-to-continue mode
//   - prefers-reduced-motion (instant reveal)
// CSS transitions live in components/story-reveal.css.
// API surface preserved: callers continue to use renderStoryWithReveal().
// =============================================================================

// Back-compat shim: legacy code may inspect `revealController.isRevealing`.
// The shim reflects the live state from the component without duplicating it.
const revealController = Object.freeze({
  get isRevealing() { return Boolean(dtGetActiveReveal()?.isRevealing); },
  get mode()        { return dtGetActiveReveal()?.revealMode || "auto"; },
  get index()       { return dtGetActiveReveal()?.index || 0; },
  get elements()    { return dtGetActiveReveal()?.elements || []; }
});

function getRevealMode(mode) {
  if (mode === "long-surprise") return "adventure";
  return mode || "custom";
}

// Reading mode — persisted user preference for auto vs tap reveal.
function getReadingMode() {
  return localStorage.getItem("dt-reading-mode") || "auto";
}

function setReadingMode(mode) {
  localStorage.setItem("dt-reading-mode", mode);
}

function renderStoryWithReveal(text, revealMode = "auto") {
  const outputEl  = document.getElementById("storyOutput");
  const readingEl = document.getElementById("readingText");
  if (!outputEl && !readingEl) return;

  dtRevealStory({
    text,
    revealMode,
    storyMode: getRevealMode(state.currentStoryMode),
    outputEl,
    readingEl
  });
}

// =============================================================================
// UI — Display story
// =============================================================================

function displayStory(title, text, context = {}) {
  state.currentStoryTitle = title;
  state.currentStoryText = text;
  state.currentStoryChildName = context.childName || state.currentStoryChildName || "";
  state.currentStoryMode = context.mode || state.currentStoryMode || "";
  state.currentStoryAgeBand = context.ageBand || state.currentStoryAgeBand || "";
  // Reset oneoff flag — will be set to true after pollJob if consumed==="oneOff"
  if (!context._keepOneoffFlag) state.currentStoryIsOneoff = false;

  const storyCard = $("storyCard");
  const storyTitle = $("storyTitle");
  const storyOutput = $("storyOutput");
  const saveLibBtn = $("saveToLibraryBtn");

  if (storyTitle) storyTitle.textContent = title;

  if (storyOutput) renderStoryWithReveal(formatStory(text), getReadingMode());

  if (saveLibBtn) {
    const isError = title === "Oops!" || !text || text.startsWith("No story was returned");
    saveLibBtn.classList.toggle("hidden", isError);
    saveLibBtn.textContent = "★ Save to Library";
    saveLibBtn.disabled = false;
  }

  if (storyCard) {
    storyCard.classList.remove("hidden");
    navigateTo("story");
  }

  // Gentle "what next" nudge — builds bedtime habit without pushing
  setTimeout(() => {
    if (state.currentPage === "story") showToast("🌙 Another story tomorrow… or continue the magic", "info");
  }, 2500);

  // Soft upsell — shown 30s after story displays, only for non-premium users
  if (!state.cachedIsPremium) {
    setTimeout(() => {
      if (state.currentPage === "story" && !isReadingModeOpen()) showUpsell(state.currentStoryChildName);
    }, 30000);
  }
}





// =============================================================================
// Story Generation — Main handler
// =============================================================================

// Re-entry guard: prevents double-clicks from eating 2 trial stories
let generationInProgress = false;
// Expose to story-cache.js so background fill pauses during user generation
window._dtGenerationInProgress = () => generationInProgress;

// isClientInputSafe — thin wrapper around the shared safety module so all
// existing call-sites continue to work without change.
function isClientInputSafe(text) {
  return isInputSafe(text);
}

function showSafetyMessage() {
  const existing = document.getElementById("_safetyToast");
  if (existing) return;
  const toast = document.createElement("div");
  toast.id = "_safetyToast";
  toast.style.cssText =
    "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);" +
    "background:rgba(30,20,60,0.97);color:#fff;border:1px solid rgba(123,97,255,0.5);" +
    "border-radius:20px;padding:12px 22px;font-size:14px;font-weight:600;" +
    "z-index:9999;box-shadow:0 4px 24px rgba(0,0,0,0.5);" +
    "text-align:center;max-width:90vw;white-space:normal;";
  toast.textContent = t("safety_message");
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function applyModeUI(mode) {
  document.body.classList.remove("mode-sleepy", "mode-adventure", "mode-feelings");

  if (mode === "sleepy") document.body.classList.add("mode-sleepy");
  if (mode === "long-surprise") document.body.classList.add("mode-adventure");
  if (mode === "therapeutic") document.body.classList.add("mode-feelings");
}

async function handleGenerate(input) {
  const startTime = Date.now();

  let mode = typeof input === "string" ? input : input?.mode;
  let idea = input?.idea || "";
  let situation = input?.situation || "";
  let _seriesContextOverride = input?._seriesContext || null;
  const _recurringCharacters = input?._recurringCharacters || [];
  const _lastStorySummary = input?._lastStorySummary || "";
  const _emotionalTone = input?._emotionalTone || "";

  // Self-heal: if a previous run left the UI locked (e.g. an unhandled
  // exception escaped both try/finally blocks), and it's been long enough
  // that no real generation could still be in flight, force-reset before
  // honouring the in-progress guard. Without this the user would have to
  // refresh the page to recover from any stuck state.
  if (isGenerating && Date.now() - lastGenerationTime > 120000) {
    console.warn("handleGenerate: clearing stuck isGenerating state");
    isGenerating = false;
    generationInProgress = false;
    setGeneratingState(false);
    hideLoading();
  }

  if (isGenerating) return;

  const now = Date.now();
  if (now - lastGenerationTime < COOLDOWN_MS) {
    showToast("🌙 Just a moment… finishing the magic", "info");
    return;
  }
  lastGenerationTime = now;

  applyModeUI(mode);
  setGeneratingState(true);

  if (mode === "sleepy") {
    idea = idea || "a calm bedtime story";
  }

  if (mode === "long-surprise") {
    idea = idea || "a magical adventure";
  }

  if (mode === "sleepy") {
    showLoading("🌙 Creating a calm bedtime story...");
  } else if (mode === "therapeutic") {
    showLoading("❤️ Creating a gentle story...");
  } else {
    showLoading("✨ Creating your story...");
  }

  try {


  const storyOutput = $("storyOutput");
  if (!storyOutput) return;

  // Silently ignore if a generation is already running
  if (generationInProgress) return;
  generationInProgress = true;
  _generationStartedAt = Date.now();

  // ---- Trial gate: block only if we KNOW credits are exhausted ----
  // teddyCount === null means credit state hasn't loaded yet (e.g. no Firebase
  // locally, or fetch still in flight). Let the server be the authority rather
  // than blocking the user pre-emptively. Only block when teddyCount is
  // definitively 0 and the user is not premium.
  if (teddyCount === 0 && !state.cachedIsPremium) {
    generationInProgress = false;
    navigateTo("home"); // paywall is on the home page
    return;
  }

  // Build the request payload based on mode
  let payload;
  let buttonId;

  // Hero quick-card mode: one-tap personalised hero story.
  if (mode === "hero") {
    const child = getSelectedChild();
    if (!child.name || child.name === "a little one") {
      showToast(t("alert_add_child"), "error");
      generationInProgress = false;
      return;
    }

    const baseInterests = child.interests?.length
      ? child.interests.join(", ")
      : pick(interestsByAge[getAgeGroup(child.age || 5)]);
    const interests = enrichInterestsWithContext(baseInterests, child);
    const heroIdea = _seriesContextOverride
      ? `${formatName(child.name)} continues their adventure.`
      : `${formatName(child.name)} is the hero of a magical journey where they make brave and kind choices.`;

    payload = {
      name: formatName(child.name),
      age: String(child.age || 5),
      interests,
      length: "medium",
      mode: "hero",
      storyType: "hero",
      language: getCurrentLanguage(), dialect: state.cachedDialect,
      customIdea: heroIdea,
      seriesContext: _seriesContextOverride || undefined,
      appearance: child.appearance || undefined,
      personalWorld: buildPersonalWorld(child),
      recurring_character: _recurringCharacters.length ? _recurringCharacters.join(", ") : undefined,
      last_story_summary: _lastStorySummary || undefined,
    };
    buttonId = null;
  }
  // Support new custom/therapeutic modes from Custom Story screen
  else if (mode === "custom" || mode === "therapeutic") {
    // { mode: "custom", idea } or { mode: "therapeutic", situation }
    const child = getSelectedChild();
    if (!child.name || child.name === "a little one") {
      showToast(t("alert_add_child"), "error");
      generationInProgress = false;
      return;
    }
    if (mode === "custom") {
      const rawIdea = (idea || "").trim();
      if (!rawIdea) {
        showToast(t("alert_add_idea"), "error");
        generationInProgress = false;
        return;
      }
      if (!isClientInputSafe(rawIdea)) {
        showSafetyMessage();
        generationInProgress = false;
        return;
      }
      const baseInterests = child.interests?.length
        ? child.interests.join(", ")
        : rawIdea;
      const interests = enrichInterestsWithContext(baseInterests, child);
      const seriesContext = buildSeriesContinuationContext(child.name, state.cachedSeries);
      payload = {
        name: formatName(child.name),
        age: String(child.age || 5),
        interests,
        length: "medium",
        mode: "custom",
        storyType: "custom",
        language: getCurrentLanguage(), dialect: state.cachedDialect,
        customIdea: rawIdea,
        seriesContext: seriesContext || undefined,
        appearance: child.appearance || undefined,
        personalWorld: buildPersonalWorld(child),
      };
      buttonId = null; // No button highlight for instant cards
    } else if (mode === "therapeutic") {
      const therapeuticSituation = (situation || "").trim();
      if (!therapeuticSituation) {
        showToast("Please enter a situation or feeling.", "error");
        generationInProgress = false;
        return;
      }
      if (!isClientInputSafe(therapeuticSituation)) {
        showSafetyMessage();
        generationInProgress = false;
        return;
      }
      // For therapeutic stories, pass a special flag and the situation
      const baseInterests = child.interests?.length
        ? child.interests.join(", ")
        : therapeuticSituation;
      const interests = enrichInterestsWithContext(baseInterests, child);
      payload = {
        name: formatName(child.name),
        age: String(child.age || 5),
        interests,
        length: "medium",
        mode: "therapeutic",
        storyType: "custom",
        language: getCurrentLanguage(), dialect: state.cachedDialect,
        therapeuticSituation,
        appearance: child.appearance || undefined,
        personalWorld: buildPersonalWorld(child),
      };
      buttonId = null;
    } else {
      generationInProgress = false;
      return;
    }
  }
  else if (mode === "today") {
    // ---- Story from Today: weave real day-beats into a gentle story ----
    const child = getSelectedChild();
    if (!child.name || child.name === "a little one") {
      showToast(t("alert_add_child"), "error");
      generationInProgress = false;
      return;
    }
    const dayBeats = ($("todayBeats")?.value || "").trim().slice(0, 400);
    const dayMood = $("todayMood")?.value || "";

    if (!dayBeats) {
      showToast(t("alert_add_beats"), "error");
      generationInProgress = false;
      return;
    }

    if (!isClientInputSafe(dayBeats)) {
      showSafetyMessage();
      generationInProgress = false;
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
      storyType: "quick",
      language: getCurrentLanguage(), dialect: state.cachedDialect,
      dayBeats,
      dayMood: dayMood || undefined,
      appearance: child.appearance || undefined,
      personalWorld: buildPersonalWorld(child),
    };
    buttonId = "generateTodayBtn";
  } else if (mode === "family-magic") {
    // ---- Family Magic: personalised story with family warmth woven in ----
    const child = getSelectedChild();
    if (!child.name || child.name === "a little one") {
      showToast(t("alert_add_child"), "error");
      generationInProgress = false;
      return;
    }

    const baseInterests = child.interests?.length
      ? child.interests.join(", ")
      : pick(interestsByAge[getAgeGroup(child.age || 5)]);
    const interests = enrichInterestsWithContext(baseInterests, child);

    payload = {
      name: formatName(child.name),
      age: String(child.age || 5),
      interests,
      length: "medium",
      mode: "family-magic",
      storyType: "family-magic",
      language: getCurrentLanguage(), dialect: state.cachedDialect,
      appearance: child.appearance || undefined,
      personalWorld: buildPersonalWorld(child),
      familyMagic: child.familyMagic?.enabled ? child.familyMagic : undefined,
    };
    buttonId = null;
  } else if (mode === "sleepy" || mode === "medium-surprise" || mode === "long-surprise") {
    // ---- Surprise Me: random idea, child from profile ----
    const child = getSelectedChild();
    if (!child.name || child.name === "a little one") {
      showToast(t("alert_add_child"), "error");
      generationInProgress = false;
      return;
    }
    const storyLength = mode === "long-surprise" ? "long" : "medium";

    // ── Hot cache hit → serve instantly, zero wait ──
    const hotStory = getHotCachedStory(child.name, storyLength);
    if (hotStory) {
      clearHotCachedStory(child.name, storyLength);
      displayStory(hotStory.title, hotStory.text, { childName: child.name, mode: "random" });
      recordStoryUsed();
      try { localStorage.setItem("dt-first-story", "1"); } catch {}
      enterReadingMode();
      generationInProgress = false;
      trackEvent("story_served_from_hot_cache", { mode, childName: child.name });
      setTimeout(() => preloadHotStory(child, storyLength), 800);
      return;
    }

    const baseInterests = child.interests?.length
      ? child.interests.join(", ")
      : pick(interestsByAge[getAgeGroup(child.age || 5)]);
    const interests = enrichInterestsWithContext(baseInterests, child);
    const ageGroup = Math.round((parseInt(child.age) || 5) / 2) * 2;

    // Race the Firestore inspiration call against a 1.5s cap so it never
    // delays the main generation fetch — empty array is a fine fallback.
    const globalIdeas = await Promise.race([
      getGlobalIdeaInspiration(ageGroup, getCurrentLanguage()).catch(() => []),
      new Promise(resolve => setTimeout(() => resolve([]), 1500)),
    ]);

    payload = {
      name: formatName(child.name),
      age: String(child.age || 5),
      interests,
      length: storyLength,
      mode: mode === "sleepy" ? "sleepy" : mode === "long-surprise" ? "long-surprise" : "random",
      storyType: mode === "sleepy" ? "sleepy" : mode === "long-surprise" ? "magic" : "quick",
      language: getCurrentLanguage(), dialect: state.cachedDialect,
      appearance: child.appearance || undefined,
      globalInspiration: globalIdeas.length ? globalIdeas : undefined,
      personalWorld: buildPersonalWorld(child),
    };
    buttonId = mode === "long-surprise" ? "surpriseLongBtn" : null;
  } else if (mode === "create") {
    // ---- My Idea: parent's idea, child from profile ----
    const child = getSelectedChild();
    if (!child.name || child.name === "a little one") {
      showToast(t("alert_add_child"), "error");
      generationInProgress = false;
      return;
    }
    const rawIdea = ($("createIdea")?.value || "").trim();
    if (!rawIdea) {
      showToast(t("alert_add_idea"), "error");
      generationInProgress = false;
      return;
    }

    if (!isClientInputSafe(rawIdea)) {
      showSafetyMessage();
      generationInProgress = false;
      return;
    }
    const storyLength = $("createLength")?.value || "medium";
    const baseInterests = child.interests?.length
      ? child.interests.join(", ")
      : rawIdea;
    const interests = enrichInterestsWithContext(baseInterests, child);
    const seriesContext = buildSeriesContinuationContext(child.name, state.cachedSeries);

    payload = {
      name: formatName(child.name),
      age: String(child.age || 5),
      interests,
      length: storyLength,
      mode: "custom",
      storyType: "custom",
      language: getCurrentLanguage(), dialect: state.cachedDialect,
      customIdea: rawIdea,
      seriesContext: seriesContext || undefined,
      appearance: child.appearance || undefined,
      personalWorld: buildPersonalWorld(child),
    };
    buttonId = "generateCreateBtn";
  } else {
    generationInProgress = false;
    return;
  }

  // Save theme for continuity hint on next session
  try {
    const theme = payload.customIdea || payload.dayBeats || payload.interests || mode;
    if (theme && theme !== mode) localStorage.setItem("dt-lastTheme", String(theme).slice(0, 60));
  } catch {}

  // Phase 4: inject adaptive intelligence fields — device local time for bedtime-aware pacing
  payload.bedtimeHour = new Date().getHours();

  // ---- Shared AI generation flow ----
  const button = $(buttonId);
  const originalText = button?.textContent || "";

  if (button) {
    button.disabled = true;
    button.textContent = t("creating_btn");
  }

  try {
    // Block if not enough teddies (frontend UX, backend is source of truth)
    if (teddyCount !== null && teddyCount === 0) {
      showToast("🌙 Tonight's stories are complete — come back tomorrow for more magic", "info");
      generationInProgress = false;
      return;
    }
    // All modes hit the AI pipeline when online.
    // Network failures fall through to the procedural catch block.
    // Job-based flow: POST returns a jobId immediately, we poll until done.
    // If the phone sleeps mid-poll, visibilitychange resumes it automatically.
    //
    // Auto-retry: transient server errors (5xx, network blip, cold-start 503)
    // are retried up to 2 times with a short delay before ever reaching the
    // procedural fallback. This makes single-server hiccups invisible to users.
    let initResponse;
    let initLastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 2500));
      try {
        initResponse = await fetchWithTimeout(`${API_BASE}/generate`, {
          method: "POST",
          headers: await buildAuthenticatedJsonHeaders(),
          body: JSON.stringify(payload),
        }, 18000);
        // Only retry on 5xx (server problems). 4xx are definitive — stop immediately.
        if (initResponse.status < 500) break;
        initLastError = new Error(`Server error (${initResponse.status})`);
      } catch (fetchErr) {
        initLastError = fetchErr;
        if (fetchErr.name === "AbortError") throw fetchErr;
      }
    }

    if (!initResponse) throw initLastError || new Error("Story server unreachable");

    if (!initResponse.ok) {
      const errorData = await initResponse.json().catch(() => ({}));
      if (errorData?.unsafe) {
        if (button) { button.disabled = false; button.textContent = originalText; }
        generationInProgress = false;
        showSafetyMessage();
        return;
      }
      if (initResponse.status === 402 && errorData?.teddies === 0) {
        // Teddy currency block
        teddyCount = 0;
        updateTeddyCounterUI();
        showToast("🌙 Tonight's stories are complete — come back tomorrow for more magic", "info");
        if (button) { button.disabled = false; button.textContent = originalText; }
        generationInProgress = false;
        return;
      }
      if (initResponse.status === 403) {
        // Paywall: server says this user has no paid credit. Show the upsell
        // and STOP. Do not throw to the outer catch — that path serves a free
        // procedural story locally, which would be a free backdoor around the
        // Stripe-confirmed payment requirement.
        if (button) { button.disabled = false; button.textContent = originalText; }
        generationInProgress = false;
        const child = getSelectedChild();
        showUpsell(child?.name);
        if (errorData?.error) showToast(errorData.error, "info");
        return;
      }
      if (initResponse.status === 429) {
        const waitMins = Math.ceil((errorData.retryAfter || 300) / 60);
        throw Object.assign(
          new Error(errorData.error || `Too many requests. Please wait ${waitMins} minutes.`),
          { rateLimited: true, waitMins }
        );
      }
      throw new Error(errorData.error || `Server error (${initResponse.status})`);
    }

    const initData = await initResponse.json();
    if (initData?.fallback) {
      throw Object.assign(new Error("AI unavailable, using procedural fallback."), { proceduralFallback: true });
    }

    // Save jobId so phone-sleep resume works
    const jobId = initData?.jobId;
    if (!jobId) throw new Error("No jobId returned from server");
    localStorage.setItem("dt-pending-job", jobId);

    // Poll until done (up to 5 minutes, 3s intervals)
    const data = await pollJob(jobId);
    localStorage.removeItem("dt-pending-job");

    if (data?.fallback) {
      throw Object.assign(new Error("AI unavailable, using procedural fallback."), { proceduralFallback: true });
    }

    // Track whether this story was generated using a one-off credit so the
    // reading mode can hide the continuation button (subscription-only feature)
    state.currentStoryIsOneoff = data?.consumed === "oneOff";

    // After successful story, refresh teddy state (with sparkle)
    refreshTeddyState(true);

    const story = typeof data?.story === "string" && data.story.trim()
      ? applyDialectToText(data.story, getCurrentLanguage())
      : "No story was returned. Please try again.";
    const title = applyDialectToText(data?.title || t("story_for", { name: payload.name }), getCurrentLanguage());

    const storyChildName = getSelectedChild()?.name || payload.name;
    const storyChildObj = state.cachedChildren.find(c => c.name === storyChildName) || {};
    const storyMode = (mode === "create" || mode === "hero") ? "hero" : mode === "today" ? "today" : "random";
    const storyAgeBand = data?.ageBand || state.currentStoryAgeBand || "";
    displayStory(title, story, { childName: storyChildName, mode: storyMode, ageBand: storyAgeBand });

    // Auto-save bespoke stories (Create/Hero + Today) — both are personal keepsakes.
    if ((storyMode === "hero" || storyMode === "today") && story && !story.startsWith("No story was returned")) {
      saveStoryToLibrary({
        childName: storyChildName,
        title,
        text: story,
        mode: storyMode,
        ageBand: storyAgeBand,
        interests: Array.isArray(storyChildObj.interests) ? storyChildObj.interests : [],
      });
      if (storyMode === "hero") advanceHeroSeries(storyChildName, title, story);
    }

    // Global Idea Bank: save every successful story so the system learns
    // from children worldwide. The "idea" for random stories is the interests
    // used — this is what other users' Surprise Me picks will be inspired by.
    if (story && !story.startsWith("No story was returned")) {
      saveToGlobalIdeaBank({
        originalIdea: payload.customIdea || payload.interests || "",
        storyTitle: title || null,
        ageGroup: Math.round((parseInt(payload.age) || 5) / 2) * 2,
        type: storyMode,
        language: getCurrentLanguage(),
      }).catch(() => {});
    }

    // Clear create idea input after generation
    if (mode === "create" || mode === "hero") {
      const ideaInput = $("createIdea");
      if (ideaInput) ideaInput.value = "";
    }

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
    localStorage.removeItem("dt-pending-job");

    if (error?.name === "AbortError") {
      if (button) { button.disabled = false; button.textContent = originalText; }
      generationInProgress = false;
      return;
    }

    // Rate limit — calm message, stop without falling back to a free local story
    if (error?.rateLimited) {
      const waitMins = error.waitMins || 5;
      showToast(`🌙 Story time is resting — ready again in about ${waitMins} minute${waitMins === 1 ? "" : "s"}`, "info", 8000);
      if (button) { button.disabled = false; button.textContent = originalText; }
      generationInProgress = false;
      return;
    }

    if (!error?.proceduralFallback) {
      console.warn("AI generation unavailable, using procedural fallback.", error);
      showToast("✨ Creating a magical story just for you…", "info", 4000);
    }

    // PAYWALL GATE: any local fallback (offline cache or procedural engine)
    // is still a story being delivered to the user. If they have no paid
    // credit, refuse to serve one — show the upsell and stop. Without this
    // gate a non-paying user could put their phone offline and tap "Tell a
    // Story" to get unlimited free local stories.
    if (!canGenerateStory()) {
      const child = getSelectedChild();
      if (button) { button.disabled = false; button.textContent = originalText; }
      generationInProgress = false;
      showUpsell(child?.name);
      return;
    }

    // OFFLINE CACHE: Before falling back to the procedural engine, check if we
    // have a pre-generated AI story stored in IndexedDB for this child. Serves
    // a real AI story on airplane mode for Medium / Long modes.
    // Quick (tonight) skips this — procedural is intentional for quick stories.
    if (window.StoryCache) {
      try {
        const offlineChild = getSelectedChild();
        const offlineMode = (mode === "create" || mode === "hero") ? "hero" : mode === "long-surprise" ? "long" : "medium";
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
            state.cachedChildren,
            () => state.currentUser?.getIdToken(),
            getCurrentLanguage(),
            getAppCheckToken
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

    if (mode === "create") {
      // Build fallback from create form + selected child profile
      heroIdea = ($("createIdea")?.value || "").trim();
      const createLength = $("createLength")?.value || "medium";
      const heroInterestsBase = selectedChild?.interests?.length
        ? selectedChild.interests
        : [heroIdea].filter(Boolean);
      fallbackChild = {
        name: selectedChild?.name || "a little one",
        age: Number(selectedChild?.age) || 5,
        gender: selectedChild?.gender || "neutral",
        interests: heroInterestsBase,
        customIdea: heroIdea,
        requestedLength: createLength,
      };
      fallbackMode = "hero";
    } else if (mode === "hero") {
      heroIdea = `${selectedChild?.name || "The child"} is the hero of a magical journey where they make brave and kind choices.`;
      const heroInterestsBase = selectedChild?.interests?.length
        ? selectedChild.interests
        : [heroIdea];
      fallbackChild = {
        name: selectedChild?.name || "a little one",
        age: Number(selectedChild?.age) || 5,
        gender: selectedChild?.gender || "neutral",
        interests: heroInterestsBase,
        customIdea: heroIdea,
        requestedLength: "medium",
      };
      fallbackMode = "hero";
    }

    fallbackChild = {
      ...fallbackChild,
      requestedLength: fallbackChild?.requestedLength || payload?.length || "medium",
    };


    // Non-English users: procedural engine is English-only so we can't serve
    // them a readable fallback. Show a retry prompt instead of a false
    // "no connection" message — the issue is server availability, not the
    // user's network.
    const fallbackLang = getCurrentLanguage();
    if (!["en-GB", "en-US"].includes(fallbackLang)) {
      if (button) { button.disabled = false; button.textContent = originalText; }
      generationInProgress = false;
      showToast("🌙 We couldn't reach the story server — tap again to try once more.", "info", 7000);
      return;
    }

    const quickWish = "";
    const quickFallbackChild = fallbackChild;
    const heroFallbackChild = heroIdea
      ? { ...fallbackChild, interests: [heroIdea] }
      : fallbackChild;
    const isHeroMode = mode === "create" || mode === "hero";
    const selectedWorld = isHeroMode
      ? (heroIdea ? (findQuickWishMatchedWorld(heroIdea, heroFallbackChild) || pickSuitableWorld(heroFallbackChild)) : pickSuitableWorld(fallbackChild))
      : pickSuitableWorld(fallbackChild);
    const siblings = isHeroMode ? [] : getSiblingsFor(fallbackChild);
    const proceduralChild = isHeroMode ? heroFallbackChild : quickFallbackChild;
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
          const polishResponse = await fetch(`${API_BASE}/polish`, {
            method: "POST",
            headers: await buildAuthenticatedJsonHeaders(),
            body: JSON.stringify({
              story: rawFallback,
              language: getCurrentLanguage(), dialect: state.cachedDialect,
              mode: "edit",
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
    // Mark first story as done so loading messages personalise correctly going forward
    try { localStorage.setItem("dt-first-story", "1"); } catch {}
    trackEvent("story_generated", { mode, childName: getSelectedChild()?.name });
    enterReadingMode();
    // Silently pre-generate the NEXT surprise story so the next tap is instant
    if (mode === "medium-surprise" || mode === "long-surprise") {
      const preloadChild = getSelectedChild();
      const preloadLen = mode === "long-surprise" ? "long" : "medium";
      setTimeout(() => preloadHotStory(preloadChild, preloadLen), 4000);
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
    generationInProgress = false;
  }
  } catch (err) {
    console.error("Generation failed:", err);
    showToast(err?.message?.startsWith("🌙") || err?.message?.startsWith("✨")
      ? err.message
      : "Something went wrong — please try again ✨", "error");
  } finally {
    const elapsed = Date.now() - startTime;
    const minDuration = 700;

    if (elapsed < minDuration) {
      await new Promise((r) => setTimeout(r, minDuration - elapsed));
    }

    hideLoading();
    setGeneratingState(false);
    // The inner try/finally already clears this on the happy path, but if a
    // throw escapes between `generationInProgress = true` and the inner try,
    // the flag stays stuck and every subsequent click silently returns at the
    // top guard. Always clear it here so the UI can never permanently jam.
    generationInProgress = false;
    try { localStorage.removeItem("dt-pending-job"); } catch {}
  }
}

// =============================================================================
// Bonus story auto-save — drain pre-cached stories into the user's library
// =============================================================================

/** Save one bonus story entry (from the offline cache) into the Firestore library. */
async function saveBonusStoryEntry(entry) {
  if (!state.currentUser || !entry?.childName || !entry?.text) return;
  const child = state.cachedChildren.find((c) => c.name === entry.childName);
  if (!child) return;
  const saved = await saveStoryToLibrary({
    childName: entry.childName,
    title: entry.title || t("story_for", { name: entry.childName }),
    text: entry.text,
    mode: entry.mode || "random",
  });
  if (saved) {
    const msg = t("bonus_story_saved", { name: entry.childName });
    const toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);" +
      "background:rgba(30,20,60,0.95);color:#fff;border:1px solid rgba(123,97,255,0.4);" +
      "border-radius:20px;padding:10px 20px;font-size:13px;font-weight:600;" +
      "z-index:9999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.4);";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
}

/**
 * Drain any stories already sitting in IndexedDB into the library,
 * then wire up the real-time hook so future background generations save immediately.
 */
async function autoSaveCachedToLibrary() {
  if (!window.StoryCache || !state.currentUser || !state.cachedChildren.length) return;

  // Wire up the real-time hook: every future background-generated story
  // fires saveBonusStoryEntry the moment it's written to IndexedDB.
  window.StoryCache.onBonusStory = (entry) => saveBonusStoryEntry(entry);

  // Also drain any stories that were pre-generated in a previous session
  try {
    const existing = await window.StoryCache.listAllUnused();
    for (const entry of existing) {
      const claimed = await window.StoryCache.claimCachedStory(entry.childName, entry.mode);
      if (claimed) await saveBonusStoryEntry(claimed);
    }
    window.StoryCache.updateOfflineIndicator();
  } catch (err) {
    console.warn("[autoSaveCached] drain failed:", err);
  }
}

// =============================================================================
// Auth State Observer
// =============================================================================

function beginFromIntro() {
  try { localStorage.setItem("dt-intro-seen", "1"); } catch {}
  navigateTo("language");
}
window.beginFromIntro = beginFromIntro;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    state.currentUser = user;
    // Show welcome screen if needed (returns true if shown)
    if (await showWelcomeScreenIfNeeded(user)) return;
    const { isNewUser } = await loadUserProfile();
    if (isNewUser) {
      // Show one-time intro on very first launch, then language picker
      const introSeen = localStorage.getItem("dt-intro-seen") === "1";
      if (!introSeen) {
        navigateTo("intro");
      } else {
        navigateTo("language");
      }
      return;
    }
    await loadChildren();
    navigateTo("home");
    checkReturnUser();
    trackEvent("app_opened");

    // After a 99p one-off payment Stripe redirects back with ?paid=oneoff.
    // Take the user straight to the story wizard so they can generate immediately.
    if (new URLSearchParams(window.location.search).get("paid") === "oneoff") {
      history.replaceState(null, "", window.location.pathname);
      setTimeout(() => {
        showToast("✨ Payment confirmed! Let\u2019s create your story", "success");
        navigateTo("create");
      }, 600);
    }

    // Light continuity — remind returning users of their last theme
    try {
      const lastTheme = localStorage.getItem("dt-lastTheme");
      if (lastTheme && localStorage.getItem("dt-first-story")) {
        setTimeout(() => showToast(`✨ Continue the ${lastTheme} adventure?`, "info"), 1800);
      }
    } catch {}
    // Second-session retention metric — fires once per user on their return visit
    if (localStorage.getItem("dt-first-story") && !localStorage.getItem("dt-returned-once")) {
      localStorage.setItem("dt-returned-once", "1");
      trackEvent("user_returned");
    }
    // Start background cache fill once children are loaded
    if (window.StoryCache) {
      window.StoryCache.pruneOldEntries();
      window.StoryCache.scheduleBackgroundFill(
        state.cachedChildren,
        () => state.currentUser?.getIdToken(),
        getCurrentLanguage()
      );
    }
    refreshTeddyState();
  } else {
    state.currentUser = null;
    state.cachedChildren = [];
    state.cachedStreaks = {};
    state.cachedLibrary = [];
    state.cachedSeries = {};
    state.cachedTrial = null;
    navigateTo('auth');

    const csFromUrl = getGuestCheckoutSessionFromUrl();
    const csFromStorage = localStorage.getItem("dt-guest-oneoff-cs");
    const sessionId = csFromUrl || csFromStorage;
    if (sessionId) {
      state.guestOneoffSessionId = sessionId;
      localStorage.setItem("dt-guest-oneoff-cs", sessionId);
      if (csFromUrl) {
        history.replaceState(null, "", window.location.pathname);
      }
      setTimeout(() => {
        showToast("Payment confirmed. Let's create your story.", "success");
        openGuestOneoffPrompt(sessionId);
      }, 250);
    }
  }
});

// Reading mode events
setupReadingModeEvents();

// Library child filter — when user changes selected child from library page
const childSelectEl = $("childSelect");
if (childSelectEl) {
  childSelectEl.addEventListener("change", () => {
    state.selectedChildIndex = Number(childSelectEl.value) || 0;
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

// Global function references (also used by data-action delegator below)
window.navigateTo = navigateTo;
window.closeStoryCard = closeStoryCard;
window.handleGenerate = handleGenerate;
window.handleSubscribe = handleSubscribe;
window.showUpsell = showUpsell;
window.buyOneStory = () => handleSubscribe("oneoff");
window.buyOneStoryFromAuth = () => {
  openGuestOneoffPrompt("dev_test_oneoff");
};
window.buyPremium = () => handleSubscribe("subscription");
window.buyPack   = () => handleSubscribe("pack");

const _subBtn = $("subscribeBtn");
if (_subBtn) _subBtn.addEventListener("click", () => handleSubscribe("subscription"));
const _oneOffBtn = $("oneOffBtn");
if (_oneOffBtn) _oneOffBtn.addEventListener("click", () => handleSubscribe("oneoff"));

// Wire cross-module callbacks now that all functions are defined.
configureLibrary({ displayStory, enterReadingMode });
configureStreaks({ generateKeepsake });
configureChildren({
  updateHomeChildCard,
  updateStreakDisplay,
  renderLibrary,
  renderChildrenList,
  renderDialectControls,
  ensureTrialInitialised,
  renderTrialState,
  normalizeDialect,
});

// Story card click handlers — cards are rendered dynamically by JS, no data-action available
document.querySelector(".card-purple")?.addEventListener("click", () => handleGenerate("medium-surprise"));
document.querySelector(".card-pink")?.addEventListener("click", () => handleGenerate("long-surprise"));
document.querySelector(".card-blue")?.addEventListener("click", () => navigateTo("today"));
document.querySelector(".card-teal")?.addEventListener("click", () => openCreatePage("medium"));
window.signup = signup;
window.login = login;
window.logout = authLogout;
window.resetPassword        = resetPassword;
window.deleteAccount        = deleteAccount;
window.closeDeleteModal     = closeDeleteModal;
window.confirmDeleteAccount = confirmDeleteAccount;
window.saveChild = saveChild;
window.cancelEditChild = cancelEditChild;
window.enterReadingMode = enterReadingMode;
window.saveCurrentStoryToLibrary = saveCurrentStoryToLibrary;
window.openCreatePage = openCreatePage;

// Prevent native form submission on the auth form (onsubmit="return false" removed for CSP).
document.getElementById("authForm")?.addEventListener("submit", (e) => e.preventDefault());

// =============================================================================
// Global click delegator — replaces all onclick= attributes (CSP hardening).
// HTML elements use data-action="fnName" and data-arg="value" instead.
// =============================================================================

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const arg    = btn.dataset.arg;

  const dispatch = {
    navigate:                 () => navigateTo(arg),
    signup,
    login,
    logout:                   authLogout,
    resetPassword,
    buyOneStoryFromAuth:      window.buyOneStoryFromAuth,
    beginFromIntro,
    wizardNext:               () => wizardNext(Number(arg)),
    wizardSelectGender:       () => wizardSelectGender(btn),
    wizardToggleChip:         () => wizardToggleChip(btn),
    wizardFinish,
    buyPremium:               window.buyPremium,
    buyOneStory:              window.buyOneStory,
    buyPack:                  window.buyPack,
    handleGenerate:           () => handleGenerate(arg),
    handleSubscribe:          () => handleSubscribe(arg),
    startCustomStory:         window.startCustomStory,
    startFeeling:             () => window.startFeeling(arg),
    startWorld:               () => window.startWorld(arg),
    saveChild,
    cancelEditChild,
    deleteAccount,
    closeDeleteModal,
    confirmDeleteAccount,
    closePaywall:             window.closePaywall,
    closeStoryCard,
    enterReadingMode,
    saveCurrentStoryToLibrary,
    closeFamilyMagicModal:    window.closeFamilyMagicModal,
    addFamilyMember:          window.addFamilyMember,
    toggleFmComfortItem:      () => window.toggleFmComfortItem(btn),
    saveFamilyMagicSetup:     window.saveFamilyMagicSetup,
    continueLastStory:        continueLastStory,
  };

  const fn = dispatch[action];
  if (typeof fn === "function") fn();
});

// =============================================================================
// Language selection screen handlers
// =============================================================================

let selectedOnboardingLang = null;

// Onboarding grid (pageLanguage)
const langGrid = $("langGrid");
if (langGrid) {
  langGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".lang-btn[data-lang]");
    if (!btn) return;
    langGrid.querySelectorAll(".lang-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedOnboardingLang = btn.dataset.lang;
    const continueBtn = $("langContinueBtn");
    if (continueBtn) continueBtn.disabled = false;
  });
}

const langContinueBtn = $("langContinueBtn");
if (langContinueBtn) {
  langContinueBtn.addEventListener("click", async () => {
    if (!selectedOnboardingLang) return;

    setCurrentLanguage(selectedOnboardingLang);

    try { localStorage.setItem(LS_LANG_KEY, selectedOnboardingLang); } catch {}
    if (selectedOnboardingLang === "en-US") state.cachedDialect = "en-US";
    else state.cachedDialect = "en-GB";
    applyUILanguage();
    renderStoryCards();
    await saveLanguageToFirestore(selectedOnboardingLang);
    await loadChildren();
    trackEvent("onboarding_language_selected", { lang: selectedOnboardingLang });
    // New users with no children → show the wizard; returning users → home
    const wizardDone = localStorage.getItem("dt-wizard-done") === "1";
    if (!wizardDone && state.cachedChildren.length === 0) {
      navigateTo("wizard");
    } else {
      navigateTo("home");
      if (window.StoryCache) {
        window.StoryCache.scheduleBackgroundFill(
          state.cachedChildren,
          () => state.currentUser?.getIdToken(),
          getCurrentLanguage(),
          getAppCheckToken
        );
      }
    }
  });
}

// Settings language grid
const settingsLangGrid = $("settingsLangGrid");
if (settingsLangGrid) {
  settingsLangGrid.addEventListener("click", async (e) => {
    const btn = e.target.closest(".lang-btn[data-lang]");
    if (!btn) return;
    const langCode = btn.dataset.lang;
    settingsLangGrid.querySelectorAll(".lang-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");

    setCurrentLanguage(langCode);

    try { localStorage.setItem(LS_LANG_KEY, langCode); } catch {}
    if (langCode === "en-US") state.cachedDialect = "en-US";
    else state.cachedDialect = "en-GB";
    applyUILanguage();
    renderStoryCards();
    await saveLanguageToFirestore(langCode);
    const status = $("settingsLangStatus");
    if (status) status.textContent = `${t("lang_saved_status")} ${LANGUAGE_LABELS[langCode] || langCode}`;
  });
}

// =============================================================================
// Bedtime Push Notifications — Web Push API with VAPID
// =============================================================================

const NOTIF_STORAGE_KEY = "dt-notif-prefs";

function getNotifPrefs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || "null"); } catch { return null; }
}
function saveNotifPrefs(prefs) {
  try { localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

async function requestNotificationPermission() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  const permission = await Notification.requestPermission();
  return permission;
}

async function subscribeToNotifications(time = "19:30") {
  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    showToast("Notifications blocked — please allow them in your browser settings.", "info");
    return false;
  }

  saveNotifPrefs({ enabled: true, time });
  updateNotifUI();
  showToast(`✨ Bedtime reminders set for ${time} each night.`, "success");
  return true;
}

function unsubscribeFromNotifications() {
  saveNotifPrefs({ enabled: false });
  updateNotifUI();
  showToast("Bedtime reminders turned off.", "info");
}

function updateNotifUI() {
  const toggle = document.getElementById("notifToggle");
  const timeRow = document.getElementById("notifTimeRow");
  const timeInput = document.getElementById("notifTime");
  if (!toggle) return;
  const prefs = getNotifPrefs();
  const enabled = !!(prefs?.enabled);
  toggle.checked = enabled;
  if (timeRow) timeRow.classList.toggle("hidden", !enabled);
  if (timeInput && prefs?.time) timeInput.value = prefs.time;
}

// Schedule local notification via service worker message
function scheduleLocalBedtimeNotification(childName, time) {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then(reg => {
    const [hours, minutes] = (time || "19:30").split(":").map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delayMs = target - now;
    const name = childName || "your little one";
    reg.active?.postMessage({
      type: "SCHEDULE_NOTIFICATION",
      delayMs,
      title: "DreamTalez ✨",
      body: `Bedtime story time for ${name}! A magical adventure is waiting 🌙`,
      tag: "dt-bedtime-reminder",
    });
  }).catch(() => {});
}

// Wire notification settings UI
const notifToggle = document.getElementById("notifToggle");
const notifTimeInput = document.getElementById("notifTime");
if (notifToggle) {
  updateNotifUI();
  notifToggle.addEventListener("change", async () => {
    if (notifToggle.checked) {
      const time = notifTimeInput?.value || "19:30";
      const ok = await subscribeToNotifications(time);
      if (ok) {
        const child = getSelectedChild();
        scheduleLocalBedtimeNotification(child?.name, time);
      }
    } else {
      unsubscribeFromNotifications();
    }
  });
}
if (notifTimeInput) {
  notifTimeInput.addEventListener("change", () => {
    const prefs = getNotifPrefs();
    if (prefs?.enabled) {
      const time = notifTimeInput.value;
      saveNotifPrefs({ ...prefs, time });
      const child = getSelectedChild();
      scheduleLocalBedtimeNotification(child?.name, time);
      showToast(`✨ Reminder updated to ${time}.`, "success");
    }
  });
}

// =============================================================================
// Idle / visibility recovery — prevents stuck loading state after phone sleep
// =============================================================================

// _generationStartedAt is set inside handleGenerate() at the moment generation begins.
let _generationStartedAt = 0;

// When the user returns to the app after a long absence (e.g. putting child to bed),
// if the loading spinner is still showing and it's been over 2 minutes, reset cleanly
// and leave the user exactly where they were so they can simply tap again.
// NOTE: if dt-pending-job is set, the polling resume handler (above) will collect
// the finished story — don't clear state here or the story will never appear.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (!generationInProgress) return;
  if (localStorage.getItem("dt-pending-job")) return; // polling resume handler will take over
  const elapsed = Date.now() - _generationStartedAt;
  if (elapsed > 120000) {
    generationInProgress = false;
    document.body.style.overflow = "";
    document.getElementById("story-loading")?.classList.add("hidden");
    // Small soft message so the parent knows what happened — no navigation
    const toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);" +
      "background:rgba(30,20,60,0.95);color:#fff;border:1px solid rgba(123,97,255,0.4);" +
      "border-radius:20px;padding:10px 20px;font-size:13px;font-weight:600;" +
      "z-index:9999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.4);";
    toast.textContent = t("ready_to_tap");
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
});

// =============================================================================
// Wizard live-validation (enable Next button as user types)
// =============================================================================

const wizardNameInput = $("wizardName");
if (wizardNameInput) {
  wizardNameInput.addEventListener("input", () => {
    const btn = $("wizardNext1");
    if (btn) btn.disabled = wizardNameInput.value.trim().length < 1;
  });
  wizardNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && wizardNameInput.value.trim()) wizardNext(1);
  });
}

const wizardAgeInput = $("wizardAge");
if (wizardAgeInput) {
  wizardAgeInput.addEventListener("input", () => {
    const age = parseInt(wizardAgeInput.value || "0");
    const genderSelected = !!document.querySelector(".wizard-gender-btn.selected");
    const btn = $("wizardNext2");
    if (btn) btn.disabled = !(age >= 1 && age <= 18 && genderSelected);
  });
}

// =============================================================================
// Production performance hooks
// =============================================================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      console.log("[SW] registered", registration.scope, registration.active?.scriptURL);
      const pill = $("offlineReadyPill");
      if (pill) {
        pill.textContent = "✓ App ready";
        pill.classList.add("visible");
        setTimeout(() => pill.classList.remove("visible"), 3000);
      }

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      const wireWorker = (worker) => {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed") {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      };

      if (registration.installing) {
        wireWorker(registration.installing);
      }

      registration.addEventListener("updatefound", () => {
        wireWorker(registration.installing);
      });

      await registration.update();

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("[SW] controller changed, reloading page");
        window.location.reload();
      });
    } catch (error) {
      console.warn("[SW] registration failed", error);
    }
  });
}

function runNonCriticalWork() {
  if (typeof window.initAnalytics === "function") {
    window.initAnalytics();
  }
  if (typeof window.initBackgroundCache === "function") {
    window.initBackgroundCache();
  }
}

if ("requestIdleCallback" in window) {
  requestIdleCallback(runNonCriticalWork, { timeout: 2000 });
} else {
  setTimeout(runNonCriticalWork, 2000);
}

// =============================================================================
// Paywall helpers
// =============================================================================

window.openPaywall = function () {
  const modal = document.getElementById("paywall");
  if (modal) modal.classList.remove("hidden");
};

window.closePaywall = function () {
  const modal = document.getElementById("paywall");
  if (modal) modal.classList.add("hidden");
};

// =============================================================================
// Loading overlay recovery — handles back-navigation and tab-switch edge cases
// =============================================================================

window.addEventListener("pageshow", (e) => {
  if (e.persisted && !generationInProgress) {
    document.getElementById("story-loading")?.classList.add("hidden");
    document.body.style.overflow = "";
  }
});
