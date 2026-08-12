# Partner bridge: onTrack ↔ StraiAway

Keep the apps separate. Link accounts once, then exchange a narrow **StayPackage** over HTTPS. Deep links only open the other app.

## Link flow

1. onTrack `POST /api/partner/straiaway/connect` (user Bearer + PKCE `codeChallenge`) returns `straiaway://partner/connect?code=…`.
2. StraiAway user approves. StraiAway `POST /api/partner/ontrack/approve` then calls onTrack `POST /api/partner/straiaway/exchange` with `X-Partner-Secret`, `code`, and `partnerUserId`.
3. onTrack stores `partner_links` and returns inbound/outbound refresh tokens (server-side only after that).
4. StraiAway opens `ontrack://partner/straiaway?connected=1` (Universal Link: `https://ontrack--links.expo.app/p/straiaway`).

Scopes: `identity.link`, `stay.read`, `stay.write`. Connect codes are SHA-256 hashed, single-use, 10 minute TTL.

## StayPackage

Versioned JSON. Source of truth by field:

| Owner | Not synced |
|---|---|
| onTrack | itinerary, flights, expenses, chat |
| StraiAway | host ops, rooms, issues, add-ons |

Synced: property name/address, check-in/out (`YYYY-MM-DD` + optional minutes), confirmation code, guest display name, booking URL, notes, `ontrackPlanId` / `ontrackItemId` / `straiawayPropertyId` / `straiawayReservationId`.

Conflict: last-write-wins on `updatedAt` per linked pair.

## Env

onTrack: `PARTNER_STRAIAWAY_SECRET`, `PARTNER_TOKEN_ENCRYPTION_KEY` (falls back to calendar/service-role key), `STRAIAWAY_PARTNER_API_BASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

StraiAway: `ONTRACK_PARTNER_SECRET` (same value as `PARTNER_STRAIAWAY_SECRET`), `ONTRACK_PARTNER_EXCHANGE_URL` (default `https://ontrack.expo.app/api/partner/straiaway/exchange`).
