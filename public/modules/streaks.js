// =============================================================================
// Bedtime Streaks — consecutive reading nights, milestone celebrations,
// and 7-night keepsake story unlock.
// Depends on: app-state.js, i18n.js, toast.js, Firebase Firestore CDN
// =============================================================================

import {
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../firebase-init.js?v=20260522c";
import { state } from "./app-state.js";
import { t } from "./i18n.js?v=20260521b";
import { showToast } from "./toast.js";

// Injected callback — triggers keepsake story generation (wired in app.js)
let _generateKeepsake = null;

export function configure({ generateKeepsake }) {
  _generateKeepsake = generateKeepsake;
}

// =============================================================================
// Date helpers
// =============================================================================

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayDiff(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

// =============================================================================
// Milestone config — what message + visual shows at each night count
// =============================================================================

const MILESTONES = {
  3: {
    stars: "✨✨✨",
    headline: (name) => `Your bedtime magic is growing, ${name} ✨`,
    body: "Three magical nights in a row — keep the adventure alive!",
    color: "#7b61ff",
  },
  7: {
    stars: "⭐⭐⭐⭐⭐",
    headline: (name) => `A special keepsake is being woven for ${name} ✨`,
    body: "Seven nights of bedtime magic — a personalised keepsake story has been added to your library forever.",
    color: "#f6c453",
    isKeepsake: true,
  },
  14: {
    stars: "🌟🌟🌟🌟🌟🌟🌟",
    headline: (name) => `Two weeks of magic with ${name} 🌙`,
    body: "Fourteen nights together — your bedtime ritual is something truly special.",
    color: "#ff6ec7",
  },
  30: {
    stars: "💫💫💫💫💫💫💫💫💫💫",
    headline: (name) => `${name}'s magical month ✨`,
    body: "Thirty nights of bedtime stories. An extraordinary achievement.",
    color: "#f6c453",
  },
};

// =============================================================================
// Core streak logic
// =============================================================================

export async function recordStreakForChild(childName) {
  if (!state.currentUser || !childName) return;
  const today = todayKey();
  const prev = state.cachedStreaks[childName] || { lastDate: null, count: 0 };

  let next;
  if (prev.lastDate === today) {
    return; // already counted today
  } else if (prev.lastDate && dayDiff(prev.lastDate, today) === 1) {
    next = { lastDate: today, count: (prev.count || 0) + 1 };
  } else {
    next = { lastDate: today, count: 1 };
  }

  state.cachedStreaks[childName] = next;
  updateStreakDisplay();

  // Slight delay so the reading mode is visible first
  setTimeout(() => _handleMilestone(childName, next.count), 1400);

  try {
    const userRef = doc(db, "users", state.currentUser.uid);
    await updateDoc(userRef, { [`streaks.${childName}`]: next });
  } catch (error) {
    console.error("Streak save failed:", error.code || error.message);
  }
}

async function _handleMilestone(childName, count) {
  const milestone = MILESTONES[count];
  if (!milestone) return;

  showMilestoneCelebration(childName, count);

  // Trigger keepsake generation at 7 nights
  if (milestone.isKeepsake && _generateKeepsake) {
    // Small extra delay so overlay shows first
    setTimeout(() => _generateKeepsake(childName), 3000);
  }
}

// =============================================================================
// Milestone celebration overlay
// =============================================================================

export function showMilestoneCelebration(childName, count) {
  const milestone = MILESTONES[count];
  if (!milestone) return;

  // Remove any existing overlay
  document.querySelector(".milestone-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "milestone-overlay";

  const isKeepsake = !!milestone.isKeepsake;

  overlay.innerHTML = `
    <div class="milestone-content${isKeepsake ? " milestone-keepsake" : ""}">
      <div class="milestone-particles" aria-hidden="true"></div>
      <div class="milestone-stars">${milestone.stars}</div>
      <h2 class="milestone-headline">${milestone.headline(childName)}</h2>
      <p class="milestone-body">${milestone.body}</p>
      ${isKeepsake ? `<p class="milestone-keepsake-hint">Check your library tonight ✨</p>` : ""}
      <button class="milestone-close btn primary">
        ${isKeepsake ? "See my library ✨" : "Continue 🌙"}
      </button>
    </div>
  `;

  // Spawn floating particles
  const particleContainer = overlay.querySelector(".milestone-particles");
  const particleChars = isKeepsake ? ["⭐", "✨", "🌟", "💫"] : ["✨", "★", "·"];
  for (let i = 0; i < (isKeepsake ? 18 : 10); i++) {
    const p = document.createElement("span");
    p.className = "milestone-particle";
    p.textContent = particleChars[i % particleChars.length];
    p.style.left = `${5 + Math.random() * 90}%`;
    p.style.animationDelay = `${Math.random() * 2.5}s`;
    p.style.animationDuration = `${2.5 + Math.random() * 2}s`;
    p.style.fontSize = `${0.8 + Math.random() * 0.9}em`;
    particleContainer.appendChild(p);
  }

  overlay.querySelector(".milestone-close").addEventListener("click", () => {
    overlay.classList.add("milestone-fade-out");
    setTimeout(() => overlay.remove(), 400);
    if (isKeepsake) {
      // Navigate to library if action dispatcher is available
      document.querySelector('[data-action="navigate"][data-arg="library"]')?.click();
    }
  });

  document.body.appendChild(overlay);

  // Auto-dismiss after 16s (keepsake stays longer)
  setTimeout(() => {
    if (overlay.isConnected) {
      overlay.classList.add("milestone-fade-out");
      setTimeout(() => overlay.remove(), 400);
    }
  }, isKeepsake ? 20000 : 12000);
}

// =============================================================================
// Streak display
// =============================================================================

export function updateStreakDisplay() {
  const el = document.getElementById("streakDisplay");
  if (!el) return;

  const child = state.cachedChildren[state.selectedChildIndex] || {};
  const name = child.name;
  const streak = name ? state.cachedStreaks[name] : null;

  if (!streak || !streak.count) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }

  const today = todayKey();
  const gap = streak.lastDate ? dayDiff(streak.lastDate, today) : 99;
  if (gap > 1) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }

  const count = streak.count;
  const nightWord = count === 1 ? t("streak_night") : t("streak_nights");

  // Rich milestone messaging for streak display
  let message = `🧸 ${count} ${nightWord} ${t("streak_row")}`;
  if (count >= 30) message = `💫 ${count} magical nights — extraordinary!`;
  else if (count >= 14) message = `🌟 ${count} nights — two weeks of magic!`;
  else if (count >= 7)  message = `⭐ ${count} nights — you're on a magic streak!`;
  else if (count >= 3)  message = `✨ ${count} nights — bedtime magic is growing!`;

  el.textContent = message;
  el.classList.remove("hidden");

  // Highlight approaching milestone
  const nextMilestone = [3, 7, 14, 30].find(m => m > count);
  if (nextMilestone && nextMilestone - count <= 2) {
    const nights = nextMilestone - count;
    el.title = nights === 1
      ? `One more night to unlock something magical ✨`
      : `${nights} more nights to unlock something magical ✨`;
  }
}
