# onTrack: App Architecture and Android Guide

This document explains what onTrack does, how the code and data move through the app, how to run it, and what remains to make Android a polished first-class platform.

The project uses Expo SDK 57, React Native 0.86, React 19, Expo Router, Zustand, and AsyncStorage. Always consult the [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) when changing Expo APIs or native configuration.

## 1. What the app does

onTrack is a local-first daily planner and activity tracker. A user can:

- Complete onboarding with a name and personal goal.
- Plan a day with food, gym, work, movie/TV, sleep, water, personal, mindfulness, learning, appointment, habit, or custom activities.
- Mark activities upcoming, completed, partially completed, or skipped.
- Duplicate, move, edit, and delete activities.
- Track meal items and nutrition, including mock photo analysis.
- Build workouts, record sets, and run an active workout.
- Maintain work-session task lists and focus time.
- Search TMDB for movies and TV shows and save their metadata.
- Open Apple Health on iOS or Health Connect settings on Android for sleep data.
- Review calendar history, completion trends, streaks, and summary metrics.
- Change theme, AI, and haptics preferences.

The app does not currently require an account or cloud database. User data stays in local AsyncStorage. The AI features are deterministic mock responses, not calls to a live AI service.

## 2. Runtime architecture

```text
Screens and components
        |
        +-- Expo Router navigation
        |
        +-- Zustand stores ------------------ AsyncStorage
        |      |                               (local persistence)
        |      +-- schedule and detail data
        |      +-- user preferences
        |
        +-- Mock AI provider
        |
        +-- Movie client -- /api/movies/* -- Expo Router API routes -- TMDB
```

There are two separate execution environments:

1. The React Native client runs on iOS or Android.
2. The movie API routes run in the Expo development server locally or in a deployed server environment in production. The TMDB secret must exist only in this server environment.

## 3. Important directories

| Path | Responsibility |
| --- | --- |
| `src/app/` | File-based routes, screens, and API routes |
| `src/app/(tabs)/` | Today, Calendar, Insights, and Profile tabs |
| `src/app/detail/` | Category-specific activity detail screens |
| `src/components/primitives/` | Buttons, text, cards, inputs, symbols, and layout primitives |
| `src/components/shared/` | Activity cards, badges, chips, and metrics |
| `src/design-system/` | Colors, spacing, typography, radii, shadows, themes, and motion |
| `src/features/` | Reusable calendar and daily-tracking features |
| `src/store/` | Persisted schedule and preference state |
| `src/services/` | AI, movie, and storage adapters |
| `src/types/models.ts` | Domain model definitions |
| `src/utils/` | Dates, recurrence, completion, haptics, actions, and health-app linking |
| `src/constants/` | Built-in categories and sample data |

## 4. Navigation and screen flow

`src/app/_layout.tsx` is the root stack. It waits for both persisted stores to hydrate, seeds sample data once, and registers the tab group and pushed screens.

`src/app/(tabs)/_layout.tsx` checks `hasOnboarded`. A new or reset user is redirected to `/onboarding`; an onboarded user sees four native tabs:

- **Today** (`(tabs)/index.tsx`): renders `DayView` for today.
- **Calendar** (`(tabs)/calendar.tsx`): month grid, date selection, and day navigation.
- **Insights** (`(tabs)/insights.tsx`): derived completion, workout, and meal metrics.
- **Profile** (`(tabs)/profile.tsx`): theme, mock AI, haptics, TMDB attribution, and reset controls.

The shared activity form at `/activity-form` handles both creation and editing. The selected category's `detailKind` determines the editor and saved detail record:

| `detailKind` | Detail record | Detail route |
| --- | --- | --- |
| `food` | `Meal` | `/detail/food/[id]` |
| `gym` | `Workout` | `/detail/gym/[id]` |
| `work` | `WorkSession` | `/detail/work/[id]` |
| `movie` | `Movie` | `/detail/movie/[id]` |
| `sleep` | Activity only | `/detail/sleep/[id]` |
| `generic` | Activity only | `/detail/generic/[id]` |

The gym detail screen can push `/detail/gym-active/[id]` for an active set-by-set workout.

## 5. Data model and persistence

### Schedule store

`src/store/schedule.ts` owns:

