# Travel module map

Paths are under `src/features/travel/` unless noted.

## Plan chrome

- Travel Home (tab launcher) — `travel.tsx` + `travel-home-your-trips.tsx` (search/dismiss/cards) + `travel-home-*.tsx`; tokens in `travel-home-tokens.ts`; design kit at `design/travel/`
- Home atmosphere — `use-travel-home-atmosphere-image.ts`, `travel-home-atmosphere-resolve|queries|catalog|ink|text`
- Header sky — `travel-sky-condition.ts`, `travel-sky-day.tsx`, `travel-sky-night.tsx`, `travel-header-sky-decor.tsx`
- `travel-new-trip-card.tsx` — new-trip form UI; creation orchestration stays in the travel tab
- `travel-plan-detail.tsx` — plan glue (<500); hooks/panels: `use-travel-plan-detail-add-form|add-item|effects|item-handlers`, `travel-plan-detail-body|overlays|sections|expense-import`
- `travel-atmosphere.tsx`, `travel-atmosphere-model.ts` — Travel-only destination/weather/time background
- `travel-trip-action-grid.tsx` — canonical grouped actions on each trip card
- `travel-plan-hero.tsx`, `travel-trip-dates-row.tsx`, `travel-trip-cover.tsx`
- `travel-plan-cover-field.tsx`, `travel-plan-actions.tsx`
- `travel-kind-chrome.ts`, `travel-collapsible-section.tsx`
- `travel-calendar-updated-modal.tsx`, `travel-add-photos-modal.tsx`
- `travel-import-result-modal.tsx` — shared flight/stay/rental import and expense-save result sheet
- `travel-remove-confirm-modal.tsx`, `travel-dialog-chrome.tsx`
- `travel-moment-media` (media helpers colocated as needed)

## Sheets / dialogs

- `travel-sheet.tsx` — **canonical** frame/header for every travel sheet
- `travel-itinerary-add-sheet.tsx`, `travel-itinerary-sheet-chrome.ts`, `travel-itinerary-sheet-fields.tsx`
- `travel-item-notes-sheet.tsx`, `booking-open-sheet.tsx`, `booking-open.ts`
- `confirmation-import-banner` / `confirmation-import-action.tsx` / `confirmation-import-options.ts`

## Itinerary / timeline

- `travel-itinerary-form.tsx`, `travel-itinerary-form-schedule-fields.tsx`, `travel-itinerary-stay-fields.tsx` — form orchestration and extracted schedule/stay panels
- `travel-itinerary-timeline.tsx` + `travel-timeline-day-chrome.tsx` (day spine / header)
- `travel-timeline-node.tsx`, `travel-timeline-node-chrome.tsx`, `travel-timeline-add-modal.tsx`
- `itinerary-visibility.ts` — ownership, share modes, secret strip/preserve, stamp helpers
- `travel-itinerary-share-sheet.tsx` — who-can-see-this UI
- `src/services/travel/itinerary-collaboration.ts` — publish/pull/merge RPC
- `src/services/travel/travel-collaboration-shared.ts` — auth / trip-id / sync gate shared with expenses
- `travel-transport-sections.tsx`
- `travel-range-fields.tsx`, `travel-range-schedule.ts`
- `travel-hour-label.ts`, `calendar.ts`
- `transport-details.ts`, `transport-details-editor.tsx`, `transport-details-summary.tsx` — driving, scheduled transit, rideshare/taxi, route stops, fares, and Maps links
- `travel-mode.ts`, `travel-mode-picker.tsx` — trip and transport mode taxonomy/chrome

## Flights

- `flight-details.ts`, `flight-details-editor.tsx`, `flight-details-card-editor` (if present)
- `flight-schedule.ts`, `flight-confirmation-schedule.ts`
- `flight-confirmation-*`, `flight-confirmation-itinerary.ts` — local parser plus privacy-redacted AI fallback
- `apply-imported-flights`, `flight-expense-from-import`
- `src/services/travel/flight-confirmation-*` — Gemini transport, validation, outbound redaction, and encrypted local parser memory
- `src/app/travel-confirmations/parse+api.ts` — guarded server-only free-tier parser route
- `flights/` — client, normalize, location-resolver, departure-location, types, server tests

## Stays

- `stays/stay-provider-screen.tsx`, `stays/stay-provider-logo.tsx`
- `stays/stay-provider-logo-lookup.ts`, `stays/provider.ts`, `stays/hostelworld-city.ts`
- `stay-details.ts`, `stay-details-editor.tsx`, `stay-details-card-editor`, `stay-details-summary.tsx`
- `stay-confirmation-import`, `stay-confirmation-parser.ts`
- `stay-expense-from-import.ts`
- `address-autofind-field.tsx`, `address-lookup.ts`

## Rentals

- `rental-details.ts`, `rental-details-summary.tsx`, `rental-details-card-editor`
- `rental-confirmation-*`, `apply-imported-rental.ts`

## Expenses / currency

- `expenses/travel-expenses-sheet.tsx`, `expenses/expense-form.tsx`, `expenses/expense-math.ts`
- `expenses/fx-rates.ts`, `expenses/fx-providers.ts` — swap feed via `ACTIVE_FX_PROVIDER`
- `expenses/currency-dropdown.tsx`
- `travel-currency-sheet.tsx`, `travel-currency-side-card.tsx`
- `travel-currency-rate-panel.tsx`, `travel-currency-chrome`
- `currency-for-destination.ts`
- `src/services/travel/expense-collaboration.ts` — shared trip expenses (`isTravelMemberPlan` from `trip-roster`)

## Destination covers

- `destination-cover.ts`, `destination-cover-lookup.ts`
- `src/app/api/destination-cover+api.ts` — Wikipedia/Commons photos

## People / join / chat

- `travel-friends-sheet.tsx`, `trip-people.tsx`, `trip-friend-row.tsx`, `trip-roster.ts`
- `travel-friends-join-panels.tsx` — open join / requests / pending invite panels
- `travel-friends-roster-model.ts` — host/roster/visible-participant pure helpers
- `travel-join-link-display.ts` — pretty join URL display helpers
- `use-travel-friends-sheet-sync.ts` — sheet open sync/poll
- `use-travel-friends-sheet-actions.ts` — invite, roster role, host transfer, leave, and open-join actions
- `travel-cotraveler-stack.tsx`
- `open-join-landing.tsx`, `open-join-plan.ts`, `invite-landing.tsx`
- `travel-chat-screen`, `travel-chat-chrome.tsx`, `chat.ts`
- Join route: open join `/j/{code}` + host approval

## Plan detail hooks

- `use-travel-plan-confirmation-imports.ts` — flight/rental/stay confirmation OCR import
- `use-travel-plan-item-details-edit.ts` — inline details edit
- `use-travel-plan-item-media.ts` — photos / notes / remove confirm
- `use-travel-plan-detail-add-form.ts`, `use-travel-plan-detail-add-item.ts`, `use-travel-plan-detail-effects.ts`

## Share / invites

- `share.ts` — thin barrel re-export
- `travel-invite-codec.ts`, `travel-invite-api.ts`, `travel-open-join-api.ts`

## Weather

- `weather/travel-weather-sheet.tsx`, `weather/provider.ts`

## Misc UI

- `travel-details-summary-card.tsx`
- `travel-item-note-colors.ts`
