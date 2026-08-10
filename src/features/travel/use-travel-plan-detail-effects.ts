import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { resolveStayBookingOpen, type StayBookingOpen } from '@/features/travel/booking-open';
import { travelCalendarDrafts } from '@/features/travel/calendar';
import {
    attachOrphanedFlightConfirmationUris,
} from '@/features/travel/confirmation-uri-attach';
import { CHASE_ROUNDTRIP_CONFIRMATION } from '@/features/travel/fixtures/chase-roundtrip-confirmation';
import { JETBLUE_TRIP_DETAIL_ROUNDTRIP } from '@/features/travel/fixtures/jetblue-trip-detail-roundtrip';
import { UNITED_CONNECTING_CONFIRMATION } from '@/features/travel/fixtures/united-connecting-confirmation';
import { mergeFlightConfirmationDraftDetails } from '@/features/travel/flight-confirmation-draft';
import type { ImportedFlightConfirmation } from '@/features/travel/flight-confirmation-import';
import { splitRoundTripDirections } from '@/features/travel/flight-confirmation-itinerary';
import { parseFlightConfirmation } from '@/features/travel/flight-confirmation-parser';
import {
    flightConfirmationSchedule,
    flightDirectionSchedule,
} from '@/features/travel/flight-confirmation-schedule';
import { emptyFlightDetailsDraft } from '@/features/travel/flight-details';
import {
    flightLegScheduleFromImported,
    returnFlightTitle as suggestReturnFlightTitle,
} from '@/features/travel/flight-roundtrip-draft';
import { formatFlightTitle } from '@/features/travel/flight-route-label';
import {
    applyFlightTerminalPatches,
    fetchFlightTerminalPatches,
} from '@/features/travel/flight-terminal-enrichment';
import { normalizeTravelPlan } from '@/features/travel/normalize';
import type { TravelPlan } from '@/features/travel/types';
import { upgradeLegacyConnectingFlights } from '@/features/travel/upgrade-legacy-connecting-flights';
import type { TravelPlanDetailAddForm } from '@/features/travel/use-travel-plan-detail-add-form';
import { newId, useSchedule } from '@/store/schedule';
import { useTravel } from '@/store/travel';
import {
    AGENT_UI_DEMO_CHASE_OUTBOUND_ID,
    AGENT_UI_DEMO_CHASE_RETURN_ID,
    AGENT_UI_PUNTA_CANA_OUTBOUND_ID,
    AGENT_UI_PUNTA_CANA_RETURN_ID,
} from '@/utils/agent-ui/fixtures';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';

type FlightImportFixture = 'roundtrip' | 'connecting' | 'jetblue';

type DetailEffectsOptions = {
  planId: string;
  plan: TravelPlan;
  form: TravelPlanDetailAddForm;
  updatePlan: (plan: TravelPlan) => void;
  accountEmail?: string;
  initialFlightImportFixture?: FlightImportFixture;
  autoOpenStayBooking?: boolean;
  autoOpenReservationEmail?: string;
  setDevBookingOpen: (
    target: Extract<StayBookingOpen, { mode: 'webview' }> | null,
  ) => void;
};