- `activities`: the common schedule record for every item.
- `meals`: food-specific data linked by `activityId`.
- `workouts`: gym-specific data linked by `activityId`.
- `workSessions`: work-specific data linked by `activityId`.
- `movies`: TMDB metadata linked by `activityId`.
- `categories`: built-in plus any custom categories.
- `seeded`: prevents repeated sample-data insertion.

`saveEvent` is the central write operation. It creates or replaces the common activity, upserts the applicable detail record, and removes detail records that no longer match the category. Deleting an activity cascades to all linked detail arrays.

The store persists under `ontrack/schedule/v1`. Its custom merge keeps newly introduced built-in categories when loading older saved data.

### Preferences store

`src/store/preferences.ts` owns onboarding state, name, goal, theme preference, mock-AI toggle, and haptics toggle. It persists under `ontrack/preferences/v1`.

### Storage limitations

- Data is device-local and is not synchronized between iOS and Android.
- Uninstalling the app generally removes the data.
- Picked image values are local URIs. They are not uploaded or guaranteed to survive every OS cleanup or app migration.
- A future sync service should sit behind `src/services/storage/` instead of being called directly from screens.

## 6. Feature behavior

### Daily tracking

`DayView` selects activities for a date, sorts them by start time, draws completion state, and displays a current-time line for today. A long press opens activity actions. iOS uses `ActionSheetIOS`; Android uses the existing `Alert` fallback.

### Calendar and insights

Calendar cells are generated in `src/utils/date.ts`. Completion percentages, day indicators, and streaks are pure functions in `src/utils/completion.ts`. Insights derives its values from the persisted arrays; it does not maintain a second analytics database.

### Food and image selection

Food activities store editable food items and optional mock analysis. Images come from `expo-image-picker` and render through `expo-image`. The mock AI provider waits briefly, returns sample nutrition, and validates the response shape before the UI receives it.

### Gym

Workouts contain exercises, sets, rest duration, previous-best text, and timestamps. The active-workout route updates set completion and saves the workout back to Zustand.

### Work

Work sessions contain tasks, priority, completion, estimates, and focus minutes. Task edits update the detail record linked to the parent activity.

### Movie and TV search

The native client in `src/services/movies/index.ts` calls `/api/movies/search` and `/api/movies/[id]`.

- In local native development, it derives the current host from `Constants.expoConfig.hostUri`, so changing Wi-Fi addresses does not require editing `.env.local`.
- On web, it uses same-origin relative URLs.
- In production native builds, it uses `EXPO_PUBLIC_API_BASE_URL`.

The API route reads `TMDB_READ_ACCESS_TOKEN` on the server, calls TMDB, normalizes the response, and returns only the fields used by the app. Never rename the token to an `EXPO_PUBLIC_` variable; that would expose it in the client bundle.

### Sleep integration

The app currently opens the platform health-data UI; it does not read health records. iOS opens Apple Health. Android sends a Health Connect settings intent and shows guidance if Health Connect is unavailable.

## 7. Local setup

Requirements:

- Node.js and npm
- Expo account for EAS services
- Android Studio with an Android Virtual Device, or a physical Android device
- A TMDB Read Access Token if movie search is needed

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example`:

```dotenv
TMDB_READ_ACCESS_TOKEN=your_server_only_tmdb_read_access_token
EXPO_PUBLIC_API_BASE_URL=https://your-production-api-origin.example
```

The production URL can remain a placeholder during local development. `.env.local` is ignored by Git and must never be committed.

Run checks:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

## 8. Fastest Android smoke test with Expo Go

1. Start an Android emulator from Android Studio, or install Expo Go on a physical Android device.
2. Run:

   ```bash
   npm run android
   ```

   Alternatively, run `npx expo start` and press `a`.

3. Keep a physical device and development computer on the same network for LAN mode.
4. Complete onboarding and test the checklist in section 12.

Expo Go is useful for the first smoke test because the current dependencies are included in Expo Go. Use a development build before treating Android as release-ready, because it validates the actual native configuration and package identity.

## 9. Required Android compatibility work

Most business logic already works on Android. The main visual issue is icon configuration.

### 9.1 Make all symbols cross-platform

`src/components/primitives/symbol.tsx` currently accepts SF Symbol strings. In Expo SDK 57, a string is treated as iOS-only; Android needs a Material Symbol name. The shared icon API should use a platform-name object:

```tsx
<SymbolView
  name={{
    ios: 'calendar.badge.clock',
    android: 'calendar_clock',
    web: 'calendar_clock',
  }}
