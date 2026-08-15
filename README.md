# onTrack

iOS-first, local-first daily life app built with Expo. Schedule your day and turn food, fitness,
plant care, and travel modules on or off without deleting their data.

## Quick start

```bash
npm install
npm run ios
```

Local development uses Metro. TestFlight builds use the `testflight` EAS profile and embed the
JavaScript bundle, so testers do not need Metro, Expo Go, a QR code, or the developer computer.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run ios` | Clear Metro's cache, start Expo, and open iOS Simulator |
| `npm run typecheck` | TypeScript validation |
| `npm test` | Run unit tests |
| `npx eas-cli@latest build --platform ios --profile testflight` | Build the standalone TestFlight binary |

## Project structure

```text
src/
  addons/           Small first-party add-on catalog and visibility rules
  agents/           Agent manifests, permissions, provider and tool runtime
  app/              Expo Router screens
  components/       Reusable UI primitives and shared widgets
  design-system/    Tokens, themes, typography

## Token Budget & Optimisation Guidelines

- Keep any source file under **700 lines**.
- Never use hard‑coded pixel values like `12px`; use design‑system tokens (`useResponsive()`, `AppText fit`, etc.).
- Always-on agent context is intentionally slim (`.cursor/rules/ontrack-core.mdc`). Heavy agent-ui / verify detail lives in `.cursor/skills/agent-ui/` and glob-scoped rules — load only for UI work.
- See `.cursor/rules/token-optimization.mdc` for maintenance habits.
- Example of good usage:
  ```tsx
  <AppText style={appTextStyle('body')}>Hello</AppText>
  ```
  versus bad usage:
  ```tsx
  <Text style={{fontSize: 14, marginTop: 8}}>Hello</Text>
  ```

  features/         Isolated feature UI, models, and provider interfaces
  services/         AI, cloud sync, provider, and storage adapters
  store/            Zustand persisted state
  types/            Shared TypeScript models
  utils/            Date, completion, haptics helpers
