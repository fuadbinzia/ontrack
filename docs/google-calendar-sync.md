# Google Calendar sync

Calendar sync is available to signed-in users from **Profile → Features → Calendar Sync**.

Users can choose a persisted direction:

- **Two-Way:** changes are reconciled in both calendars.
- **To Google:** onTrack is the source; Google-only events are not imported.
- **From Google:** Google is the source; onTrack-only events are not exported, and local changes to synced Google events are replaced on the next sync.

## Deployment configuration

1. Enable the Google Calendar API in Google Cloud and create a Web application OAuth client.
2. Add this authorized redirect URI (using the deployed Expo Router API origin):
   `https://ontrack.expo.app/api/calendar/google/callback`
3. Configure these server-only environment variables in the API hosting environment:
   - `GOOGLE_CALENDAR_CLIENT_ID`
   - `GOOGLE_CALENDAR_CLIENT_SECRET`
   - `GOOGLE_CALENDAR_REDIRECT_URI` (the exact authorized HTTPS callback URI)
   - `GOOGLE_CALENDAR_STATE_SECRET` (a long random value)
   - `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY` (a separate long random value)
   - `SUPABASE_SERVICE_ROLE_KEY`

Native development calls the hosted Calendar API rather than the local Metro
API runtime. Override `EXPO_PUBLIC_CALENDAR_API_BASE_URL` only when testing a
different HTTPS Hosting deployment.

Never prefix these variables with `EXPO_PUBLIC_` or bundle them into a native build.

For EAS Hosting, use `sensitive` visibility rather than `secret`: EAS builder-only
secrets are not injected into Hosting workers. Production deploys must explicitly
select the environment:

```bash
npx eas-cli@latest env:exec production 'npx expo export -p web' --non-interactive
npx eas-cli@latest deploy --prod --environment production --non-interactive
```

Re-export after every Hosting environment-variable change; deployments are
immutable and reusing an older `dist/` can retain an older server-variable set.
The callback must use the stable production alias rather than an immutable
`ontrack--<deployment>.expo.app` URL, which changes with every deployment.

## Data and deletion behavior

- onTrack stores Google refresh credentials encrypted in the server-only connection table.
- Event mappings track whether a copy originated in Google or onTrack.
- Normal edits and deletions propagate in both directions on the next sync. The latest provider timestamp wins an edit conflict.
- Large syncs use separate pull and push phases plus bounded Google batch requests. The app continues these phases automatically so each EAS Hosting Worker invocation stays within its outbound-request limit.
- **Disconnect & Keep Events** revokes access, removes mappings, and leaves existing copies in place.
- **Disconnect & Remove Synced Copies** also removes Google-origin copies from onTrack and onTrack-origin copies from Google. Originals stay in their original calendar.
- Account deletion cascades through both calendar tables.

The initial import covers the previous year and next two years. Opening the Calendar tab performs a quiet sync at most once every five minutes; **Sync Now** is always available.
