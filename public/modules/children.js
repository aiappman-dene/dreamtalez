// =============================================================================
// Child Management � child profiles, hero series, and the child form.
// Depends on: app-state.js, i18n.js, toast.js, utils.js, story-engine.js,
//             Firebase Firestore CDN
// Callbacks injected via configure(): updateHomeChildCard, updateStreakDisplay,
//   renderLibrary, renderChildrenList, renderDialectControls,
//   ensureTrialInitialised, renderTrialState, normalizeDialect
// =============================================================================

import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../firebase-init.js?v=20260531b";
import { state } from "./app-state.js";
import { t } from "./i18n.js?v=20260521b";
import { showToast } from "./toast.js";
import { formatName } from "./utils.js";
import { siblingRelation } from "./story-engine.js";
import { isInputSafe } from "./safety.js?v=20260521a";

// Callbacks wired up after all modules load
let _updateHomeChildCard = null;
let _updateStreakDisplay = null;
let _renderLibrary = null;
let _renderChildrenList = null;
let _renderDialectControls = null;
let _ensureTrialInitialised = null;
let _renderTrialState = null;
let _normalizeDialect = null;

export function configure({
  updateHomeChildCard,
  updateStreakDisplay,
  renderLibrary,
  renderChildrenList,
  renderDialectControls,
  ensureTrialInitialised,
  renderTrialState,
  normalizeDialect,
}) {
  _updateHomeChildCard = updateHomeChildCard;
  _updateStreakDisplay = updateStreakDisplay;
  _renderLibrary = renderLibrary;
  _renderChildrenList = renderChildrenList;
  _renderDialectControls = renderDialectControls;
  _ensureTrialInitialised = ensureTrialInitialised;
  _renderTrialState = renderTrialState;
  _normalizeDialect = normalizeDialect;
}

// =============================================================================
// Child profile helpers
// =============================================================================

