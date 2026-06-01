# Firebase Initialization Architecture

**Last Updated**: May 19, 2026  
**Status**: Production-Ready with Runtime Safeguards

## Summary

Bedtalez uses a **centralized singleton Firebase initialization pattern** to ensure auth state synchronization across all browser tabs and windows. This document describes the architecture and safeguards in place to prevent future initialization regressions.

## Architecture

### Single Source of Truth

**File**: `public/firebase-init.js`

```
firebase-init.js (single initializeApp call)
    ↓
    ├─→ app.js (imports: auth, db, functions)
    ├─→ public/modules/auth.js (imports: auth, db, functions)
    ├─→ public/modules/children.js (imports: db, functions)
    ├─→ public/modules/library.js (imports: db, functions)
    └─→ public/modules/streaks.js (imports: db, functions)
```

### Key Rules

1. **Only `firebase-init.js` calls `initializeApp()`** — nowhere else
2. **All modules import from `firebase-init.js`** — never directly from Firebase CDN
3. **No dynamic imports of Firebase modules** — prevents instance duplication
4. **Exported functions are centralized** — single source for all Firebase operations

## Centralized Exports

`firebase-init.js` exports:

**Authentication**
- `auth` (singleton instance)
- `signInWithEmailAndPassword`
- `createUserWithEmailAndPassword`
- `sendPasswordResetEmail`
- `signOut`
- `onAuthStateChanged`

**Firestore - Core**
- `db` (singleton instance)
- `doc`
- `getDoc`
- `setDoc`
- `updateDoc`
- `deleteDoc`

**Firestore - Collections & Queries**
- `collection`
- `addDoc`
- `query`
- `where`
- `orderBy`
- `limit`
- `getDocs`

**Firestore - Helpers**
- `serverTimestamp`
- `arrayUnion`
- `arrayRemove`

## Runtime Safeguards

### Initialization Guard

```javascript
// Only initialize if no app exists yet
let _app;
if (getApps().length === 0) {
  _app = initializeApp(firebaseConfig);
} else {
  _app = getApp(); // Return existing instance
}
```

**What it does**: Checks if Firebase is already initialized before creating a new instance.

**Benefit**: Prevents accidental duplicate initialization if the module is imported multiple times.

### Singleton Validator

```javascript
const _validateSingleton = () => {
  const apps = getApps();
  if (apps.length !== 1) {
    console.error(`[Firebase] ERROR: Expected 1 Firebase app instance, found ${apps.length}.`);
  }
};

_validateSingleton(); // Runs on module load
```

**What it does**: Validates exactly 1 Firebase instance exists when `firebase-init.js` loads.

**Benefit**: Catches initialization errors early, before auth listeners attach.

### Development Debug Mode

Enable verbose Firebase logging:

```javascript
// In browser console:
localStorage.setItem('dt-firebase-debug', '1');
// Reload page
```

**Output**:
- Warns if duplicate initialization attempts detected
- Logs singleton validation results
- Provides stack trace if multiple instances found

## Fixed Issues

### Issue 1: Duplicate initializeApp() in app.js
**Status**: FIXED ✅

**Before**: `app.js` had its own `initializeApp()` call  
**After**: `app.js` imports shared `auth` and `db` from `firebase-init.js`

### Issue 2: Dynamic Imports Creating Separate Instances
**Status**: FIXED ✅

**Before**: 4 functions used `await import()` to dynamically load Firebase:
- `saveToGlobalIdeaBank()` (line 690)
- `getGlobalIdeaInspiration()` (line 707)
- `saveLanguageToFirestore()` (line 729)
- `loadUserProfile()` (line 740)

Each call created a separate Firebase instance via `getFirestore()`.

**After**: All functions use the shared `db` instance imported at the top of `app.js`.

### Issue 3: Lazy Loaders in Modules
**Status**: FIXED ✅

**Before**: Modules had lazy getters that called `getAuth()` and `getFirestore()`:
```javascript
const getAuthInstance = () => getAuth();
const getDb = () => getFirestore();
```

**After**: All modules import the unified instances directly from `firebase-init.js`.

## Testing the Fix

### Verify Single Instance (Development)

```javascript
localStorage.setItem('dt-firebase-debug', '1');
location.reload();
// Check console for: "[Firebase] ✓ Singleton validation passed: 1 instance"
```

### Test Tab Sync

1. Open two browser tabs to Bedtalez
2. Log in on Tab 1
3. Tab 2 should automatically detect login (no page refresh needed)
4. Open dev console on both tabs
5. Both should show same user in `state.currentUser`

### Test Auth State Persistence

1. Log in
2. Close browser completely
3. Reopen Bedtalez
4. User should still be logged in (via Firebase auth listener)

## Adding New Features

### If You Need New Firebase Functions

1. Add the function to `firebase-init.js` exports
2. Import it from `firebase-init.js` in your module
3. Never import directly from Firebase CDN

Example:
```javascript
// ❌ WRONG:
const { query, getDocs } = await import("https://...");

// ✅ RIGHT:
// In firebase-init.js:
export { query, getDocs };

// In your module:
import { query, getDocs } from "../firebase-init.js";
```

### If You Need to Use Auth or DB

```javascript
// ❌ WRONG:
const db = getFirestore();
const auth = getAuth();

// ✅ RIGHT:
import { auth, db } from "../firebase-init.js";
```

## Architecture Decisions

### Why Centralized?

- **Auth Sync**: Single instance ensures `onAuthStateChanged()` broadcasts to all tabs
- **Data Consistency**: One `db` instance = one connection to Firestore backend
- **Debugging**: Easier to trace issues with a known instance
- **Performance**: No duplicate listeners, no memory waste

### Why No Dynamic Imports?

Dynamic imports bypass the module dependency graph, making it impossible to guarantee initialization order. Each dynamic import call to `getFirestore()` could create a new instance.

### Why Runtime Validators?

Development safeguards catch mistakes before production. The validator runs once at startup and logs errors that might otherwise go unnoticed.

## Capacitor & Native Compatibility

- ✅ Works with Capacitor (browser-based Firebase SDK)
- ✅ No native plugins needed
- ✅ Auth listeners sync across in-app browser instances
- ✅ Offline support maintained via service worker

## Troubleshooting

### "Login not persisting across tabs"

**Check**: Are all modules importing from `firebase-init.js`?

```bash
# Search for these patterns in public/modules:
grep -r "getAuth()" .
grep -r "getFirestore()" .
grep -r "await import.*firebase" .
```

All should return NO matches (except firebase-init.js itself).

### "Firebase instance count wrong"

**Fix**: 
1. Open dev console
2. Run: `localStorage.setItem('dt-firebase-debug', '1');`
3. Reload page
4. Check console output for error details

### "Auth listener not firing across tabs"

**Check**:
1. Verify only one `onAuthStateChanged()` listener exists
2. Run in dev console: `firebase.getApps().length` (should be 1)
3. Check `app.js` line 3025 for `onAuthStateChanged()` setup

## References

- Firebase Web SDK: v10.12.5
- Browser compatibility: All modern browsers + iOS Safari 12+
- Service Worker: Enabled for offline support

---

**Maintenance**: This document should be updated whenever Firebase SDK version changes or new initialization patterns are added.
