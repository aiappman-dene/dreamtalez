// =============================================================================
// Story Library — visual bookshelf, story covers, save/delete, keepsake support.
// Depends on: app-state.js, i18n.js, toast.js, utils.js, Firebase Firestore CDN
// Callbacks injected via configure(): displayStory, enterReadingMode
// =============================================================================

import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../firebase-init.js?v=20260531b";
import { state } from "./app-state.js";
import { t, getCurrentLanguage } from "./i18n.js?v=20260521b";
import { showToast } from "./toast.js";
import { formatName } from "./utils.js";

let _displayStory = null;
let _enterReadingMode = null;

export function configure({ displayStory, enterReadingMode }) {
  _displayStory = displayStory;
  _enterReadingMode = enterReadingMode;
}

export function formatSavedDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(getCurrentLanguage(), { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// =============================================================================
// Story Cover System — deterministic gradient + motif per story
// =============================================================================

const COVER_PALETTES = {
  sleepy:       { from: "#1a0a4a", via: "#2d1b69", to: "#0f0b1f", accent: "#7b61ff", motif: "🌙" },
  adventure:    { from: "#0a2a4a", via: "#1a4a6a", to: "#0f1f3f", accent: "#3cd2be", motif: "⭐" },
  hero:         { from: "#2a0a1a", via: "#4a1a3a", to: "#1a0a2a", accent: "#ff6ec7", motif: "✨" },
  feelings:     { from: "#1a2a0a", via: "#2a4a1a", to: "#0f1f0a", accent: "#4cdb93", motif: "💚" },
  today:        { from: "#2a1a0a", via: "#4a3a1a", to: "#1f0f0a", accent: "#f6c453", motif: "🌅" },
  "family-magic": { from: "#1a0a2a", via: "#3a1a5a", to: "#0a0a1f", accent: "#ff6ec7", motif: "💜" },
  keepsake:     { from: "#1a1000", via: "#3a2800", to: "#0f0a00", accent: "#f6c453", motif: "⭐" },
  random:       { from: "#0a1a2a", via: "#1a2a4a", to: "#0a0f1f", accent: "#7b61ff", motif: "🌟" },
  create:       { from: "#0a2a1a", via: "#1a4a3a", to: "#0a1f14", accent: "#3cd2be", motif: "✨" },
  quick:        { from: "#1a0a3a", via: "#2a1a5a", to: "#0f0a2a", accent: "#9f7dff", motif: "🌙" },
};

const INTEREST_TINTS = {
  dragons:      "#ff6b35",
  space:        "#4fc3f7",
  fairies:      "#ff80ab",
  dinosaurs:    "#81c784",
  pirates:      "#a1887f",
  ocean:        "#26c6da",
  animals:      "#aed581",
  magic:        "#ce93d8",
  superheroes:  "#ef9a9a",
  princesses:   "#f48fb1",
  robots:       "#80cbc4",
  sport:        "#ffcc02",
};

const AGE_BAND_LABELS = {
  young:  "Ages 3–5",
  middle: "Ages 6–8",
  older:  "Ages 9–12",
};

const MODE_LABELS = {
  sleepy:         "Drift Off",
  adventure:      "Adventure",
  hero:           "Hero Story",
  feelings:       "Feelings",
  today:          "Story From Today",
  "family-magic": "Family Magic",
  keepsake:       "✨ Keepsake",
  random:         "Bedtime Story",
  create:         "Custom Story",
  quick:          "Quick Story",
};

function getCoverPalette(mode, interests = []) {
  const base = COVER_PALETTES[mode] || COVER_PALETTES.random;
  const interest = Array.isArray(interests) ? interests[0] : "";
  const tint = INTEREST_TINTS[interest] || null;
  return { ...base, tint };
}

function buildCoverArt(palette, title) {
  const { from, via, to, accent, motif, tint } = palette;

  // Generate 3-6 decorative stars/particles
  const particles = Array.from({ length: 5 }, (_, i) => {
    const x = 10 + (i * 17) + Math.floor((title.charCodeAt(i % title.length) || 65) % 22);
    const y = 8 + (i * 12) + Math.floor((title.charCodeAt((i + 2) % title.length) || 65) % 28);
    const size = 0.7 + (i % 3) * 0.25;
    const opacity = 0.3 + (i % 4) * 0.12;
    return `<span class="cover-particle" style="left:${x}%;top:${y}%;font-size:${size}em;opacity:${opacity}">★</span>`;
  }).join("");

  const gradient = tint
    ? `linear-gradient(145deg, ${from} 0%, ${tint}22 50%, ${to} 100%)`
    : `linear-gradient(145deg, ${from} 0%, ${via} 55%, ${to} 100%)`;

  return `
    <div class="cover-art" style="background:${gradient}">
      <div class="cover-glow" style="background:radial-gradient(ellipse at 60% 35%, ${accent}28 0%, transparent 70%)"></div>
      ${particles}
      <span class="cover-motif">${motif}</span>
    </div>
  `;
}

// =============================================================================
// Render — premium visual bookshelf
// =============================================================================

export function renderLibrary() {
  const list = document.getElementById("libraryList");
  const hint = document.getElementById("libraryHint");
  if (!list) return;

  const child = state.cachedChildren[state.selectedChildIndex] || {};
  const name = child.name;
  const childInterests = Array.isArray(child.interests) ? child.interests : [];

  const items = (name && name !== "a little one")
    ? state.cachedLibrary
        .filter((s) => s && s.childName === name)
        .sort((a, b) => {
          // Keepsakes always float to top
          if (a.isKeepsake && !b.isKeepsake) return -1;
          if (!a.isKeepsake && b.isKeepsake) return 1;
          return String(b.savedAt || "").localeCompare(String(a.savedAt || ""));
        })
    : [];

  list.innerHTML = "";

  if (items.length === 0) {
    if (hint) hint.textContent = "";
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "library-empty";
    emptyDiv.innerHTML = name
      ? `<div class="library-empty-icon">📚</div>
         <h2>No stories yet</h2>
         <p>Every magical adventure starts tonight.</p>
         <button class="btn primary" data-action="navigate" data-arg="home">Create their first story</button>`
      : `<div class="library-empty-icon">📚</div>
         <h2>No stories yet</h2>
         <p>Add a child profile to start creating magical bedtime stories.</p>
         <button class="btn primary" data-action="navigate" data-arg="children">Add a child</button>`;
    list.appendChild(emptyDiv);
    return;
  }

  if (hint) {
    const ks = items.filter(i => i.isKeepsake).length;
    const regular = items.length - ks;
    const parts = [];
    if (regular > 0) parts.push(`${regular} ${regular === 1 ? "story" : "stories"}`);
    if (ks > 0) parts.push(`${ks} keepsake`);
    hint.textContent = `${formatName(name)}'s library — ${parts.join(" · ")}`;
  }

  items.forEach((item) => {
    const mode = item.mode || "random";
    const interests = item.interests || childInterests;
    const palette = getCoverPalette(mode, interests);
    const modeLabel = MODE_LABELS[mode] || "Bedtime Story";
    const ageBandLabel = AGE_BAND_LABELS[item.ageBand] || "";
    const dateStr = formatSavedDate(item.savedAt);
    const isKeepsake = !!item.isKeepsake;

    const card = document.createElement("div");
    card.className = `story-book-card${isKeepsake ? " story-book-keepsake" : ""}`;
    card.dataset.id = item.id;

    card.innerHTML = `
      ${buildCoverArt(palette, item.title || "Story")}
      <div class="story-book-info">
        <div class="story-book-badges">
          <span class="story-book-badge mode-badge">${modeLabel}</span>
          ${ageBandLabel ? `<span class="story-book-badge age-badge">${ageBandLabel}</span>` : ""}
          ${isKeepsake ? `<span class="story-book-badge keepsake-badge">✨ Keepsake</span>` : ""}
        </div>
        <h3 class="story-book-title">${item.title || "Untitled Story"}</h3>
        <p class="story-book-meta">${dateStr}</p>
      </div>
      <div class="story-book-actions">
        <button type="button" class="story-book-read-btn" aria-label="Read story">
          <span>▶</span> Read
        </button>
        ${!isKeepsake ? `<button type="button" class="story-book-del-btn" aria-label="Remove from library">✕</button>` : ""}
      </div>
    `;

    card.querySelector(".story-book-read-btn").addEventListener("click", () => reReadFromLibrary(item.id));
    const delBtn = card.querySelector(".story-book-del-btn");
    if (delBtn) delBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteFromLibrary(item.id); });

    list.appendChild(card);
  });
}

