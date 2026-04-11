/**
 * story-cache.js — Offline story cache for DreamTalez
 *
 * Pre-generates AI stories when online and stores them in IndexedDB so
 * Medium / Long / Hero modes work on airplane mode.
 *
 * Attaches to window.StoryCache — loaded as a plain script before app.js.
 */
(function () {
  "use strict";

  // ============================================================
  // Config
  // ============================================================

  const DB_NAME = "dreamtalez-cache";
  const DB_VERSION = 1;
  const STORE_NAME = "stories";
  const TARGET_PER_SLOT = 1;          // stories to keep ready per child+mode
  const BG_REQUEST_DELAY_MS = 6000;   // gap between background API calls
  const MAX_CHILDREN = 3;             // only pre-cache for first 3 children
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days
  const USED_TTL_MS = 24 * 60 * 60 * 1000;        // 1 day for used entries
  // Modes to pre-cache (skip hero — too speculative without a custom idea)
  const CACHE_MODES = ["medium", "long"];

  // ============================================================
  // DB bootstrap
  // ============================================================

  let dbPromise = null;
  let dbAvailable = true;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, {
              keyPath: "id",
              autoIncrement: true,
            });
            store.createIndex("by_child_mode", ["childName", "mode"], {
              unique: false,
            });
            store.createIndex("by_used", "used", { unique: false });
            store.createIndex("by_timestamp", "timestamp", { unique: false });
          }
        };

        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => {
          dbAvailable = false;
          reject(e.target.error);
        };
        req.onblocked = () => {
          dbAvailable = false;
          reject(new Error("IndexedDB blocked"));
        };
      } catch (err) {
        dbAvailable = false;
        reject(err);
      }
    });
    return dbPromise;
  }

  // ============================================================
  // Helpers
  // ============================================================

  function idbRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // ============================================================
  // Write a story to the cache
  // ============================================================

  async function writeStory(entry) {
    if (!dbAvailable) return;
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await idbRequest(store.add({
      childName: entry.childName || "",
      mode: entry.mode || "medium",
      length: entry.length || "medium",
      title: entry.title || "Bedtime Story",
      text: entry.text || "",
      dialect: entry.dialect || "en-GB",
      timestamp: Date.now(),
      used: false,
      payload: entry.payload || {},
    }));
  }

  // ============================================================
  // Claim one unused cached story (atomic get + mark used)
  // ============================================================

  async function claimCachedStory(childName, mode) {
    if (!dbAvailable) return null;
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const index = tx.objectStore(STORE_NAME).index("by_child_mode");
        const range = IDBKeyRange.only([childName, mode]);
        const req = index.openCursor(range);
        let found = null;

        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) {
            resolve(found);
            return;
          }
          if (!cursor.value.used) {
            found = { ...cursor.value };
            cursor.update({ ...cursor.value, used: true });
            resolve(found);
          } else {
            cursor.continue();
          }
        };
        req.onerror = (e) => reject(e.target.error);
        tx.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn("[StoryCache] claimCachedStory error:", err);
      return null;
    }
  }

  // ============================================================
  // Count unused cached stories for a child+mode slot
  // ============================================================

  async function countUnused(childName, mode) {
    if (!dbAvailable) return 0;
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const index = tx.objectStore(STORE_NAME).index("by_child_mode");
        const range = IDBKeyRange.only([childName, mode]);
        const req = index.openCursor(range);
        let count = 0;

        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) {
            resolve(count);
            return;
          }
          if (!cursor.value.used) count++;
          cursor.continue();
        };
        req.onerror = (e) => reject(e.target.error);
      });
    } catch {
      return 0;
    }
  }

  // ============================================================
  // Count total unused stories across all children+modes
  // ============================================================

  async function countAllUnused() {
    if (!dbAvailable) return 0;
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).index("by_used").getAll(IDBKeyRange.only(false));
        req.onsuccess = (e) => resolve(e.target.result.length);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch {
      return 0;
    }
  }

  // ============================================================
  // Prune stale and used-old entries
  // ============================================================

  async function pruneOldEntries() {
    if (!dbAvailable) return;
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const allReq = store.getAll();
      allReq.onsuccess = (e) => {
        const now = Date.now();
        for (const entry of e.target.result) {
          const tooOld = (now - entry.timestamp) > CACHE_TTL_MS;
          const usedAndStale = entry.used && (now - entry.timestamp) > USED_TTL_MS;
          if (tooOld || usedAndStale) {
            store.delete(entry.id);
          }
        }
      };
    } catch (err) {
      console.warn("[StoryCache] pruneOldEntries error:", err);
    }
  }

  // ============================================================
  // Update the offline-ready pill in the UI
  // ============================================================

  async function updateOfflineIndicator() {
    const pill = document.getElementById("offlineReadyPill");
    if (!pill) return;
    try {
      const count = await countAllUnused();
      if (count > 0) {
        pill.textContent = count === 1
          ? "✈ 1 story ready offline"
          : `✈ ${count} stories ready offline`;
        pill.classList.remove("hidden");
        // Small delay so it fades in rather than popping
        setTimeout(() => pill.classList.add("visible"), 50);
      } else {
        pill.classList.remove("visible");
        setTimeout(() => pill.classList.add("hidden"), 400);
      }
    } catch {
      pill.classList.add("hidden");
    }
  }

  // ============================================================
  // Background fill — generates stories while browser is idle
  // ============================================================

  const BG_LOCK_KEY = "dreamtalez-bg-fill-running";
  let bgFillRunning = false;

  async function scheduleBackgroundFill(children, getToken, dialect) {
    if (!dbAvailable) return;
    if (!navigator.onLine) return;
    if (bgFillRunning) return;
    if (sessionStorage.getItem(BG_LOCK_KEY)) return;

    const run = async () => {
      // Don't run during user-initiated generation
      if (window._dtGenerationInProgress?.()) return;

      bgFillRunning = true;
      sessionStorage.setItem(BG_LOCK_KEY, "1");

      try {
        const targets = (children || []).slice(0, MAX_CHILDREN);

        for (const child of targets) {
          const childName = child.name || "";
          if (!childName) continue;

          for (const mode of CACHE_MODES) {
            const unused = await countUnused(childName, mode);
            if (unused >= TARGET_PER_SLOT) continue;

            const needed = TARGET_PER_SLOT - unused;
            for (let i = 0; i < needed; i++) {
              // Stop if user starts a story
              if (window._dtGenerationInProgress?.()) break;
              if (!navigator.onLine) break;

              try {
                const token = await getToken();
                if (!token) break;

                const payload = buildCachePayload(child, mode, dialect);
                const res = await fetch("/generate", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                  },
                  body: JSON.stringify(payload),
                });

                // Check rate limit headroom
                const remaining = Number(res.headers.get("X-RateLimit-Remaining") ?? 99);
                if (remaining < 4) break;

                if (!res.ok) continue;
                const data = await res.json();
                if (data?.fallback || !data?.story) continue;

                await writeStory({
                  childName,
                  mode,
                  length: payload.length,
                  title: data.title || `${childName}'s Bedtime Story`,
                  text: data.story,
                  dialect: dialect || "en-GB",
                  payload,
                });

                // Throttle between background requests
                await new Promise((r) => setTimeout(r, BG_REQUEST_DELAY_MS));
              } catch (err) {
                console.warn("[StoryCache] background generation error:", err);
                break;
              }
            }
          }
        }

        await updateOfflineIndicator();
      } finally {
        bgFillRunning = false;
        sessionStorage.removeItem(BG_LOCK_KEY);
      }
    };

    // Run only when browser is idle — requestIdleCallback with setTimeout fallback
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => run(), { timeout: 3000 });
    } else {
      setTimeout(() => run(), 2000);
    }
  }

  // ============================================================
  // Build a /generate payload for background pre-caching
  // ============================================================

  function buildCachePayload(child, mode, dialect) {
    const name = child.name || "a little one";
    const age = String(child.age || 5);
    const interests = Array.isArray(child.interests) && child.interests.length
      ? child.interests.join(", ")
      : "adventure, animals, magic";

    const length = mode === "long" ? "long" : "medium";

    return {
      name,
      age,
      interests,
      length,
      mode: "random",
      dialect: dialect || "en-GB",
    };
  }

  // ============================================================
  // Public API
  // ============================================================

  window.StoryCache = {
    claimCachedStory,
    scheduleBackgroundFill,
    updateOfflineIndicator,
    pruneOldEntries,
  };

  // Open the DB eagerly so it's ready when needed
  openDB().catch(() => {
    console.warn("[StoryCache] IndexedDB unavailable — offline cache disabled.");
  });
})();
