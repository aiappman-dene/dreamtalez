# Android release keystore & SHA256 — Quick Operational Guide

Purpose: generate a release keystore, back it up securely, extract the SHA256 fingerprint (for Firebase / assetlinks), and place config files where Gradle expects them.

1) Generate a release keystore (example)

```bash
keytool -genkeypair -v \
  -keystore dreamtalez-release.jks \
  -alias dreamtalez \
  -keyalg RSA -keysize 2048 -validity 10000
```

- You'll be prompted for store and key passwords and the certificate subject fields.
- Store the `dreamtalez-release.jks` file *locally* (do not commit).

2) Recommended file locations

- Put the keystore in a secure folder outside source control, e.g. `~/secrets/dreamtalez/` or `C:\keystore\dreamtalez\`.
- Add a file `android/keystore.properties` with (example):

```
storeFile=dreamtalez-release.jks
storePassword=<STORE_PASSWORD>
keyAlias=dreamtalez
keyPassword=<KEY_PASSWORD>
```

- If you prefer to keep the actual JKS next to the Android project for CI, copy it into `android/` and ensure `android/.gitignore` excludes it.

3) Extract SHA256 fingerprint (for Firebase / assetlinks)

- Linux / macOS (bash):

```bash
keytool -list -v -keystore path/to/dreamtalez-release.jks -alias dreamtalez -storepass <STOREPASS> | awk -F": " '/SHA256:/{print $2}'
```

- Windows PowerShell (example):

```powershell
&(keytool -list -v -keystore "path\to\dreamtalez-release.jks" -alias dreamtalez -storepass "<STOREPASS>") | Select-String 'SHA256:'
```

- I included two helper scripts: `scripts/compute_sha256.sh` and `scripts/compute_sha256.ps1` to automate extraction.

4) Where to use the fingerprint

- Add the SHA256 to `deploy.env` or the cloud provider secret as `ANDROID_SHA256_FINGERPRINT` (colon-separated uppercase format).
- `server.js` uses `process.env.ANDROID_SHA256_FINGERPRINT` to serve `/.well-known/assetlinks.json`.

5) Backup & security

- Backup the keystore and `keystore.properties` in an encrypted vault (Bitwarden/1Password/secure S3 with KMS).
- Never commit passwords or the JKS to Git.

6) Common mistakes

- Using debug keystore instead of release keystore (wrong fingerprint).
- Forgetting to set the exact alias name used to create the key.
- Uploading the wrong fingerprint format (should be colon-separated hex SHA256).
