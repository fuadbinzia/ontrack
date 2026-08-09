# SSO release setup

onTrack authenticates through Supabase with Google and Apple. The app contains no email/password sign-in or sign-up controls. Existing Supabase sessions remain valid on the device until the user signs out.

**See also:** [Guest account data](./systems/guest-account-data.md) — what happens when a guest signs in with local plans (merge / discard / keep / start fresh).

## Supabase

1. Enable Google and Apple under **Authentication → Providers**.
2. Add every supported redirect URL under **Authentication → URL Configuration**:
   - `ontrack://auth/callback`
   - the deployed HTTPS origin followed by `/auth/callback`
   - each approved local or preview web origin followed by `/auth/callback`
3. Keep automatic identity linking enabled. Supabase may link verified identities with the same email; onTrack does not request manual identity linking.
4. Keep the current `app_state` RLS policies in place. Authentication uses the existing `auth.users`, `app_state`, entitlements, media, and sync infrastructure; no migration is required.

## Google

1. Create a Google Cloud **Web application** OAuth client.
2. In Google Cloud, add the Supabase project callback URL shown on the Supabase Google provider page.
3. Add the client ID and client secret to the Supabase Google provider configuration.
4. Configure the OAuth consent screen and its required policy links before release.

The Google secret belongs in Google/Supabase configuration. Never put it in an `EXPO_PUBLIC_*` variable.

## Apple

1. Enable **Sign in with Apple** for App ID `com.imtihoss.ontracknow`.
2. Create and configure a Services ID for Android/web browser authentication.
3. Associate the deployed web domain and the Supabase Apple return URL with that Services ID.
4. Configure Supabase with both the native bundle identifier and web Services ID as Apple client IDs.
5. Create an Apple Sign in with Apple key and store its `.p8`, key ID, and team ID only in Apple/Supabase server-side configuration.

`expo-apple-authentication`, its config plugin, and `ios.usesAppleSignIn` are enabled. A new native iOS build is required for the entitlement; an OTA update cannot add it.

Apple OAuth secrets used by browser flows expire every six months. Add a recurring operational reminder to rotate the secret before expiry and verify Android/web Apple sign-in after rotation.

## Environment and release gates

The app expects:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Only the Supabase project URL and publishable/anon key are public client values. Google secrets and Apple signing material must never be exposed through Expo public variables.

Before release:

- Record the final deployed HTTPS web origin and add its callback to Supabase and both provider consoles.
- Publish privacy-policy and terms URLs (`https://ontrack.expo.app/privacy` and `https://ontrack.expo.app/terms`). Add those URLs to App Store Connect, Google OAuth consent, and Apple Services ID configuration.
- Validate native Apple authentication on a physical iPhone development or TestFlight build.
- Validate Google and Apple browser authentication on Android and deployed HTTPS web.
- Confirm signed-in Profile shows **Delete Account** and that `delete_own_account` is applied in Supabase.
- Run production iOS and Android configuration builds after provider-console setup.
