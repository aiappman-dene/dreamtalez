/**
 * Profile Cache
 *
 * In-memory LRU-style cache for child profiles and user data.
 * Cuts Firestore reads on repeat story generations within a session.
 *
 * TTL: 5 minutes — short enough to stay fresh, long enough to
 * avoid hammering Firestore on rapid requests.
 */

const TTL_MS   = 5 * 60 * 1000; // 5 minutes
const MAX_SIZE = 500;            // evict oldest when exceeded

const profileCache = new Map();

function evictExpired() {
  const now = Date.now();
  for (const [id, entry] of profileCache) {
    if (now - entry.timestamp > TTL_MS) profileCache.delete(id);
  }
}

function evictOldest() {
  const oldest = profileCache.keys().next().value;
  if (oldest) profileCache.delete(oldest);
}

/**
 * @param {string} id - User ID or child profile ID
 * @returns {any|null}
 */
export function getCachedProfile(id) {
  const entry = profileCache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    profileCache.delete(id);
    return null;
  }
  return entry.data;
}

/**
 * @param {string} id
 * @param {any} data
 */
export function setCachedProfile(id, data) {
  evictExpired();
  if (profileCache.size >= MAX_SIZE) evictOldest();
  profileCache.set(id, { data, timestamp: Date.now() });
}

/**
 * @param {string} id
 */
export function invalidateProfile(id) {
  profileCache.delete(id);
}

export function getCacheSize() {
  return profileCache.size;
}
