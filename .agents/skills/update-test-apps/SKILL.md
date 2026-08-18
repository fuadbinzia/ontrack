---
name: update-test-apps
description: >-
  Use when the user asks to “update test apps” or requests refreshing test
  simulators/emulators with the latest build. Keep all onTrack test devices in
  sync, including onTrack Agent devices plus the headed user targets
  (onTrack iPhone 17 Pro and Galaxy_S26), even when those devices are restricted
  or not currently running.
---

# Update test apps on all simulators and emulators

## What to do

1. Ensure you are at the repo root:

```bash
cd /Users/rocky/Development/onTrack
```

2. Build and install the current local debug artifacts to **all** onTrack virtual
test devices:

```bash
npm run virtual-devices:update
```

3. Return the summary lines from the command and call out any failures.

### Restricted / headed device handling

- Do not limit to running devices only. The command above explicitly includes:
  - iOS: onTrack Agent 1, onTrack Agent 2, onTrack Agent 3, onTrack Agent 4,
    onTrack iPhone 17 Pro
  - Android: Galaxy_S26, onTrack_Agent_1, onTrack_Agent_2, onTrack_Agent_3,
    onTrack_Agent_4
- Keep the headed devices in the device list even if they are non-default; do not
  skip them.
- If a required device is missing, report that exact missing device as an
  actionable blocker.

## Success criteria

- Output contains `iOS simulators updated: <n>` and
  `Android emulators updated: <n>` (or one side says `0` if intentionally
  unavailable).
- The latest built artifacts are installed on the devices that were successfully
  reached.
- No app uninstall/erase is performed during this update flow.

## Optional split mode

- If user asks for platform-specific only:
  - iOS only: `npm run ios:update-simulators`
  - Android only: `npm run android:update-emulators`
