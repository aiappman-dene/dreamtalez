/**
 * DreamTalez magical loading experience.
 *
 * The emotional beginning of bedtime — not a spinner.
 *
 * What this module owns:
 *   - showing/hiding the existing #story-loading overlay
 *   - rotating bedtime messages with a gentle fade transition
 *   - body scroll lock while the overlay is visible
 *
 * What this module does NOT touch:
 *   - story generation, network, or app state
 *   - the overlay's existence (HTML lives in index.html)
 *   - other loading states (button "Loading…" labels, etc.)
 *
 * The new visual atmosphere (drifting stars, lantern glow, moonlight
 * gradient) lives entirely in CSS + the static HTML in index.html.
 * This module just opens/closes the overlay and rotates the words.
 */

import { LOADING_MESSAGES, resolveLoadingMessage } from "./loading-messages.js";

const ROTATE_INTERVAL_MS = 4200;   // slow, sleepy cadence (3-5s range)
const FADE_MS            = 700;    // matches CSS .dt-loading-title transition

let rotateTimer  = null;
let fadeTimer    = null;
let currentIndex = 0;
let isOpen       = false;

/**
 * Open the magical loading overlay.
 * @param {object} [opts]
 * @param {string} [opts.initialMessage]  optional first message (e.g. localized).
 *                                        if omitted, a random bedtime message is chosen.
 * @param {string} [opts.overlayId]       defaults to "story-loading".
 */
export function start(opts = {}) {
  const overlay = document.getElementById(opts.overlayId || "story-loading");
  if (!overlay) return;

  const titleEl = overlay.querySelector(".loading-title");
  if (titleEl && !titleEl.classList.contains("dt-loading-title")) {
    titleEl.classList.add("dt-loading-title");
  }

  // Pick a starting message: explicit override > random from registry.
  if (opts.initialMessage && titleEl) {
    titleEl.textContent = opts.initialMessage;
    currentIndex = pickStartingIndex();
  } else if (titleEl) {
    currentIndex = pickStartingIndex();
    titleEl.textContent = resolveLoadingMessage(LOADING_MESSAGES[currentIndex]);
  }

  document.body.style.overflow = "hidden";
  overlay.classList.remove("hidden");
  // small grace period so first paint shows visible content, then fade-rotate
  isOpen = true;

  clearTimers();
  rotateTimer = window.setInterval(() => {
    if (!isOpen || !titleEl) return;
    currentIndex = (currentIndex + 1) % LOADING_MESSAGES.length;
    fadeSwap(titleEl, resolveLoadingMessage(LOADING_MESSAGES[currentIndex]));
  }, ROTATE_INTERVAL_MS);
}

/**
 * Close the overlay. Idempotent.
 */
export function stop(opts = {}) {
  const overlay = document.getElementById(opts.overlayId || "story-loading");
  isOpen = false;
  clearTimers();
  document.body.style.overflow = "";
  overlay?.classList.add("hidden");
}

/**
 * Returns the visible state of the overlay.
 */
export function isVisible() {
  return isOpen;
}

// ───── internals ─────

function fadeSwap(el, nextText) {
  // Two-stage fade: out (CSS transition), swap text, fade in.
  el.classList.add("dt-loading-fade-out");
  if (fadeTimer) window.clearTimeout(fadeTimer);
  fadeTimer = window.setTimeout(() => {
    el.textContent = nextText;
    el.classList.remove("dt-loading-fade-out");
  }, FADE_MS);
}

function pickStartingIndex() {
  if (!LOADING_MESSAGES.length) return 0;
  return Math.floor(Math.random() * LOADING_MESSAGES.length);
}

function clearTimers() {
  if (rotateTimer) { window.clearInterval(rotateTimer); rotateTimer = null; }
  if (fadeTimer)   { window.clearTimeout(fadeTimer);    fadeTimer   = null; }
}

export default { start, stop, isVisible };
