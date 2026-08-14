# Teller bank sync

onTrack uses Teller for bank and credit-card balances/transactions. Plaid is
restricted to investment holdings. Teller access tokens are encrypted in the
server-only Supabase vault and all real-data API calls pass through a dedicated
Cloudflare Worker because Teller requires outbound mTLS.

## Teller dashboard

1. Create a Teller application and download its client certificate/private key.
2. Copy the application ID and Token Signing Key.
3. Start with `development` for real-data testing (up to 100 lifetime enrollments)
   or `sandbox` for simulated data. Production requires Teller KYB approval.
4. The Connect flow requests only `transactions` and `balance` with explicit
   multiple-account selection.

## Cloudflare gateway

From `cloudflare/teller-gateway`:

1. Create the replay KV namespace and replace its ID in `wrangler.jsonc`.
2. Upload the Teller certificate and key:
   `npx wrangler mtls-certificate upload --cert cert.pem --key private_key.pem --name ontrack-teller`
3. Replace the certificate ID in `wrangler.jsonc`.
4. Store `TELLER_GATEWAY_SHARED_SECRET` with `npx wrangler secret put`.
5. Deploy with `npx wrangler deploy` and copy the `/teller` URL into EAS Hosting.

For Teller Sandbox only, set `TELLER_USE_MTLS` to `false`. Never commit the PEM
certificate, private key, signing key, shared secret, or an enrollment token.

## EAS Hosting

Create these as **sensitive** variables in the selected Hosting environment:

- `TELLER_APPLICATION_ID`
- `TELLER_ENVIRONMENT`
- `TELLER_SIGNING_KEY`
- `TELLER_TOKEN_ENCRYPTION_KEY`
- `TELLER_GATEWAY_URL`
- `TELLER_GATEWAY_SHARED_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Apply `202608140001_teller_server_vault.sql`, then rebuild and deploy the API
routes so the environment is embedded in the immutable Hosting deployment:

```bash
npx eas-cli@latest env:exec production 'npx expo export -p web' --non-interactive
npx eas-cli@latest deploy --prod --environment production --non-interactive
```

The first sync paginates through all available Teller history. Later syncs
refresh a ten-day overlap so pending-to-posted changes are reconciled safely.
