# Add-on architecture

onTrack add-ons are first-party feature modules. The shipped app does not depend on MCP, a plugin
marketplace, a remote UI framework, or a paid feature-flag service.

## Boundaries

- `src/addons/registry.ts` is the small shell-facing manifest for discovery, category visibility,
  and navigation.
- `src/features/<addon>/` owns the add-on's models, UI helpers, and provider interfaces.
- `src/store/<addon>.ts` owns local-first state. Disabling an add-on hides it and keeps its data.
- Access (`addon_entitlements`) is server-owned and separate from the user's synced on/off choice.
  TestFlight builds receive testing access to the full catalog.
- `src/services/cloud/sync.ts` is the single cross-device adapter. Each domain supplies `read`,
  `write`, and `subscribe` once; screens never call sync APIs.
- Expo Router routes compose add-on screens into the shell. Shared primitives and models stay
  outside feature folders.
- `src/agents/registry.ts` is a separate, declarative companion catalog. An agent can require an
  add-on without the add-on importing agent code.

## Add a module

1. Add one `AddonDefinition` to `ADDONS`.
2. Create its feature folder, store, and routes.
3. Register one sync domain if it owns persistent data.
4. Gate its tab or entry point from `useAddons`.
5. Add registry, persistence, and visibility tests.

Do not copy entitlement, persistence, API URL, loading, or error handling into the feature. Extend
the corresponding shared adapter instead.

## Agent extensions

The agent catalog is intentionally empty in this build. The infrastructure supports future
companions without shipping a Gym Buddy, Travel Agent, Food Agent, or any other agent yet.

- `src/agents/types.ts` defines manifests, permissions, providers, tools, installations, and shared
  conversations.
- `src/agents/runtime.ts` checks installation, entitlement, add-on availability, explicit user
  permission, provider access, and tool access before an agent can run.
- `src/store/agents.ts` is the one persisted store for every agent. Do not create a store per agent.
- `src/features/agents/agent-manager.tsx` automatically lists manifests and reuses shared settings
  rows for installation, enablement, and permissions.
- The `agents` cloud domain syncs installations and conversations. `agent_entitlements` remains
  server-owned so agents can later be included, bundled, or sold separately.

To add an agent later:

1. Register one `AgentDefinition` in `src/agents/registry.ts`.
2. Register its provider and only the tools named by its capability manifest.
3. Add its entitlement through the existing entitlement service.
4. Add runtime permission and provider contract tests.

No navigation, settings UI, persistence, cloud-sync, or database refactor is required. iOS builds
must compile agent code into the app; do not download executable agent code at runtime.

## Cost defaults

- Use bundled first-party UI and local AsyncStorage first.
- Use the existing Supabase project for accounts, JSON state, and private file storage.
- Sync on launch/sign-in and debounce changed domains; do not enable realtime unless collaboration
  requires it.
- Put vendor travel search behind `TravelSearchProvider`. The beta uses free provider web checkout
  links, so onTrack stores no payment data and pays no aggregator fee.
- Travel and checklist sharing use the stable `ontrack--links.expo.app` EAS Hosting alias with
  Apple Universal Links (`apple-app-site-association`) and Android App Links (`assetlinks.json`).
  Landing pages keep the invitation route available while a friend installs the app.
  Partner connect uses `/p/straiaway` on the same host.
- Keep AI optional and offload only when a user explicitly requests analysis. Cache normalized
  results in the owning domain.
- MCP is for developer/admin automation, not the mobile runtime.
- Agent providers are adapters. Start with local rules or one existing API; do not add a provider
  SDK when a small authenticated HTTP adapter is sufficient.

## TestFlight

`eas build --platform ios --profile testflight` creates a release binary with its JavaScript bundle
embedded. It does not use Metro, Expo Go, a QR code, or the developer computer. The app remains
usable in local test mode if cloud variables are absent. Add the public Supabase values to EAS's
`preview` environment to enable account sync.