/>
```

Recommended refactor:

1. Define an application-owned semantic icon type, such as `AppIconName`.
2. Create one map from semantic names to `{ ios, android, web }` names.
3. Store semantic icon keys in categories and workouts instead of raw SF Symbol strings.
4. Resolve the platform names only inside the shared `Symbol` component.

This prevents platform-specific names from spreading through the domain model.

### 9.2 Add Android tab icons

The current native tabs specify only `sf`, which is iOS-only. SDK 57 native tabs accept `md` for Android:

```tsx
<NativeTabs.Trigger.Icon
  sf={{ default: 'sun.max', selected: 'sun.max.fill' }}
  md={{ default: 'light_mode', selected: 'light_mode' }}
/>
```

Add `md` values for all four tabs. Reasonable mappings are:

| Tab | iOS | Android Material Symbol |
| --- | --- | --- |
| Today | `sun.max` | `light_mode` or `today` |
| Calendar | `calendar` | `calendar_month` |
| Insights | `chart.line.uptrend.xyaxis` | `monitoring` |
| Profile | `person` | `person` |

### 9.3 Add a stable Android application ID

`app.json` currently has an iOS bundle identifier but no `android.package`. Add a permanent value before the first distributed Android build, for example:

```json
{
  "expo": {
    "android": {
      "package": "com.imtihoss.ontracknow"
    }
  }
}
```

Choose carefully: the Google Play package name cannot be changed for an existing listing.

### 9.4 Keep Android `RECORD_AUDIO` for voice features

The app records audio. Dock search voice, journal dictate/voice notes, and the travel translator all need `android.permission.RECORD_AUDIO` in the **merged AndroidManifest**. Android Settings → Apps → onTrack → Permissions only shows a Microphone row when that permission is in the installed APK. JS/OTA cannot add it.

Keep all of these:

1. `"android.permission.RECORD_AUDIO"` in `expo.android.permissions` (alongside `ACCESS_COARSE_LOCATION`; do not add `ACCESS_FINE_LOCATION`).
2. The `expo-audio` plugin with `recordAudioAndroid` left enabled (`true` is the default).
3. `expo-image-picker` `microphonePermission` as a **usage-description string**, never `false`.

Do **not** set image-picker `"microphonePermission": false`. That plugin calls `withBlockedPermissions(['android.permission.RECORD_AUDIO'])`, which strips `RECORD_AUDIO` for the **whole app**, including expo-audio. Do not add `blockedPermissions` that would drop the mic either.

Permission changes require a **new native Android binary** and reinstall. An OTA / EAS Update will not make Microphone appear in system settings.

### 9.5 Handle Android ImagePicker activity recreation

Android may destroy the activity while the system picker is open. Expo exposes `ImagePicker.getPendingResultAsync()` to recover that result. Add recovery during screen/app startup before relying on photo selection for production.

### 9.6 Validate Health Connect behavior

Test the sleep button on:

- Android 14 or newer, where Health Connect is integrated into system settings.
- An older supported Android device with the Health Connect app installed.
- A device without Health Connect, confirming the fallback alert is understandable.

Current behavior only opens settings, so no health-data runtime permission is required yet. Reading sleep data later will require a Health Connect integration, manifest declarations, runtime permissions, a privacy policy, and Google Play health-data declarations.

## 10. Android development build

Expo SDK 57 recommends an installable APK for an emulator or device development build. The project does not currently include `expo-dev-client` or a `development` profile, so configure them first:

```bash
npx expo install expo-dev-client
```

Add a development profile to `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

