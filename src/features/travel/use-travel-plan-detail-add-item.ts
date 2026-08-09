import { useRef } from 'react';

import { applyImportedFlightsToPlan } from '@/features/travel/apply-imported-flights';
import { mergeDuplicateItemConfirmationUris } from '@/features/travel/confirmation-uri-attach';
import { emptyExpenseForm, type ExpenseFormState } from '@/features/travel/expenses/expense-form';
import { calculateFlightDuration } from '@/features/travel/flight-arrival';
import { isConnectingSegmentGroup } from '@/features/travel/flight-confirmation-itinerary';
import {
    emptyFlightDetailsDraft,
    validateFlightDetails,
} from '@/features/travel/flight-details';
import {
    segmentsFromDirectionForm,
    segmentsFromRoundTripForm,
} from '@/features/travel/flight-roundtrip-draft';
import { isDuplicateItineraryItem } from '@/features/travel/normalize';
import { emptyRentalDetailsDraft, validateRentalDetails } from '@/features/travel/rental-details';
import { validateStayDetails } from '@/features/travel/stay-details';
import {
    emptyTransportDetailsDraft,
    validateTransportDetails,
} from '@/features/travel/transport-details';
import { persistTravelMomentPhotos } from '@/features/travel/travel-moment-media';
import type { TravelItineraryItem, TravelPlan } from '@/features/travel/types';
import type { TravelPlanDetailAddForm } from '@/features/travel/use-travel-plan-detail-add-form';
import { newId } from '@/store/schedule';
import { useTravel } from '@/store/travel';
import { createIdFromAgentUiItemIds } from '@/utils/agent-ui/fixtures';
import { addDays, formatDateKey, minutesBetween } from '@/utils/date';
import { isHttpsUrl } from '@/utils/safe-url';

export function validBookingUrl(value: string): boolean {
  return !value || isHttpsUrl(value);
}

type AddItemOptions = {
  planId: string;
  plan: TravelPlan;
  form: TravelPlanDetailAddForm;
  dateDisplayFormat: Parameters<typeof formatDateKey>[1];
  updatePlan: (plan: TravelPlan) => void;
  setExpenseDraft: (draft: ExpenseFormState | undefined) => void;
  setOpenExpenseSheet: (open: boolean) => void;
  maybeShowImportedAddPrompt: (
    plan: TravelPlan,
    duplicateItinerary: boolean,
  ) => void;
};

