---
name: android-release-apk
description: >-
  Build a local Android release APK and replace the shared Google Drive sideload
  copy. Use when the user asks for a new APK, to push/replace the Drive APK, or
  after native Android/Kotlin module changes that OTA cannot ship.
---

# Android release APK → Google Drive

JS/assets ship via OTA on the `device` channel (`ship:push` / `update:device`). Use this skill only when a **new binary** is required.

## One command

```bash
npm run android:release-to-drive
```

Script: `scripts/android-release-to-drive.sh`

| Flag | Effect |
|------|--------|
| *(default)* | Incremental `assembleRelease` (arm64, Gradle daemon), delete Drive `*.apk`, upload timestamped APK |
| `--upload-only` | Skip Gradle; upload newest staged APK from `.eas-local-build/apks/` |
| `--no-upload` | Build only |
| `--clean-native` | Clean local `modules/*` before assemble (stale Kotlin) |
| `--no-clean-native` | Same as default (kept for older callers) |
| `--all-abis` | Build every ABI instead of arm64-only sideload |

Alternative (EAS cloud APK on `device` channel):

```bash
npm run build:device:android
```

## Drive target

- Folder: https://drive.google.com/drive/folders/162sjQp7GPhie7MCJMdIAbEXPATmIa1Pa
- File name: `onTrack-<expo.version>-<YYYYMMDD-HHMMSS>-android-release.apk` (from `app.json` + build time)
- rclone remote: `gdrive` (`~/.config/rclone/rclone.conf`)
- Override folder: `ONTRACK_DRIVE_APK_FOLDER_ID`

## Full ship flow (PR + OTA — no APK)

When the user says **“run the push script”** / **“push script”** / **“ship push”**:

```bash
npm run ship:push -- -m "Why this ships"
```

That runs `scripts/ship-push.sh`: commit → PR → merge main → delete branch → `update:testflight` + `update:device`.

## When to use this vs OTA

| Change | Ship with |
|--------|-----------|
| JS / TS / assets only | `ship:push` / `update:device` (+ TestFlight via same push) |
| Native (`modules/**`, Android native) or `app.json` version bump | **this APK script** or `build:device:android` (and iOS store build if needed) |
| End-to-end JS ship | `npm run ship:push -- -m "…"` |

Local release APKs must keep `expo.modules.updates.ENABLED=true` and `device` channel headers in `AndroidManifest.xml` so sideload installs keep receiving OTA.

## Agent checklist

1. Run `npm run android:release-to-drive` (needs network + local JDK 17 / Android SDK / rclone).
2. Return the Drive file link + folder URL from the script output.
3. Local APKs are staged under `.eas-local-build/apks/`, outside the EAS upload archive.
4. If rclone auth expired: re-authorize `rclone` remote `gdrive` (do not put tokens in the repo).