Then build and run:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile development
npx expo start
```

Install the resulting APK on the emulator/device, open it, and connect it to the running development server.

For a local native build on a Mac with Android Studio configured, `npx expo run:android` is another option. The project uses Continuous Native Generation, so generated `android/` and `ios/` folders should not be hand-maintained unless the project intentionally switches workflows.

## 11. Production movie API and Android build

A production Android app cannot call the development computer. Deploy the Expo Router server output first:

```bash
npx expo export -p web
npx eas-cli@latest deploy
```

Configure the deployment's server secret:

```text
TMDB_READ_ACCESS_TOKEN=<server-only-token>
```

Configure the Android build environment with the deployed origin:

```text
EXPO_PUBLIC_API_BASE_URL=https://your-project.expo.app
```

`EXPO_PUBLIC_` values are inlined into the client bundle. After changing the production base URL, create a new build or update whose JavaScript bundle includes the new value.

Build the production Android App Bundle:

```bash
npx eas-cli@latest build --platform android --profile production
```

EAS produces an AAB for Google Play by default. Use an APK development/internal profile for direct installation.

## 12. Android validation checklist

Test on at least one emulator and one physical device when possible:

- [ ] Fresh install redirects to onboarding.
- [ ] Onboarding survives an app restart.
- [ ] All tab labels and icons render.
- [ ] Light, dark, and system themes are readable.
- [ ] Sample activities appear only once.
- [ ] Add, edit, duplicate, move, skip, complete, and delete work.
- [ ] Long-press actions use the Android alert UI correctly.
- [ ] Date and time inputs behave correctly with the Android keyboard.
- [ ] Food photo selection survives returning from the system picker.
- [ ] Meal mock analysis and manual corrections work.
- [ ] Active workout sets persist after backgrounding and reopening.
- [ ] Work tasks and focus time persist.
- [ ] Movie search and movie detail lookup work on LAN development.
- [ ] Movie search works against the deployed production API.
- [ ] TMDB poster images load over HTTPS.
- [ ] Health Connect opens or shows the fallback alert.
- [ ] External TMDB links open in a browser.
- [ ] Haptics toggle changes feedback behavior.
- [ ] Reset clears both stores and returns to onboarding.
- [ ] Layout works on small and large Android screens.
- [ ] TalkBack can identify buttons, inputs, tabs, and activity actions.
- [ ] `npm run typecheck`, `npm run lint`, and all tests pass.

## 13. Known product limitations

- No authentication, cloud sync, backup, or multi-device support.
- AI results are mock data and should not be treated as nutritional or medical advice.
- Health integration opens the platform app/settings but does not read data.
- Recurrence helpers exist, but the persisted activity selector currently selects exact dates rather than materializing recurring occurrences.
- Custom category creation exists at the store level but has no complete user-facing management flow.
- Movie search depends on a separately running or deployed server route.
- Native tabs and Expo Symbols are still evolving APIs; re-check the exact Expo SDK docs during upgrades.

## 14. Recommended Android implementation order

1. Add `android.package` and remove the unused microphone permission.
2. Refactor shared symbols to semantic cross-platform mappings.
3. Add `md` icons to all native tabs.
4. Run the app in Expo Go and fix visible layout/input differences.
5. Add ImagePicker pending-result recovery.
6. Add `expo-dev-client` and an Android APK development profile.
7. Test Health Connect and all checklist flows on a physical device.
8. Deploy the movie API and set the production API origin.
9. Create an AAB, run internal testing, then prepare the Google Play listing and privacy disclosures.

## 15. Useful commands

```bash
# Install
npm install

# Start platforms
npm run ios
npm run android
npm run web

# Quality checks
npm run typecheck
npm run lint
npm test -- --runInBand

# Inspect resolved Expo configuration
npx expo config --type public

# Check package compatibility with SDK 57
npx expo install --check

# Export and serve API routes/web output locally
npx expo export -p web
npx expo serve

# EAS development and production builds
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform android --profile production
```

## 16. SDK 57 references

- [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Symbols](https://docs.expo.dev/versions/v57.0.0/sdk/symbols/)
- [Expo Router native tabs](https://docs.expo.dev/router/advanced/native-tabs/)
- [Expo ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)
- [Expo app configuration](https://docs.expo.dev/versions/v57.0.0/config/app/)
- [Create an Android development build](https://docs.expo.dev/develop/development-builds/create-a-build/)
- [EAS Android development build tutorial](https://docs.expo.dev/tutorial/eas/android-development-build/)
