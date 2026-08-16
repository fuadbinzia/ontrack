# Google Drive backup

User-owned backups are available from **Profile → Backup**.

- **Download Backup** writes a JSON file and opens the system share sheet (Files, AirDrop, or another app).
- **Save to Google Drive** is optional and signed-in only. onTrack creates an `onTrack Backups` folder and stores backup files the app created (`drive.file` scope only). If a backup is already there, the app asks whether to overwrite that copy or save a new one.
- **Restore** replaces onTrack data on this device from a downloaded file or a Drive backup this app saved.

The JSON includes cloud-synced domains plus device-only journal, Health/mood, food, E-ZPass statement files, travel map, tab pins, avatar and appearance customizations, and packed photos, videos, voice notes, and other attachments.

## Deployment configuration

1. Enable the **Google Drive API** in the same Google Cloud project as Calendar.
2. Add this authorized redirect URI on the existing Web application OAuth client:
   `https://ontrack.expo.app/api/backup/google/callback`
3. Add the `https://www.googleapis.com/auth/drive.file` scope to the OAuth consent screen.
4. Reuse the Calendar server-only variables, plus:
   - `GOOGLE_DRIVE_REDIRECT_URI` (the exact authorized HTTPS callback URI)

Native development calls the hosted API rather than the local Metro API runtime, same as Calendar (`EXPO_PUBLIC_CALENDAR_API_BASE_URL`).

Never prefix Drive/Calendar OAuth secrets with `EXPO_PUBLIC_` or bundle them into a native build.

For EAS Hosting, production deploys must explicitly select the environment:

```bash
npx eas-cli@latest env:exec production 'npx expo export -p web' --non-interactive
npx eas-cli@latest deploy --prod --environment production --non-interactive
```

Drive refresh credentials are encrypted in the server-only `google_drive_connections` table. Disconnecting revokes access and leaves existing backup files in the user’s Drive. Account deletion cascades through that table.