export function useTravelPlanDetailEffects({
  planId,
  plan,
  form,
  updatePlan,
  accountEmail,
  initialFlightImportFixture,
  autoOpenStayBooking = false,
  autoOpenReservationEmail,
  setDevBookingOpen,
}: DetailEffectsOptions) {
  useFocusEffect(
    useCallback(() => {
      // Normalize + orphan repair can stringify large plans — wait until the
      // stack push has settled so the itinerary transition stays fluid.
      return deferAfterPageTransition(() => {
        const current = useTravel.getState().plans.find((item) => item.id === planId);
        const normalized = normalizeTravelPlan(current);
        let working = current;
        if (
          current &&
          normalized &&
          JSON.stringify(normalized) !== JSON.stringify(current)
        ) {
          working = { ...normalized, updatedAt: new Date().toISOString() };
          useTravel.getState().savePlan(working);
          const schedule = useSchedule.getState();
          if (
            schedule.activities.some(
              (activity) => activity.travelPlanId === working!.id,
            )
          ) {
            schedule.replaceTravelActivities(
              working.id,
              travelCalendarDrafts(working),
            );
          }
        }
        // Always attempt orphan re-link after normalize — sync pull can strip
        // confirmation URIs (https → dropped) before this remints ontrack-media.
        if (working) {
          const repaired = attachOrphanedFlightConfirmationUris(working, {
            allPlans: useTravel.getState().plans,
          });
          if (repaired) useTravel.getState().savePlan(repaired);
        }
      });
    }, [planId]),
  );

  useEffect(() => {
    if (
      !__DEV__ ||
      (initialFlightImportFixture !== 'roundtrip' &&
        initialFlightImportFixture !== 'connecting' &&
        initialFlightImportFixture !== 'jetblue')
    ) {
      return;
    }
    if (
      form.kind !== 'flight' ||
      !form.isAddingItem ||
      form.appliedFlightImportFixture.current
    ) {
      return;
    }
    form.appliedFlightImportFixture.current = true;
    const year = new Date().getFullYear();
    const fixtureSource =
      initialFlightImportFixture === 'connecting'
        ? {
            text: UNITED_CONNECTING_CONFIRMATION,
            tripRange: { startDate: '2026-09-27', endDate: '2026-09-27' },
            fileName: 'united-gua-iah-lga-confirmation.png',
            agentUiItemIds: undefined as string[] | undefined,
          }
        : initialFlightImportFixture === 'jetblue'
          ? {
              text: JETBLUE_TRIP_DETAIL_ROUNDTRIP,
              tripRange: {
                startDate: `${year}-08-10`,
                endDate: `${year}-08-14`,
              },
              fileName: 'jetblue-trip-detail-jfk-sdq.png',
              agentUiItemIds: [
                AGENT_UI_PUNTA_CANA_OUTBOUND_ID,
                AGENT_UI_PUNTA_CANA_RETURN_ID,
              ],
            }
          : {
              text: CHASE_ROUNDTRIP_CONFIRMATION,
              tripRange: { startDate: '2026-09-08', endDate: '2026-09-14' },
              fileName: 'JORDAN LEE has shared their trip details with you.pdf',
              agentUiItemIds: [
                AGENT_UI_DEMO_CHASE_OUTBOUND_ID,
                AGENT_UI_DEMO_CHASE_RETURN_ID,
              ],
            };
    const parsed = parseFlightConfirmation(
      fixtureSource.text,
      fixtureSource.tripRange,
    );
    const imported: ImportedFlightConfirmation = {
      ...parsed,
      fileName: fixtureSource.fileName,
      confirmationUris: [],
      ...(fixtureSource.agentUiItemIds
        ? { agentUiItemIds: fixtureSource.agentUiItemIds }
        : {}),
    };
    const directions = splitRoundTripDirections(imported.segments);
    const outboundSegments = directions?.outbound ?? imported.segments;
    const schedule = directions
      ? flightDirectionSchedule(directions.outbound, imported)
      : flightConfirmationSchedule(imported);
    form.setPendingFlightImport(imported);
    const outboundDetails = mergeFlightConfirmationDraftDetails(
      emptyFlightDetailsDraft(),
      {
        ...imported,
        segments: outboundSegments,
      },
    );
    form.setFlightDetails((current) =>
      mergeFlightConfirmationDraftDetails(current, {
        ...imported,
        segments: outboundSegments,
      }),
    );
    form.setImportedFlightFileName(imported.fileName);
    form.setFlightTripType(directions ? 'round-trip' : 'one-way');
    if (directions) {
      const returnDetails = mergeFlightConfirmationDraftDetails(
        emptyFlightDetailsDraft(),
        { ...imported, segments: directions.returning },
      );
      form.setReturnFlightDetails(returnDetails);
      form.setReturnFlightSchedule(
        flightLegScheduleFromImported(
          flightDirectionSchedule(directions.returning, imported),
        ),
      );
      form.setReturnFlightTitle(
        formatFlightTitle(returnDetails) ||
          directions.returning[0]?.title?.trim() ||
          suggestReturnFlightTitle(returnDetails),
      );
    }
    form.setTitle(
      formatFlightTitle(outboundDetails) ||
        imported.title ||
        outboundSegments[0]?.title ||
        '',
    );
    if (schedule.departureDate) form.setDate(schedule.departureDate);
    if (schedule.departureMinutes !== undefined) {
      form.setStartMinutes(schedule.departureMinutes);
    }
    if (schedule.durationMinutes !== undefined) {
      form.setDuration(String(schedule.durationMinutes));
    }
    if (schedule.arrivalDate) form.setEndDate(schedule.arrivalDate);
    if (schedule.arrivalMinutes !== undefined) {
      form.setEndMinutes(schedule.arrivalMinutes);
    }
  }, [form, initialFlightImportFixture]);

  useEffect(() => {
    if (!__DEV__) return;
    const tryOpenFromUrl = (url: string | null) => {
      if (!url || !/[?&]openStayBooking=(1|true)\b/.test(url)) return;
      const emailMatch = url.match(/[?&]reservationEmail=([^&]+)/i);
      const overrideEmail = emailMatch
        ? decodeURIComponent(emailMatch[1].replace(/\+/g, ' '))
        : undefined;
      const stayItem = plan.itinerary.find((item) => item.kind === 'stay');
      if (!stayItem) return;
      const resolved = resolveStayBookingOpen(stayItem, {
        fallbackEmail: overrideEmail || autoOpenReservationEmail || accountEmail,
      });
      if (resolved?.mode === 'webview') setDevBookingOpen(resolved);
    };
    void Linking.getInitialURL().then(tryOpenFromUrl);
    const sub = Linking.addEventListener('url', ({ url }) => tryOpenFromUrl(url));
    if (autoOpenStayBooking) {
      tryOpenFromUrl(
        `ontrack://travel/${planId}?openStayBooking=1${
          autoOpenReservationEmail
            ? `&reservationEmail=${encodeURIComponent(autoOpenReservationEmail)}`
            : ''
        }`,
      );
    }
    return () => sub.remove();
  }, [
    accountEmail,
    autoOpenReservationEmail,
    autoOpenStayBooking,
    plan,
    planId,
    setDevBookingOpen,
  ]);

  const terminalLookupFingerprintRef = useRef<string | undefined>(undefined);
  const terminalLookupFingerprint = plan.itinerary
    .filter((item) => item.kind === 'flight' && item.flight)
    .map((item) => {
      const flight = item.flight!;
      const legs = flight.legs?.length
        ? flight.legs
            .map((leg) =>
              [
                leg.flightNumber,
                leg.date,
                leg.departureTerminal,
                leg.arrivalTerminal,
              ].join(':'),
            )
            .join(',')
        : [
            flight.flightNumber,
            item.date,
            flight.departureTerminal,
            flight.arrivalTerminal,
          ].join(':');
      return `${item.id}:${legs}`;
    })
    .join('|');

  useEffect(() => {
    // Dev / agent-ui exercises reopen demo trips constantly — skip the
    // AeroDataBox terminal probe so local testing cannot burn RapidAPI quota.
    if (__DEV__) return;
    if (
      !terminalLookupFingerprint ||
      terminalLookupFingerprintRef.current === terminalLookupFingerprint
    ) {
      return;
    }
    terminalLookupFingerprintRef.current = terminalLookupFingerprint;
    let cancelled = false;
    void fetchFlightTerminalPatches(plan).then((patches) => {
      if (cancelled || !Object.keys(patches).length) return;
      const latest = useTravel.getState().plans.find((entry) => entry.id === plan.id);
      if (!latest) return;
      const next = applyFlightTerminalPatches(latest, patches);
      if (next) updatePlan(next);
    });
    return () => {
      cancelled = true;
    };
    // The fingerprint changes only when lookup-relevant fields change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, terminalLookupFingerprint]);

  const legacyFingerprint = plan.itinerary
    .map((item) =>
      item.kind === 'flight'
        ? `${item.id}:${item.flight?.legs?.length ?? 0}:${item.durationMinutes}:${item.flight?.connectionArrivalMinutes ?? ''}`
        : item.id,
    )
    .join('|');
  useEffect(() => {
    const upgraded = upgradeLegacyConnectingFlights(plan, () => newId('trip-item'));
    if (upgraded) updatePlan(upgraded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, legacyFingerprint]);
}
