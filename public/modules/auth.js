// =============================================================================
// Authentication — sign up, log in, log out, password reset, account deletion.
// Depends on: app-state.js, i18n.js, toast.js, Firebase Auth + Firestore CDN
// =============================================================================

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "../firebase-init.js?v=20260522c";
import { state } from "./app-state.js";
import { t } from "./i18n.js?v=20260521b";
import { showToast } from "./toast.js";

const DIALECT_BRITISH = "en-GB";

export async function signup() {
  const email = (document.getElementById("email")?.value || "").trim();
  const password = document.getElementById("password")?.value || "";

  if (!email || !password) {
    showToast(t("alert_email_password"), "error");
    return;
  }

  if (password.length < 6) {
    showToast(t("alert_password_length"), "error");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email,
      subscribed: false,
      children: [],
      storyDialect: DIALECT_BRITISH,
      storyLocale: DIALECT_BRITISH,
      language: null,
      createdAt: new Date().toISOString(),
      welcomeShown: false,
    });
  } catch (error) {
    console.error("Signup failed:", error);
    const message =
      error.code === "auth/email-already-in-use" ? "This email is already registered. Please log in." :
      error.code === "auth/invalid-email" ? "Please enter a valid email address." :
      error.code === "auth/weak-password" ? "Password must be at least 6 characters." :
      "Signup failed. Please try again.";
    showToast(message, "error");
  }
}

export async function login() {
  const email = (document.getElementById("email")?.value || "").trim();
  const password = document.getElementById("password")?.value || "";

  if (!email || !password) {
    showToast(t("alert_email_password"), "error");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Login failed:", error);
    const message =
      error.code === "auth/user-not-found" ? "No account found with this email." :
      error.code === "auth/wrong-password" ? "Incorrect password. Please try again." :
      error.code === "auth/invalid-credential" ? "Incorrect email or password." :
      "Login failed. Please try again.";
    showToast(message, "error");
  }
}

export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

export async function resetPassword() {
  const email = document.getElementById("email")?.value;
  if (!email) {
    showToast("Enter your email first", "error");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Password reset email sent ✉️", "success");
  } catch (err) {
    console.error("Password reset failed:", err.code, err.message);
    const msg =
      err.code === "auth/user-not-found" ? "No account found with this email address." :
      err.code === "auth/invalid-email" ? "Please enter a valid email address." :
      "Couldn't send the reset email — please try again.";
    showToast(msg, "error");
  }
}

export function deleteAccount() {
  if (!state.currentUser) {
    showToast(t("alert_delete_logged_in"), "error");
    return;
  }
  const input = document.getElementById("deletePasswordInput");
  const errEl = document.getElementById("deleteModalError");
  const btn   = document.getElementById("deleteModalConfirmBtn");
  if (input) input.value = "";
  if (errEl) { errEl.textContent = ""; errEl.classList.add("hidden"); }
  if (btn)   { btn.disabled = false; btn.textContent = "Delete Account"; }
  document.getElementById("deleteModal")?.classList.remove("hidden");
  setTimeout(() => input?.focus(), 120);
}

export function closeDeleteModal() {
  document.getElementById("deleteModal")?.classList.add("hidden");
}

export async function confirmDeleteAccount() {
  const input    = document.getElementById("deletePasswordInput");
  const errEl    = document.getElementById("deleteModalError");
  const btn      = document.getElementById("deleteModalConfirmBtn");
  const password = input?.value || "";

  function showErr(msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
  }

  if (!password) { showErr("Please enter your password."); return; }

  if (btn) { btn.disabled = true; btn.textContent = "Deleting…"; }
  if (errEl) errEl.classList.add("hidden");

  try {
    // Re-authenticate (Firebase requires this before sensitive operations)
    const credential = EmailAuthProvider.credential(state.currentUser.email, password);
    await reauthenticateWithCredential(state.currentUser, credential);

    const idToken = await state.currentUser.getIdToken();

    // Server handles: Stripe cancellation, Firestore wipe, Auth deletion
    const resp = await fetch("/api/account", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || "Deletion failed. Please try again.");
    }

    try { localStorage.clear(); } catch {}

    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
      await Promise.all(regs.map((r) => r.unregister()));
    }

    closeDeleteModal();
    showToast(t("alert_account_deleted"), "success");

    // onAuthStateChanged will navigate to the auth screen
    await signOut(auth).catch(() => {});

  } catch (err) {
    const msg =
      err.code === "auth/wrong-password"        ? "Incorrect password. Account not deleted." :
      err.code === "auth/invalid-credential"    ? "Incorrect password. Account not deleted." :
      err.code === "auth/requires-recent-login" ? "For security, please log out, log back in, and try again." :
      err.message || "Something went wrong. Please try again.";
    showErr(msg);
    if (btn) { btn.disabled = false; btn.textContent = "Delete Account"; }
  }
}
