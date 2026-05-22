// DreamTalez — Firebase Initialization
// Single module that owns Firebase app/auth/db instances.
// Import { auth, db } from here — never call initializeApp() again elsewhere.

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
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
if (!_isLocalhost) {
  try {
    _appCheck = initializeAppCheck(_app, {
      provider: new ReCaptchaEnterpriseProvider("6LfsMvcsAAAAAHOJg5HeTOn-QrlVclzH-QF-ffqx"),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn("[AppCheck] init failed:", e.message);
  }
}

export const auth = getAuth(_app);
export const db   = getFirestore(_app);

export async function getAppCheckToken() {
  if (!_appCheck) return null;
  try {
    const result = await _getAppCheckTokenInternal(_appCheck);
    return result.token;
  } catch {
    return null;
  }
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
