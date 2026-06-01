# Firebase Android Setup — Quick Guide

1) Package name

- The Android app package id is `com.bedtalez.app` (see `capacitor.config.json`). Use this when creating the Android app in Firebase.

2) `google-services.json`

- Download `google-services.json` from Firebase Console → Project Settings → Your apps → Android app.
- Place the file at: `android/app/google-services.json`.
- Ensure `android/.gitignore` keeps it out of source control.

3) Register SHA256 fingerprint

- In Firebase Console → Project Settings → Android app, add the **SHA-256** fingerprint from your release keystore (see `docs/ANDROID_RELEASE_SHA256.md`).
- This fingerprint is required for features like App Links, App Check, and some Firebase services.

4) App Check (future)

- The project currently does not require App Check for the mobile release. When enabling App Check, register the app and update the server's allowed tokens flow.

5) Verify

- Build a debug/release install and verify Firebase initialization on device.
- Check Firebase Console for first successful app instance and test Crashlytics non-fatal logs.