export function getSelectedChild() {
  const index = state.selectedChildIndex;
  if (index < 0 || index >= state.cachedChildren.length) return {};

  const child = state.cachedChildren[index] || {};
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

export function selectChild(index) {
  state.selectedChildIndex = index;
  _updateHomeChildCard?.();
  _updateStreakDisplay?.();
  _renderLibrary?.();
}

export function buildPersonalWorld(child) {
  const w = {};
  if (child.pet) w.pet = child.pet;
  if (child.bestFriend) w.bestFriend = child.bestFriend;
  if (child.favToy) w.favToy = child.favToy;
  return Object.keys(w).length ? w : undefined;
}

/**
 * Append gender and sibling context to the interests string so the AI
 * system prompt can personalise + age-match naturally. Kept within the
 * server's 200-char limit.
 */
export function enrichInterestsWithContext(baseInterests, child, explicitSiblings = null) {
  const gender = (child.gender || "").toLowerCase();
  const genderLabel = gender === "girl" ? "girl" : gender === "boy" ? "boy" : "";
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
export function getSiblingsFor(child) {
  if (!child || !child.name) return [];
  return state.cachedChildren
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
export function renderHeroSiblings() {
  const wrap = document.getElementById("heroSiblingsWrap");
  const list = document.getElementById("heroSiblings");
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
export function getTickedHeroSiblings() {
  const list = document.getElementById("heroSiblings");
  if (!list) return [];
  const boxes = list.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(boxes).map((cb) => ({
    name: cb.value,
    age: Number(cb.dataset.age) || null,
    gender: cb.dataset.gender || "neutral",
  }));
}

/** Update the series label + reset button for the currently selected child. */
export function updateHeroSeriesLabel() {
  const label = document.getElementById("heroSeriesLabel");
  const resetBtn = document.getElementById("heroSeriesResetBtn");
  if (!label || !resetBtn) return;

  const child = getSelectedChild();
  if (!child.name || child.name === "a little one") {
    label.textContent = "Series: save a child profile to start one.";
    resetBtn.classList.add("hidden");
    return;
  }
  const series = state.cachedSeries[child.name];
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
export async function resetHeroSeries() {
  const child = getSelectedChild();
  if (!child.name || child.name === "a little one") return;
  if (!confirm(`Start a brand-new series for ${formatName(child.name)}? Tonight will be Night 1.`)) return;

  delete state.cachedSeries[child.name];
  updateHeroSeriesLabel();

  if (!state.currentUser) return;
  try {
    const userRef = doc(db, "users", state.currentUser.uid);
    await updateDoc(userRef, { [`series.${child.name}`]: null });
  } catch (e) {
    console.error("Reset series failed:", e);
  }
}

/** After a successful Hero generation, persist the next series state. */
export async function advanceHeroSeries(childName, title, storyText) {
  if (!state.currentUser || !childName) return;
  const prev = state.cachedSeries[childName] || { nightCount: 0 };
  const summary = String(storyText || "").slice(0, 400);
  const next = {
    nightCount: (prev.nightCount || 0) + 1,
    lastTitle: title || prev.lastTitle || "",
    lastSummary: summary,
    lastSavedAt: new Date().toISOString(),
  };
  state.cachedSeries[childName] = next;
  updateHeroSeriesLabel();

  try {
    const userRef = doc(db, "users", state.currentUser.uid);
    await updateDoc(userRef, { [`series.${childName}`]: next });
  } catch (e) {
    console.error("Advance series failed:", e);
  }
}

// =============================================================================
// Child form (add / edit)
// =============================================================================

// Index of the child currently being edited, or null for "add new" mode.
let editingChildIndex = null;

export function setEditMode(index) {
  editingChildIndex = index;
  const saveBtn   = document.getElementById("saveChildBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");
  const heading   = document.getElementById("childFormHeading");
  if (saveBtn)   saveBtn.textContent   = index === null ? t("save_child") : t("update_child");
  if (cancelBtn) cancelBtn.classList.toggle("hidden", index === null);
  if (heading)   heading.textContent   = index === null ? t("add_child_heading") : t("edit_child_heading");
}

export function clearChildForm() {
  document.getElementById("childName").value = "";
  document.getElementById("childAge").value = "";
  document.getElementById("childGender").value = "";
  document.getElementById("childInterests").value = "";
  const ap  = document.getElementById("childAppearance"); if (ap)  ap.value  = "";
  const pet = document.getElementById("childPet");        if (pet) pet.value = "";
  const bf  = document.getElementById("childBestFriend"); if (bf)  bf.value  = "";
  const toy = document.getElementById("childFavToy");     if (toy) toy.value = "";
}

export function cancelEditChild() {
  clearChildForm();
  setEditMode(null);
}

export async function saveChild() {
  if (!state.currentUser) {
    showToast(t("alert_delete_logged_in"), "error");
    return;
  }

  const name         = document.getElementById("childName")?.value.trim() || "";
  const ageInput     = document.getElementById("childAge")?.value.trim() || "";
  const gender       = (document.getElementById("childGender")?.value || "neutral").trim().toLowerCase();
  const interestsInput = document.getElementById("childInterests")?.value.trim() || "";
  const appearance   = (document.getElementById("childAppearance")?.value || "").trim().slice(0, 200);
  const pet          = (document.getElementById("childPet")?.value || "").trim().slice(0, 60);
  const bestFriend   = (document.getElementById("childBestFriend")?.value || "").trim().slice(0, 60);
  const favToy       = (document.getElementById("childFavToy")?.value || "").trim().slice(0, 60);

  const interests    = interestsInput.split(",").map((i) => i.trim().toLowerCase()).filter(Boolean);
  const safeInterests = interests.length ? interests : ["fun adventures"];
  const ageNumber    = Number(ageInput);
  const age          = ageInput && !Number.isNaN(ageNumber) && ageNumber >= 1 && ageNumber <= 18
    ? String(ageNumber)
    : null;

  if (!name) {
    showToast("Please enter your child's name", "error");
    return;
  }

  // Safety check — name and free-text fields must be family-safe
  const fieldsToCheck = [name, appearance, pet, bestFriend, favToy, interestsInput].filter(Boolean);
  if (fieldsToCheck.some(f => !isInputSafe(f))) {
    showToast("Let's keep stories kind and magical ✨", "error");
    return;
  }

  const MAX_CHILDREN = 10;
  if (editingChildIndex === null && state.cachedChildren.length >= MAX_CHILDREN) {
    showToast(t("alert_max_children", { max: MAX_CHILDREN }), "error");
    return;
  }

  const nextRecord = {
    name,
    age,
    gender: gender || "neutral",
    interests: safeInterests,
    appearance: appearance || "",
    pet: pet || "",
    bestFriend: bestFriend || "",
    favToy: favToy || "",
  };

  try {
    const userRef = doc(db, "users", state.currentUser.uid);

    if (editingChildIndex === null) {
      await updateDoc(userRef, { children: arrayUnion(nextRecord) });
    } else {
      const prev    = state.cachedChildren[editingChildIndex] || {};
      const updated = state.cachedChildren.map((c, i) => (i === editingChildIndex ? nextRecord : c));
      const updates = { children: updated };
      // Migrate per-child keys when a child is renamed
      if (prev.name && prev.name !== name) {
        const prevStreak = state.cachedStreaks[prev.name];
        const prevSeries = state.cachedSeries[prev.name];
        updates[`streaks.${prev.name}`] = null;
        updates[`series.${prev.name}`]  = null;
        if (prevStreak) updates[`streaks.${name}`] = prevStreak;
        if (prevSeries) updates[`series.${name}`]  = prevSeries;
        updates.library = state.cachedLibrary.map((e) =>
          e.childName === prev.name ? { ...e, childName: name } : e
        );
      }
      await updateDoc(userRef, updates);
    }

    clearChildForm();
    setEditMode(null);
    await loadChildren();
    _renderChildrenList?.();

    if (state.cachedChildren.length === 1) state.selectedChildIndex = 0;
  } catch (error) {
    console.error("Save child failed:", error);
    showToast(t("alert_save_child_fail"), "error");
  }
}

export async function loadChildren(snap) {
  if (!state.currentUser) return;

  try {
    const userSnap = snap || await getDoc(doc(db, "users", state.currentUser.uid));
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    state.cachedChildren        = Array.isArray(data.children) ? data.children : [];
    state.cachedStreaks          = data.streaks && typeof data.streaks === "object" ? data.streaks : {};
    state.cachedLibrary         = Array.isArray(data.library) ? data.library : [];
    state.cachedSeries          = data.series && typeof data.series === "object" ? data.series : {};
    state.cachedTrial           = data.trial && typeof data.trial === "object" ? data.trial : null;
    state.cachedDialect         = _normalizeDialect
      ? _normalizeDialect(data.storyLocale || data.storyDialect)
      : (data.storyLocale || data.storyDialect || "en-GB");
    state.cachedIsPremium       = !!(data.isPremium || data.isSubscribed);
    state.cachedStoriesRemaining = typeof data.storiesRemaining === "number" ? data.storiesRemaining : 0;
    state.cachedContinuation    = data.continuation && typeof data.continuation === "object"
      ? data.continuation
      : null;

    await _ensureTrialInitialised?.();

    // Clamp selected index
    if (state.selectedChildIndex >= state.cachedChildren.length) {
      state.selectedChildIndex = Math.max(0, state.cachedChildren.length - 1);
    }

    _renderTrialState?.();
    _updateHomeChildCard?.();
    _updateStreakDisplay?.();
    _renderLibrary?.();
    _renderDialectControls?.();
  } catch (error) {
    console.error("Load children failed:", error.code || error.message);
    if (!Array.isArray(state.cachedChildren)) state.cachedChildren = [];
    if (typeof state.cachedStreaks !== "object" || state.cachedStreaks === null) state.cachedStreaks = {};
    if (!Array.isArray(state.cachedLibrary)) state.cachedLibrary = [];
    // Auth token refresh on load causes transient permission-denied — not a real connection error
    const code = error.code || "";
    const silentCodes = ["permission-denied", "unauthenticated", "cancelled", "aborted"];
    if (!silentCodes.includes(code)) {
      showToast("Couldn't load your data — check your connection and try again.", "info");
    }
  }
}

// =============================================================================
// Continuation sync — Firestore-backed cloud continuation storage
// =============================================================================

/**
 * Persist continuation state to Firestore (authoritative) + localStorage (offline cache).
 * Called by app.js when the user taps "Continue Tomorrow".
 */
export async function saveContinuationToFirestore(continuationData) {
  state.cachedContinuation = continuationData;
  // Keep localStorage as offline cache
  try { localStorage.setItem("continuationState", JSON.stringify(continuationData)); } catch {}

  if (!state.currentUser) return;
  try {
    const userRef = doc(db, "users", state.currentUser.uid);
    await updateDoc(userRef, { continuation: continuationData });
  } catch (e) {
    console.error("Continuation save failed:", e.code || e.message);
  }
}

/**
 * Clear continuation from Firestore + localStorage + state after it's been used.
 */
export async function clearContinuationFromFirestore() {
  state.cachedContinuation = null;
  try { localStorage.removeItem("continuationState"); } catch {}

  if (!state.currentUser) return;
  try {
    const userRef = doc(db, "users", state.currentUser.uid);
    await updateDoc(userRef, { continuation: deleteField() });
  } catch (e) {
    console.error("Continuation clear failed:", e.code || e.message);
  }
}