export function useTravelPlanDetailAddItem({
  planId,
  plan,
  form,
  dateDisplayFormat,
  updatePlan,
  setExpenseDraft,
  setOpenExpenseSheet,
  maybeShowImportedAddPrompt,
}: AddItemOptions) {
  const addItemInProgressRef = useRef(false);
  const stopAddItem = () => {
    addItemInProgressRef.current = false;
  };
  const addItemError = (message: string) => {
    stopAddItem();
    form.setError(message);
  };
  const clearCompletedForm = (resetTransport: boolean) => {
    form.setTitle('');
    form.setDetails('');
    form.setBookingUrl('');
    form.setPhotoUris([]);
    form.setFlightDetails(emptyFlightDetailsDraft());
    form.setImportedFlightFileName(undefined);
    form.setPendingFlightImport(undefined);
    if (resetTransport) {
      form.setTransportDetails(
        emptyTransportDetailsDraft({
          origin: plan.origin,
          destination: plan.destination,
        arrivalDate: plan.startDate,
          arrivalMinutes: 12 * 60,
        currency: plan.baseCurrency,
        }),
      );
    }
    form.setRentalDetails(emptyRentalDetailsDraft());
    form.setImportedRentalFileName(undefined);
    form.setStayDetails(
      form.defaultStayDetails({
        checkoutDate: plan.endDate,
        checkoutMinutes: String(11 * 60),
      }),
    );
    form.setImportedStayFileName(undefined);
    form.setEditingItemId(undefined);
    form.setIsAddingItem(false);
    stopAddItem();
  };

  const addItem = () => {
    if (addItemInProgressRef.current) return;
    addItemInProgressRef.current = true;
    form.setError(undefined);
    form.setFlightDetailsError(undefined);
    form.setTransportDetailsError(undefined);
    form.setRentalDetailsError(undefined);
    form.setStayDetailsError(undefined);
    const isMoment = form.kind === 'moment';
    const usesRange =
      form.kind === 'stay' || form.kind === 'flight' || form.kind === 'rental';
    if (!isMoment && !form.title.trim()) {
      return addItemError('Add a name for this itinerary item.');
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(form.date) ||
      (form.kind !== 'flight' &&
        (form.date < plan.startDate || form.date > plan.endDate))
    ) {
      return addItemError(
        form.kind === 'flight'
          ? 'Choose a valid departure date.'
          : `Choose a date between ${formatDateKey(plan.startDate, dateDisplayFormat)} and ${formatDateKey(plan.endDate, dateDisplayFormat)}.`,
      );
    }
    if (
      form.startMinutes === null ||
      form.startMinutes < 0 ||
      form.startMinutes >= 24 * 60
    ) {
      return addItemError(
        form.kind === 'stay'
          ? 'Choose a check-in time.'
          : form.kind === 'rental'
            ? 'Choose a pick-up time.'
            : form.kind === 'flight'
              ? 'Choose a departure time.'
              : 'Choose a valid start time.',
      );
    }

    let durationMinutes = isMoment ? 15 : Number(form.duration);
    if (usesRange) {
      const maxEndDate =
        form.kind === 'stay' ? addDays(plan.endDate, 1) : plan.endDate;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(form.endDate) ||
        (form.kind !== 'flight' &&
          (form.endDate < plan.startDate || form.endDate > maxEndDate))
      ) {
        return addItemError(
          form.kind === 'flight'
            ? 'Choose a valid arrival date.'
            : `Choose an end date between ${formatDateKey(plan.startDate, dateDisplayFormat)} and ${formatDateKey(maxEndDate, dateDisplayFormat)}.`,
        );
      }
      if (
        form.endMinutes === null ||
        form.endMinutes < 0 ||
        form.endMinutes >= 24 * 60
      ) {
        return addItemError(
          form.kind === 'stay'
            ? 'Choose a check-out time.'
            : form.kind === 'rental'
              ? 'Choose a drop-off time.'
              : form.kind === 'flight'
                ? 'Choose an arrival time.'
                : 'Choose a valid end time.',
        );
      }
      const span =
        form.kind === 'flight'
          ? calculateFlightDuration({
              departureDate: form.date,
              departureMinutes: form.startMinutes,
              arrivalDate: form.endDate,
              arrivalMinutes: form.endMinutes,
              departureAirport: form.flightDetails.departureAirport,
              arrivalAirport: form.flightDetails.arrivalAirport,
            })
          : minutesBetween(
              form.date,
              form.startMinutes,
              form.endDate,
              form.endMinutes,
            );
      if (!Number.isFinite(span) || span <= 0) {
        return addItemError(
          form.kind === 'flight'
            ? 'Arrival must be after departure.'
            : form.kind === 'rental'
              ? 'Drop-off must be after pick-up.'
              : 'Check-out must be after check-in.',
        );
      }
      durationMinutes = form.kind === 'flight' ? span : 60;
      if (form.kind === 'flight' && span > 3 * 24 * 60) {
        return addItemError('Flight duration looks too long. Check the arrival time.');
      }
    } else if (form.kind === 'activity') {
      if (
        form.endMinutes === null ||
        form.endMinutes < 0 ||
        form.endMinutes >= 24 * 60
      ) {
        return addItemError('Choose an end time.');
      }
      const span = form.endMinutes - form.startMinutes;
      if (!Number.isFinite(span) || span <= 0) {
        return addItemError('End time must be after start time.');
      }
      if (span > 1440) {
        return addItemError('Duration must be between 1 and 1,440 minutes.');
      }
      durationMinutes = span;
    } else if (
      !isMoment &&
      form.kind !== 'transport' &&
      (!Number.isFinite(durationMinutes) ||
        durationMinutes <= 0 ||
        durationMinutes > 1440)
    ) {
      return addItemError('Duration must be between 1 and 1,440 minutes.');
    }
    if (!isMoment && !validBookingUrl(form.bookingUrl.trim())) {
      return addItemError('Booking links must use a complete HTTPS address.');
    }

    const validatedFlightDetails =
      form.kind === 'flight'
        ? validateFlightDetails(form.flightDetails)
        : ({ ok: true, value: undefined } as const);
    if (!validatedFlightDetails.ok) {
      stopAddItem();
      return form.setFlightDetailsError(validatedFlightDetails.error);
    }
    const validatedTransportDetails =
      form.kind === 'transport'
        ? validateTransportDetails({
            draft: form.transportDetails,
            departureDate: form.date,
            departureMinutes: form.startMinutes,
            planStartDate: plan.startDate,
            planEndDate: plan.endDate,
          })
        : ({ ok: true, value: undefined } as const);
    if (!validatedTransportDetails.ok) {
      stopAddItem();
      return form.setTransportDetailsError(validatedTransportDetails.error);
    }
    if (validatedTransportDetails.value) {
      durationMinutes = minutesBetween(
        form.date,
        form.startMinutes,
        validatedTransportDetails.value.arrivalDate,
        validatedTransportDetails.value.arrivalMinutes,
      );
    }
    const validatedRentalDetails =
      form.kind === 'rental'
        ? validateRentalDetails({
            ...form.rentalDetails,
            dropoffDate: form.endDate,
            dropoffMinutes: String(form.endMinutes),
          })
        : ({ ok: true, value: undefined } as const);
    if (!validatedRentalDetails.ok) {
      stopAddItem();
      return form.setRentalDetailsError(validatedRentalDetails.error);
    }
    const validatedStayDetails =
      form.kind === 'stay'
        ? validateStayDetails({
            ...form.stayDetails,
            checkoutDate: form.endDate,
            checkoutMinutes: String(form.endMinutes),
          })
        : ({ ok: true, value: undefined } as const);
    if (!validatedStayDetails.ok) {
      stopAddItem();
      return form.setStayDetailsError(validatedStayDetails.error);
    }

    if (form.kind === 'flight' && form.flightTripType === 'round-trip') {
      if (!form.returnFlightTitle.trim()) {
        stopAddItem();
        return form.setFlightDetailsError('Add a name for the returning flight.');
      }
      const validatedReturnDetails = validateFlightDetails(
        form.returnFlightDetails,
      );
      if (!validatedReturnDetails.ok) {
        stopAddItem();
        return form.setFlightDetailsError(validatedReturnDetails.error);
      }
      const roundTripSegments = segmentsFromRoundTripForm({
        outboundDetails: form.flightDetails,
        outboundSchedule: {
          date: form.date,
          startMinutes: form.startMinutes,
          endDate: form.endDate,
          endMinutes: form.endMinutes,
        },
        outboundTitle: form.title,
        returnDetails: form.returnFlightDetails,
        returnSchedule: form.returnFlightSchedule,
        returnTitle: form.returnFlightTitle,
      });
      if (!roundTripSegments) {
        stopAddItem();
        return form.setFlightDetailsError(
          'Add return departure and arrival dates and times.',
        );
      }
      const currentPlan = useTravel.getState().plans.find((entry) => entry.id === planId);
      if (!currentPlan) {
        stopAddItem();
        return;
      }
      const confirmationUris =
        validatedFlightDetails.value?.confirmationUris?.length
          ? validatedFlightDetails.value.confirmationUris
          : form.pendingFlightImport?.confirmationUris;
      const nextPlan = applyImportedFlightsToPlan({
        plan: currentPlan,
        imported: {
          ...(form.pendingFlightImport ?? {
            ...roundTripSegments[0]!,
            segments: roundTripSegments,
            detectedFieldCount: 1,
          }),
          segments: roundTripSegments,
          confirmationUris,
        },
        createId: createIdFromAgentUiItemIds(
          form.pendingFlightImport?.agentUiItemIds,
          () => newId('trip-item'),
        ),
      });
      updatePlan(nextPlan);
      form.resetAddForm();
      form.setIsAddingItem(false);
      stopAddItem();
      maybeShowImportedAddPrompt(nextPlan, false);
      return;
    }

    const connectingImport =
      form.kind === 'flight' &&
      form.pendingFlightImport &&
      isConnectingSegmentGroup(form.pendingFlightImport.segments)
        ? form.pendingFlightImport
        : undefined;
    if (connectingImport) {
      const currentPlan = useTravel.getState().plans.find((entry) => entry.id === planId);
      if (!currentPlan) {
        stopAddItem();
        return;
      }
      const editedSegments = segmentsFromDirectionForm(
        form.flightDetails,
        {
          date: form.date,
          startMinutes: form.startMinutes,
          endDate: form.endDate,
          endMinutes: form.endMinutes,
        },
        { preferred: form.title, fallback: 'Flight' },
      );
      const confirmationUris =
        validatedFlightDetails.value?.confirmationUris?.length
          ? validatedFlightDetails.value.confirmationUris
          : connectingImport.confirmationUris;
      const nextPlan = applyImportedFlightsToPlan({
        plan: currentPlan,
        imported: {
          ...connectingImport,
          segments: editedSegments ?? connectingImport.segments,
          confirmationUris,
        },
        createId: createIdFromAgentUiItemIds(
          connectingImport.agentUiItemIds,
          () => newId('trip-item'),
        ),
      });
      updatePlan(nextPlan);
      form.resetAddForm();
      form.setIsAddingItem(false);
      stopAddItem();
      maybeShowImportedAddPrompt(nextPlan, false);
      return;
    }

    const editingItemId = form.editingItemId;
    const editingSimpleStop =
      Boolean(editingItemId) &&
      (form.kind === 'moment' || form.kind === 'activity');
    const itemId = editingSimpleStop ? editingItemId! : newId('trip-item');
    const now = new Date().toISOString();
    const flightConfirmationUris =
      validatedFlightDetails.value?.confirmationUris?.length
        ? validatedFlightDetails.value.confirmationUris
        : form.pendingFlightImport?.confirmationUris;
    const incomingItem: TravelItineraryItem = {
      id: itemId,
      kind: form.kind,
      title: form.title.trim() || (isMoment ? 'Moment' : form.title.trim()),
      date: form.date,
      startMinutes: form.startMinutes,
      durationMinutes: Math.round(durationMinutes),
      details: form.details.trim() || undefined,
      bookingUrl: isMoment ? undefined : form.bookingUrl.trim() || undefined,
      photoUris: form.photoUris.length ? form.photoUris : undefined,
      flight:
        form.kind === 'flight' && validatedFlightDetails.value
          ? {
              ...validatedFlightDetails.value,
              ...(flightConfirmationUris?.length
                ? { confirmationUris: flightConfirmationUris }
                : {}),
            }
          : validatedFlightDetails.value,
      transport: validatedTransportDetails.value,
      rental: validatedRentalDetails.value,
      stay: validatedStayDetails.value,
    };

    void (async () => {
      const before = useTravel.getState().plans.find((entry) => entry.id === planId);
      if (!before) {
        stopAddItem();
        return;
      }
      const beforeItems = Array.isArray(before.itinerary) ? before.itinerary : [];
      if (editingSimpleStop) {
        const existing = beforeItems.find((entry) => entry.id === itemId);
        if (!existing || (existing.kind !== 'moment' && existing.kind !== 'activity')) {
          return addItemError('This stop can no longer be edited.');
        }
        const persistedPhotos = form.photoUris.length
          ? await persistTravelMomentPhotos(form.photoUris, itemId)
          : undefined;
        const latest =
          useTravel.getState().plans.find((entry) => entry.id === planId) ?? before;
        const latestItems = Array.isArray(latest.itinerary)
          ? latest.itinerary
          : beforeItems;
        const nextPlan = {
          ...latest,
          itinerary: latestItems.map((entry) =>
            entry.id === itemId
              ? {
                  ...entry,
                  kind: form.kind,
                  title: incomingItem.title,
                  date: incomingItem.date,
                  startMinutes: incomingItem.startMinutes,
                  durationMinutes: incomingItem.durationMinutes,
                  details: incomingItem.details,
                  bookingUrl: incomingItem.bookingUrl,
                  photoUris: persistedPhotos,
                  sharedUpdatedAt: now,
                }
              : entry,
          ),
          updatedAt: now,
        };
        updatePlan(nextPlan);
        clearCompletedForm(true);
        return;
      }
      if (beforeItems.some((existing) => isDuplicateItineraryItem(existing, incomingItem))) {
        const merged = mergeDuplicateItemConfirmationUris(before, incomingItem);
        if (merged) updatePlan(merged);
        clearCompletedForm(false);
        maybeShowImportedAddPrompt(merged ?? before, false);
        return;
      }
      const persistedPhotos = form.photoUris.length
        ? await persistTravelMomentPhotos(form.photoUris, itemId)
        : undefined;
      const latest =
        useTravel.getState().plans.find((entry) => entry.id === planId) ?? before;
      const latestItems = Array.isArray(latest.itinerary)
        ? latest.itinerary
        : beforeItems;
      if (latestItems.some((existing) => isDuplicateItineraryItem(existing, incomingItem))) {
        const merged = mergeDuplicateItemConfirmationUris(latest, incomingItem);
        if (merged) updatePlan(merged);
        clearCompletedForm(false);
        maybeShowImportedAddPrompt(merged ?? latest, false);
        return;
      }
      const nextPlan = {
        ...latest,
        itinerary: [
          ...latestItems,
          { ...incomingItem, photoUris: persistedPhotos },
        ],
        updatedAt: now,
      };
      updatePlan(nextPlan);
      const transportFare = incomingItem.transport?.fare;
      const transportCurrency = incomingItem.transport?.currency;
      if (transportFare && transportCurrency) {
        setExpenseDraft({
          ...emptyExpenseForm(latest, transportCurrency),
          title: incomingItem.title,
          amountText: String(transportFare),
          currency: transportCurrency,
          date: incomingItem.date,
          category: 'transport',
          travelItemId: incomingItem.id,
        });
        setOpenExpenseSheet(true);
      }
      clearCompletedForm(true);
      maybeShowImportedAddPrompt(latest, false);
    })().catch((caught: unknown) => {
      if (__DEV__) console.warn('[addTravelItineraryItem]', caught);
      stopAddItem();
      form.setError(
        'Couldn’t save this itinerary item. Check its photos and try again.',
      );
    });
  };

  return { addItem, addItemInProgressRef };
}
