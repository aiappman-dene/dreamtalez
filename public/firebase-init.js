// DreamTalez — Firebase Initialization
// Single module that owns Firebase app/auth/db instances.
// Import { auth, db } from here — never call initializeApp() again elsewhere.

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  initializeAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as _getAppCheckTokenInternal,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAoNxcJTiqah_Ig_1THapgWIYY3Y-nPWj8",
  authDomain: "dreamtalez.firebaseapp.com",
  projectId: "dreamtalez",
  storageBucket: "dreamtalez.appspot.com",
  messagingSenderId: "219771634733",
  appId: "1:219771634733:web:007c920a5442a4d19c24a4",
};

// =============================================================================
// Initialization Guard — prevent accidental duplicate Firebase instances
// =============================================================================
// In development, warn if someone tries to initialize Firebase again
const _debugWarnDuplicateInit = () => {
  if (typeof window !== 'undefined' && localStorage.getItem('dt-firebase-debug') === '1') {
    console.warn('[Firebase Guard] Duplicate initialization attempt detected');
  }
};

// Only initialize if no app exists yet
let _app;
if (getApps().length === 0) {
  _app = initializeApp(firebaseConfig);
} else {
  _debugWarnDuplicateInit();
  _app = getApp(); // Return existing instance
}

// =============================================================================
// App Check — reCAPTCHA Enterprise
// MUST be initialized before getAuth() / getFirestore() so that Firebase
// automatically attaches App Check tokens to all Auth and Firestore calls.
// Skipped on localhost so local dev works without reCAPTCHA domain registration.
// =============================================================================
const _isLocalhost = typeof location !== "undefined" &&
  (location.hostname === "localhost" || location.hostname === "127.0.0.1");

let _appCheck = null;
// Temporarily disabled to prevent 404 script errors from stalling login on slower connections.
// if (!_isLocalhost) {
//   try {
//     _appCheck = initializeAppCheck(_app, {
//       provider: new ReCaptchaEnterpriseProvider("6LfsMvcsAAAAAHOJg5HeTOn-QrlVclzH-QF-ffqx"),
//       isTokenAutoRefreshEnabled: true,
//     });
//   } catch (e) {
//     console.warn("[AppCheck] init skipped:", e.message);
//     _appCheck = null;
//   }
// }

export let auth = getAuth(_app);
export const db = getFirestore(_app);

// Helper: persist a short diagnostic object to localStorage (if available)
function _saveClientDiagnostic(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)); } catch { /* ignore */ }
}

// Try to ensure robust persistence for Capacitor / Android System WebView.
// Preferred: `browserLocalPersistence`. If that fails, try initializing
// auth with `indexedDBLocalPersistence` which works better in some WebView
// implementations. Fall back to in-memory if neither works.
async function _ensureAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    _saveClientDiagnostic('dt-last-auth-diagnostic', { time: new Date().toISOString(), persistence: 'browserLocalPersistence' });
    return;
  } catch (e) {
    console.warn('[Firebase] setPersistence(browserLocalPersistence) failed:', e?.message || e);
  }

  try {
    // Re-initialize auth tied to this app with IndexedDB persistence
    auth = initializeAuth(_app, { persistence: indexedDBLocalPersistence });
    _saveClientDiagnostic('dt-last-auth-diagnostic', { time: new Date().toISOString(), persistence: 'indexedDBLocalPersistence', note: 'reinitialized via initializeAuth' });
    return;
  } catch (e) {
    console.warn('[Firebase] initializeAuth(indexedDBLocalPersistence) failed:', e?.message || e);
  }

  _saveClientDiagnostic('dt-last-auth-diagnostic', { time: new Date().toISOString(), persistence: 'none', note: 'falling back to default getAuth' });
}

// Kick off persistence resolution and expose it so auth actions can wait for
// the browser's best available storage before signing users in.
export const authReady = _ensureAuthPersistence().catch(() => {});

export async function getAppCheckToken() {
  // If App Check is disabled or not initialized, return null immediately.
  // This prevents 400 errors from exchangeRecaptchaEnterpriseToken calls.
  if (!_appCheck) return null;
  
  try {
    // Only attempt to get token if we are not on localhost (standard check)
    if (_isLocalhost) return null;

    const result = await _getAppCheckTokenInternal(_appCheck);
    return result.token;
  } catch (e) {
    // Silently fail as App Check should never block the app's core flow
    return null;
  }
}

// Collect client-side diagnostics about App Check + Auth for mobile debugging.
export async function collectAuthDiagnostics() {
  const diag = { time: new Date().toISOString(), userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null };
  try {
    diag.appCheck = !!_appCheck;
    diag.appCheckToken = await getAppCheckToken().catch(() => null);
  } catch (e) {
    diag.appCheckError = String(e?.message || e);
  }
  try {
    diag.currentUser = auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email ?? null } : null;
  } catch (e) {
    diag.currentUserError = String(e?.message || e);
  }
  try {
    // Attempt to read id token (non-blocking)
    if (auth.currentUser) {
      diag.idTokenPresent = !!(await auth.currentUser.getIdToken().catch(() => null));
    }
  } catch (e) {
    diag.idTokenError = String(e?.message || e);
  }
  _saveClientDiagnostic('dt-last-auth-diagnostic', diag);
  return diag;
}

// =============================================================================
// Re-export Firebase functions so consuming modules have one import source.
// All functions must come from this file to maintain singleton pattern.
// =============================================================================

export {
  // Auth
  signInWithEmailAndPassword,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  
  // Firestore - Document operations
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  
  // Firestore - Collection operations
  collection,
  addDoc,
  
  // Firestore - Query operations
  query,
  where,
  orderBy,
  limit,
  getDocs,
  
  // Firestore - Helpers
  serverTimestamp,
  arrayUnion,
  arrayRemove,
};

// =============================================================================
// Runtime Safeguard — prevent future duplicate initialization regressions
// =============================================================================
// Validates that all Firebase instances in memory are the unified instance.
// Runs once on module load to catch initialization errors early.
// In development (localStorage debug flag), logs the status.

const _isDevMode = () => {
  try {
    return typeof window !== 'undefined' && localStorage.getItem('dt-firebase-debug') === '1';
  } catch {
    return false;
  }
};

const _validateSingleton = () => {
  const apps = getApps();
  if (apps.length !== 1) {
    const msg = `[Firebase] ERROR: Expected 1 Firebase app instance, found ${apps.length}. Check for duplicate initializeApp() calls.`;
    console.error(msg);
    if (_isDevMode()) console.trace('[Firebase] Stack trace for duplicate init debugging');
  } else if (_isDevMode()) {
    console.info('[Firebase] ✓ Singleton validation passed: 1 instance, all modules connected');
  }
};

// Run validation on module load
_validateSingleton();
