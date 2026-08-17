# Data processors

**Status:** DRAFT — REQUIRES LEGAL REVIEW  
**As of:** 17 August 2026  
Inventory from `src/services/http/api-usage-catalog.ts`, `app.json` plugins, and Supabase migrations. **DPA/BAA existence is REQUIRES EXTERNAL CONFIGURATION** — this repo does not store vendor contracts.

| Processor | Role | Evidence | DPA/BAA |
|---|---|---|---|
| Supabase (Auth, DB, Storage, Edge) | Account, sync, chat, RLS | `src/services/cloud/`, `supabase/` | REQUIRES EXTERNAL CONFIGURATION |
| Expo / EAS Hosting + Updates | API host, OTA | `eas.json`, `src/app/api/` | REQUIRES EXTERNAL CONFIGURATION |
| Apple | Sign in with Apple, HealthKit, Push, App Store | `auth`, `apple-health.ts`, `app.json` | Platform terms |
| Google | Sign in, Drive backup, Calendar sync, location (coarse) | `google-drive-*`, `google-calendar-*`, `expo-location` | REQUIRES EXTERNAL CONFIGURATION |
| OpenAI | Meals, recipes, plants, travel translator, finance coach, E-ZPass OCR, mood suggestions | `vision-transport.ts`, feature `*-server.ts` | REQUIRES EXTERNAL CONFIGURATION |
| Google Gemini | Optional AI failover (catalog `gemini`) | `api-usage-catalog.ts` | REQUIRES EXTERNAL CONFIGURATION |
| Ollama | Optional local/dev model | catalog | NOT APPLICABLE in production if unset |
| Plaid | Read-only bank link | `src/services/finance/plaid-*.ts` | REQUIRES EXTERNAL CONFIGURATION |
| Teller | Read-only bank link | `teller-*.ts`, `202608140001_teller_server_vault.sql` | REQUIRES EXTERNAL CONFIGURATION |
| Resend | Transactional email | privacy policy + catalog | REQUIRES EXTERNAL CONFIGURATION |
| USDA FoodData | Nutrient lookup | catalog | Public dataset |
| TMDB | Movie metadata | `src/services/movies/` | Attribution required |
| TheSportsDB / ESPN path | Events | catalog / event-discovery | Public / provider terms |
| Ticketmaster | Event search | catalog | REQUIRES EXTERNAL CONFIGURATION |
| Amadeus | Flight/stay search | catalog | REQUIRES EXTERNAL CONFIGURATION |
| AeroDataBox | Flight status | catalog | REQUIRES EXTERNAL CONFIGURATION |
| Open-Meteo / weather client | Today weather | weather services | Public API terms |
| Map / geocoding provider used by location fields | Place suggest | profile location | REQUIRES MANUAL TESTING of which host is live |
| StraiAway | Partner stay handoff | `docs/partner-straiaway.md` | Partner terms |
| Siri / Google Assistant (voice lists) | On-device + OS assistant | `modules/ontrack-voice-lists` | Platform terms |

No advertising, attribution, or ATT SDKs were found in `package.json` / `app.json` — TECHNICALLY VERIFIED absence of those packages. That is not a legal “no tracking” claim.
