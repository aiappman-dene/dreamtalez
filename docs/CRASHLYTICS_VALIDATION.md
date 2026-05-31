# Crashlytics — Privacy-safe Validation Guide

Purpose: show a safe, reproducible flow to validate Crashlytics on Android without sending real user data.

1) Minimal test code (native runtime only)

Create a small, deliberate test action that triggers the native Crashlytics crash API. Example (JS bridge):

```js
import { Crashlytics } from '@capacitor-firebase/crashlytics';

function triggerNativeCrash() {
  if (Crashlytics && Crashlytics.crash) {
    // Intentional synthetic crash — use only on test builds/dev device
    Crashlytics.crash();
  } else {
    console.warn('Crashlytics plugin not available on this platform.');
  }
}
```

Notes:
- On the web this is a no-op (the repo preserves a safe web no-op in `public/crashlytics.js`).
- Only run this on a test device or internal testing track.

2) Build & install

- Build a signed release AAB / APK: `./gradlew bundleRelease` or `./gradlew assembleRelease`.
- Install on a physical device (internal test track, or `adb install` for an APK).

3) Trigger & verify

- Trigger the synthetic crash on the device.
- Open Firebase Console → Crashlytics and wait (a few minutes) for the crash to appear.
- If stack traces are obfuscated, upload the `mapping.txt` (Gradle can upload automatically when configured).

4) Android release caveats

- Ensure `google-services.json` is present during the Android build so Crashlytics init runs.
- Ensure `mappingFileUploadEnabled` is set in Gradle for release builds to enable deobfuscation.

5) Privacy & best practice

- Do not include story text, child names, or tokens in crash reports.
- Use synthetic test errors (no PII) and mark tests in a shared document.