// =============================================================================
// Save / delete
// =============================================================================

export async function saveStoryToLibrary({ childName, title, text, mode, ageBand, interests, isKeepsake }) {
  if (!state.currentUser || !childName || !text) return false;

  if (state.cachedLibrary.some((s) => s.childName === childName && s.text === text)) return false;

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    childName,
    title: title || t("your_story"),
    text,
    mode: mode || "random",
    ageBand: ageBand || "",
    interests: interests || [],
    isKeepsake: !!isKeepsake,
    savedAt: new Date().toISOString(),
  };

  state.cachedLibrary = [entry, ...state.cachedLibrary];
  renderLibrary();

  try {
    const userRef = doc(db, "users", state.currentUser.uid);
    await updateDoc(userRef, { library: arrayUnion(entry) });
    return true;
  } catch (error) {
    console.error("Library save failed:", error.code || error.message);
    state.cachedLibrary = state.cachedLibrary.filter((s) => s.id !== entry.id);
    renderLibrary();
    showToast("Story couldn't be saved — check your connection.", "info");
    return false;
  }
}

export async function saveCurrentStoryToLibrary() {
  const btn = document.getElementById("saveToLibraryBtn");
  if (!state.currentStoryText || !state.currentStoryChildName) {
    showToast("Choose a child profile first.", "error");
    return;
  }

  const dupe = state.cachedLibrary.find(
    (s) => s.childName === state.currentStoryChildName && s.text === state.currentStoryText
  );
  if (dupe) {
    showToast("This story is already in your library ✨", "info");
    return;
  }

  const child = state.cachedChildren.find(c => c.name === state.currentStoryChildName) || {};

  const ok = await saveStoryToLibrary({
    childName: state.currentStoryChildName,
    title: state.currentStoryTitle,
    text: state.currentStoryText,
    mode: state.currentStoryMode || "random",
    ageBand: state.currentStoryAgeBand || "",
    interests: Array.isArray(child.interests) ? child.interests : [],
  });

  if (ok) {
    showToast("✨ Story saved. That was beautiful.", "success");
    setTimeout(() => showToast(`Sweet dreams, ${state.currentStoryChildName} 🌙`, "success"), 1800);
    if (btn) {
      btn.textContent = "✓ Saved";
      btn.disabled = true;
    }
  } else {
    showToast("Could not save — please try again", "error");
  }
}

export async function deleteFromLibrary(id) {
  if (!state.currentUser || !id) return;
  const entry = state.cachedLibrary.find((s) => s.id === id);
  if (!entry) return;
  if (entry.isKeepsake) {
    showToast("Keepsakes are permanent memories — they can't be removed. ✨", "info");
    return;
  }
  if (!confirm(`Remove "${entry.title}" from your library?`)) return;

  const prev = state.cachedLibrary;
  state.cachedLibrary = state.cachedLibrary.filter((s) => s.id !== id);
  renderLibrary();

  try {
    const userRef = doc(db, "users", state.currentUser.uid);
    await updateDoc(userRef, { library: arrayRemove(entry) });
  } catch (error) {
    console.error("Library delete failed:", error);
    state.cachedLibrary = prev;
    renderLibrary();
    showToast(t("alert_remove_story_fail"), "error");
  }
}

export function reReadFromLibrary(id) {
  const entry = state.cachedLibrary.find((s) => s.id === id);
  if (!entry) return;
  _displayStory?.(entry.title, entry.text, { childName: entry.childName, mode: entry.mode });
  _enterReadingMode?.();
}
