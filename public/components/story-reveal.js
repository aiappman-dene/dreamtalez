/**
 * Bedtalez line-by-line story reveal.
 *
 * The story does not appear all at once. It opens slowly — paragraph by
 * paragraph — like a bedtime book softly unfolding under moonlight.
 *
 * What this module owns:
 *   - splitting story text into paragraphs
 *   - building paragraph DOM (mirrored across the two existing containers)
 *   - scheduling the paragraph-by-paragraph reveal with a calm cadence
 *   - tap-to-continue alternative
 *   - prefers-reduced-motion handling (instant reveal, no staggering)
 *
 * What this module does NOT touch:
 *   - generation pipeline, network, app state
 *   - the story containers' parents (`#storyOutput`, `#readingText` are
 *     populated, never replaced)
 *   - reading controls (save, share, etc.)
 *
 * Visual transition lives entirely in components/story-reveal.css.
 */

// Bedtime-calibrated reveal cadence (ms per paragraph).
// All values stay within the 600-1400ms window the UX spec calls for.
const REVEAL_DELAYS = {
  sleepy:    { min: 950, max: 1350 },  // slowest, dreamiest
  adventure: { min: 750, max: 1050 },  // a touch livelier, still calm
  custom:    { min: 850, max: 1200 },
  default:   { min: 850, max: 1200 }
};

let activeReveal = null;

/**
 * Reveal a story.
 *
 * @param {object}   opts
 * @param {string}   opts.text         the story prose (paragraphs separated by \n+).
 * @param {string}   [opts.revealMode] "auto" (default) or "tap".
 * @param {string}   [opts.storyMode]  story tone — affects pacing only ("sleepy", "adventure", ...).
 * @param {Element}  opts.outputEl     primary container, e.g. #storyOutput.
 * @param {Element}  [opts.readingEl]  optional secondary container (reading view).
 * @param {Function} [opts.onComplete] fires once when every paragraph is visible.
 *
 * @returns {object|null} the reveal state (also accessible via getActiveReveal()).
 */
export function revealStory(opts = {}) {
  const {
    text,
    revealMode = "auto",
    storyMode = "default",
    outputEl,
    readingEl,
    onComplete
  } = opts;

  cancelReveal();

  if (!outputEl && !readingEl) return null;

  const paragraphs = splitParagraphs(text);
  clearContainer(outputEl);
  clearContainer(readingEl);
  if (!paragraphs.length) return null;

  const elements = paragraphs.map((p) => ({
    output:  outputEl  ? createParagraph(p) : null,
    reading: readingEl ? createParagraph(p) : null
  }));
  for (const pair of elements) {
    if (pair.output && outputEl)   outputEl.appendChild(pair.output);
    if (pair.reading && readingEl) readingEl.appendChild(pair.reading);
  }

  const state = {
    revealMode,
    storyMode,
    elements,
    index: 0,
    isRevealing: true,
    onComplete: typeof onComplete === "function" ? onComplete : null,
    _timer: null,
    _tapBtn: null
  };
  activeReveal = state;

  // Reduced motion: reveal everything immediately, no staggering.
  if (prefersReducedMotion()) {
    elements.forEach(showPair);
    state.isRevealing = false;
    state.index = elements.length;
    fireComplete(state);
    return state;
  }

  if (revealMode === "tap") {
    runTapReveal(state, outputEl);
  } else {
    runAutoReveal(state);
  }
  return state;
}

/**
 * Cancel any in-progress reveal cleanly. Idempotent.
 * Already-visible paragraphs stay visible (we never hide what was shown).
 */
export function cancelReveal() {
  if (!activeReveal) return;
  activeReveal.isRevealing = false;
  if (activeReveal._timer)  { clearTimeout(activeReveal._timer); activeReveal._timer = null; }
  if (activeReveal._tapBtn) { activeReveal._tapBtn.remove();      activeReveal._tapBtn = null; }
  activeReveal = null;
}

/**
 * Active reveal state (for back-compat with legacy code that inspected
 * `revealController.isRevealing`). Returns null when nothing is in flight.
 */
export function getActiveReveal() {
  return activeReveal;
}

// ───── internals ─────

function splitParagraphs(text) {
  return String(text || "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function createParagraph(text) {
  const p = document.createElement("p");
  p.className = "story-paragraph hidden";
  p.textContent = text;
  return p;
}

function clearContainer(el) {
  if (el) el.innerHTML = "";
}

function showPair(pair) {
  if (pair.output) {
    pair.output.classList.remove("hidden");
    pair.output.classList.add("visible");
  }
  if (pair.reading) {
    pair.reading.classList.remove("hidden");
    pair.reading.classList.add("visible");
  }
}

function runAutoReveal(state) {
  if (!state.isRevealing) return;
  if (state.index >= state.elements.length) {
    state.isRevealing = false;
    fireComplete(state);
    return;
  }
  showPair(state.elements[state.index]);
  state.index += 1;

  const delay = pickDelay(state.storyMode);
  state._timer = setTimeout(() => {
    if (state !== activeReveal) return;
    runAutoReveal(state);
  }, delay);
}

function runTapReveal(state, container) {
  if (!container) {
    // No container to host the button — fall back to auto so we never strand the reader.
    runAutoReveal(state);
    return;
  }
  const btn = document.createElement("button");
  btn.className = "tap-next-btn";
  btn.type = "button";
  btn.textContent = "Tap to continue";
  state._tapBtn = btn;

  btn.addEventListener("click", () => {
    if (state !== activeReveal || !state.isRevealing) return;
    if (state.index >= state.elements.length) {
      btn.remove();
      state._tapBtn = null;
      state.isRevealing = false;
      fireComplete(state);
      return;
    }
    showPair(state.elements[state.index]);
    state.index += 1;
    if (state.index >= state.elements.length) {
      btn.remove();
      state._tapBtn = null;
      state.isRevealing = false;
      fireComplete(state);
    }
  });

  container.appendChild(btn);
}

function pickDelay(storyMode) {
  const range = REVEAL_DELAYS[storyMode] || REVEAL_DELAYS.default;
  return range.min + Math.random() * (range.max - range.min);
}

function prefersReducedMotion() {
  try {
    return window.matchMedia &&
           window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
  } catch (_) {
    return false;
  }
}

function fireComplete(state) {
  if (state.onComplete) {
    try { state.onComplete(); }
    catch (err) { console.warn("[story-reveal] onComplete threw:", err && err.message); }
  }
}

export default { revealStory, cancelReveal, getActiveReveal };