```

## Current milestone

- Onboarding, Today, Calendar, Insights, Profile tabs
- Daily timeline with completion ring and mock AI summaries
- Activity add/edit, long-press actions (skip, duplicate, move, delete)
- Food detail with photo picker and mock AI meal analysis
- Gym active workout mode with persisted set completion
- Work task checklist
- Local persistence via Zustand + AsyncStorage
- Plant identification, health check-ins, room-aware care plans, and local watering reminders
- Tester-controlled Food, Fitness, Plants, and Travel add-ons
- Travel plans, calendar dates, friend invites, flight search, and stay search
- Hosted install-or-open travel and checklist collaboration invitations at
  `ontrack--links.expo.app`
- Google/Apple SSO with local guest mode and guest-to-account data resolution
- Agent-ready catalog, permissions, install/remove state, provider runtime, and synced conversations
  (no concrete agents are included yet)
- One week of seed data on first launch

See [`docs/ADDONS.md`](docs/ADDONS.md) for the extension contract and cost controls.

## TestFlight and cloud sync

The `testflight` EAS profile is a store-distribution release build. Add
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the EAS `preview`
environment, then apply the Supabase migrations before inviting cross-device testers. If those
values are absent, the same binary runs in local test mode and never waits for a server.

The app uses one `app_state` row per account and data domain, private `app-media` storage, row-level
security, and debounced writes. Guests stay local until they choose Google or Apple; see
[`docs/AUTH_SETUP.md`](docs/AUTH_SETUP.md) for provider-console callbacks, Apple entitlement and
secret-rotation requirements, and release gates. No realtime, feature-flag, subscription, or plugin
vendor is required for the beta.

## Meal analysis

Meals support direct camera capture, photo-library input, restaurant/delivery links, manual correction,
full source nutrients, and target-aware Insights. Image and link analysis use guarded server routes with
OpenAI vision/web search and USDA FoodData Central grounding. Copy the nutrition variables from
`.env.example`; secrets must remain server-only. `CLINICAL_AI_ENABLED` defaults to `false` so no meal
photo is transmitted until the intended privacy configuration is explicitly enabled.

Youth, infant, and cloud-clinical flags default off. The Supabase migration in `supabase/migrations`
creates the private nutrition schema, RLS policies, clinician approval rules, audit immutability, and
private meal-photo bucket. Do not enable PHI processing until the required BAAs, high-compliance project
configuration, legal review, clinical review, and security review are complete.

For free local photo analysis during development, install Ollama and pull `qwen3-vl:2b`, then set
`MEAL_AI_PROVIDER=ollama` and `LOCAL_MEAL_AI_ENABLED=true` in `.env.local`. The Expo API route sends
the normalized image only to the loopback Ollama service; USDA grounding remains optional through
`USDA_FDC_API_KEY`. Restaurant-link analysis continues to require the guarded cloud provider.

## Grocery recipe import

Lists have an explicit Checklist or Grocery type. Grocery owners can import one
recipe at a time from a public HTTPS URL, camera photo, screenshot, or system
share. Every result is reviewed before it becomes a meal card, and the Combined
view synchronizes checks across matching ingredient occurrences.

Set the server-only `RECIPE_AI_ENABLED=true` and `OPENAI_API_KEY` values to
enable extraction. `OPENAI_RECIPE_MODEL` is optional and otherwise falls back to
the existing meal model. Apply the Supabase migrations for collaborative recipe
rows and the private, list-scoped recipe-image bucket.

## iOS notes

- Portrait iPhone only for this milestone
- Camera unavailable in Simulator; meal flow uses photo library picker
- Long-press an activity card for the action menu

## Plant analysis

Plants use guarded Expo Router API routes and the same free local Ollama vision model as meal photos
for confidence-gated identification, visible-health assessment, room-aware care guidance, and
follow-up check-ins. With the existing `MEAL_AI_PROVIDER=ollama` and `LOCAL_MEAL_AI_ENABLED=true`
setup, plants work without additional provider configuration. Alternatively set
`PLANT_AI_PROVIDER=ollama`, `LOCAL_PLANT_AI_ENABLED=true`, and optionally
`OLLAMA_PLANT_MODEL=qwen3-vl:2b`. Plant and check-in photos are normalized into the app documents directory; analysis
copies are resized and re-encoded to remove EXIF metadata. Optional room photos are sent only to
the selected analysis provider for the care-plan request and are not persisted by the app. General horticultural
reference links are attached by the server rather than invented by the local model.

Production can use the free Cloudflare Workers AI allocation through
`cloudflare/plant-ai-gateway`. Deploy that Worker, store the same generated shared secret as the
Worker secret `PLANT_AI_GATEWAY_SHARED_SECRET` and the EAS Hosting **sensitive** variable
`CLOUDFLARE_PLANT_AI_SHARED_SECRET`, then set `PLANT_AI_PROVIDER=cloudflare`,
`PLANT_AI_ENABLED=true`, and `CLOUDFLARE_PLANT_AI_URL` to the Worker origin. The shared secret and
plant photos remain server-side; never prefix either secret with `EXPO_PUBLIC_`. EAS Hosting cannot
deploy variables with `secret` visibility, so use `sensitive` visibility for its copy of the shared
secret.

Watering reminders are one-off local notifications. Each logged watering advances the next check
from the actual watering date and creates the next Today/Calendar activity. Guidance is an editable
starting range and soil check, not an exact requirement or plant-disease diagnosis.

## Movie search setup

Movie events use TMDB through server-side Expo Router API routes. Copy `.env.example` to
`.env.local` and set `TMDB_READ_ACCESS_TOKEN`. Local native development automatically uses the
current Expo CLI host. Set `EXPO_PUBLIC_API_BASE_URL` to the deployed API origin for production
native builds. Keep the TMDB token server-only.

The `npm run ios` development server handles local API routes while it remains running. For a
production-like local server, use `npx expo serve`. Deploy the web bundle and API routes together with
`npx expo export -p web` followed by `npx eas-cli@latest deploy`; configure the same environment
variables for preview and production in EAS.

## Live flight search

Flight results are rendered inside the Travel add-on through a server-side Amadeus Self-Service
adapter. Create an Amadeus application and configure `AMADEUS_CLIENT_ID`,
`AMADEUS_CLIENT_SECRET`, and `AMADEUS_ENVIRONMENT`. The `test` environment returns limited cached
sandbox data and is labeled **Test data** in the app. Set the environment to `production` only after
Amadeus enables production access; those results are labeled **Live prices**.

Keep both credentials server-only. For standalone and TestFlight builds,
`EXPO_PUBLIC_API_BASE_URL` must point to the deployed Expo API-route origin. Configure the Amadeus
secrets in the same EAS Hosting environment, never in `eas.json` or an `EXPO_PUBLIC_` variable.

## Flight confirmation import

Flight screenshots, PDFs, text files, and saved emails are OCRed on-device and
parsed locally first. To enable the optional free-tier fallback for layouts the
local parser cannot complete, set the server-only `GEMINI_API_KEY`; the model
defaults to Google's current `gemini-flash-lite-latest` alias and can be overridden with
`TRAVEL_GEMINI_MODEL`. Production native builds also need
`EXPO_PUBLIC_API_BASE_URL` pointing at the deployed Expo API origin.

The app sends OCR text, never the original confirmation asset, to this fallback.
Passenger names, email addresses, phone numbers, confirmation codes, ticket and
loyalty identifiers, and seats are redacted first. Confirmation codes and seats
stay on-device and are merged back into the review draft locally.
Validated fallback results are kept in a bounded, encrypted, device-only parser
memory keyed by a one-way fingerprint of the redacted OCR text; the raw text is
not stored. Re-importing a learned confirmation therefore stays local and does
not spend another provider request. If the service is unavailable or its free
quota is exhausted, local import still completes without AI enrichment.
