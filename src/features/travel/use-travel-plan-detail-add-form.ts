import { useCallback, useRef, useState } from 'react';

import type { ImportedFlightConfirmation } from '@/features/travel/flight-confirmation-import';
import {
  emptyFlightDetailsDraft,
  type FlightDetailsDraft,
} from '@/features/travel/flight-details';
import {
  emptyFlightLegScheduleDraft,
  suggestReturnDraftFromOutbound,
  returnFlightTitle as suggestReturnFlightTitle,
  type FlightTripType,
} from '@/features/travel/flight-roundtrip-draft';
import {
  emptyRentalDetailsDraft,
  type RentalDetailsDraft,
} from '@/features/travel/rental-details';
import {
  emptyStayDetailsDraft,
  type StayDetailsDraft,
} from '@/features/travel/stay-details';
import {
  emptyTransportDetailsDraft,
  type TransportDetailsDraft,
} from '@/features/travel/transport-details';
import type {
  TravelItemKind,
  TravelItineraryItem,
  TravelPlan,
} from '@/features/travel/types';

type UseTravelPlanDetailAddFormOptions = {
  plan: TravelPlan;
  initialAddKind?: TravelItemKind;
  initialOpenAddPicker?: boolean;
  accountEmail?: string;
};

/** Same-day end minute for activity edit (clamped before midnight). */
export function activityEndMinutesFromItem(item: TravelItineraryItem): number {
  return Math.min(
    item.startMinutes + Math.max(1, item.durationMinutes),
    24 * 60 - 1,
  );
}

export function useTravelPlanDetailAddForm({
  plan,
  initialAddKind,
  initialOpenAddPicker = false,
  accountEmail,
}: UseTravelPlanDetailAddFormOptions) {
  const startsWithEmptySchedule = initialAddKind === 'stay' || initialAddKind === 'flight';
  const defaultStayDetails = useCallback(
    (overrides?: Parameters<typeof emptyStayDetailsDraft>[0]) =>
      emptyStayDetailsDraft({
        reservationEmail: accountEmail ?? '',
        ...overrides,
      }),
    [accountEmail],
  );
  const defaultTransportDetails = useCallback(
    () =>
      emptyTransportDetailsDraft({
        origin: plan.origin,
        destination: plan.destination,
        arrivalDate: plan.startDate,
        arrivalMinutes: 12 * 60,
        currency: plan.baseCurrency,
      }),
    [plan.baseCurrency, plan.destination, plan.origin, plan.startDate],
  );

  const [kind, setKind] = useState<TravelItemKind>(initialAddKind ?? 'activity');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() =>
    startsWithEmptySchedule ? '' : plan.startDate,
  );
  const [startMinutes, setStartMinutes] = useState<number | null>(() =>
    startsWithEmptySchedule ? null : 9 * 60,
  );
  const [endDate, setEndDate] = useState(() =>
    startsWithEmptySchedule ? '' : plan.endDate || plan.startDate,
  );
  const [endMinutes, setEndMinutes] = useState<number | null>(() =>
    startsWithEmptySchedule ? null : 10 * 60,
  );
  const [duration, setDuration] = useState('60');
  const [details, setDetails] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [flightDetails, setFlightDetails] = useState<FlightDetailsDraft>(
    emptyFlightDetailsDraft,
  );
  const [flightDetailsError, setFlightDetailsError] = useState<string>();
  const [flightTripType, setFlightTripType] = useState<FlightTripType>('one-way');
  const [returnFlightTitle, setReturnFlightTitle] = useState('');
  const [returnFlightDetails, setReturnFlightDetails] = useState<FlightDetailsDraft>(
    emptyFlightDetailsDraft,
  );
  const [returnFlightSchedule, setReturnFlightSchedule] = useState(
    emptyFlightLegScheduleDraft,
  );
  const [importedFlightFileName, setImportedFlightFileName] = useState<string>();
  const [pendingFlightImport, setPendingFlightImport] =
    useState<ImportedFlightConfirmation>();
  const [transportDetails, setTransportDetails] =
    useState<TransportDetailsDraft>(defaultTransportDetails);
  const [transportDetailsError, setTransportDetailsError] = useState<string>();
  const [rentalDetails, setRentalDetails] =
    useState<RentalDetailsDraft>(emptyRentalDetailsDraft);
  const [rentalDetailsError, setRentalDetailsError] = useState<string>();
  const [importedRentalFileName, setImportedRentalFileName] = useState<string>();
  const [stayDetails, setStayDetails] = useState<StayDetailsDraft>(() =>
    emptyStayDetailsDraft({ reservationEmail: '' }),
  );
  const [stayDetailsError, setStayDetailsError] = useState<string>();
  const [importedStayFileName, setImportedStayFileName] = useState<string>();
  const [error, setError] = useState<string>();
  const [isAddingItem, setIsAddingItem] = useState(Boolean(initialAddKind));
  const [isChoosingAddKind, setIsChoosingAddKind] = useState(initialOpenAddPicker);
  /** When set, the add sheet saves over this itinerary item (moment/activity). */
  const [editingItemId, setEditingItemId] = useState<string>();
  const appliedFlightImportFixture = useRef(false);

  const resetAddForm = useCallback(() => {
    setTitle('');
    setDetails('');
    setBookingUrl('');
    setPhotoUris([]);
    setDuration('60');
    setStartMinutes(9 * 60);
    setDate(plan.startDate);
    setEndDate(plan.endDate);
    setEndMinutes(10 * 60);
    setFlightDetails(emptyFlightDetailsDraft());
    setFlightTripType('one-way');
    setReturnFlightTitle('');
    setReturnFlightDetails(emptyFlightDetailsDraft());
    setReturnFlightSchedule(emptyFlightLegScheduleDraft());
    appliedFlightImportFixture.current = false;
    setImportedFlightFileName(undefined);
    setPendingFlightImport(undefined);
    setFlightDetailsError(undefined);
    setTransportDetails(defaultTransportDetails());
    setTransportDetailsError(undefined);
    setRentalDetails(emptyRentalDetailsDraft());
    setImportedRentalFileName(undefined);
    setRentalDetailsError(undefined);
    setStayDetails(defaultStayDetails());
    setImportedStayFileName(undefined);
    setStayDetailsError(undefined);
    setError(undefined);
    setEditingItemId(undefined);
  }, [defaultStayDetails, defaultTransportDetails, plan.endDate, plan.startDate]);

  const prepareAddKind = useCallback(
    (nextKind: TravelItemKind) => {
      resetAddForm();
      setKind(nextKind);
      if (nextKind === 'stay' || nextKind === 'flight') {
        setDate('');
        setStartMinutes(null);
        setEndDate('');
        setEndMinutes(null);
      } else if (nextKind === 'rental') {
        setDate(plan.startDate);
        setStartMinutes(9 * 60);
        setEndDate(plan.endDate);
        setEndMinutes(10 * 60);
      } else if (nextKind === 'transport') {
        setDate(plan.startDate);
        setStartMinutes(9 * 60);
        setTransportDetails(defaultTransportDetails());
      } else {
        setDate(plan.startDate);
        setStartMinutes(9 * 60);
        setEndMinutes(10 * 60);
      }
    },
    [defaultTransportDetails, plan.endDate, plan.startDate, resetAddForm],
  );

  const chooseAddKind = useCallback(
    (nextKind: TravelItemKind, onOpenTimeline?: () => void) => {
      setIsChoosingAddKind(false);
      prepareAddKind(nextKind);
      onOpenTimeline?.();
      setIsAddingItem(true);
    },
    [prepareAddKind],
  );

  const beginEditingItem = useCallback(
    (item: TravelItineraryItem, onOpenTimeline?: () => void) => {
      if (item.kind !== 'moment' && item.kind !== 'activity') return;
      resetAddForm();
      setEditingItemId(item.id);
      setKind(item.kind);
      setTitle(item.title);
      setDate(item.date);
      setStartMinutes(item.startMinutes);
      setEndDate(item.date);
      setEndMinutes(
        item.kind === 'activity'
          ? activityEndMinutesFromItem(item)
          : Math.min(item.startMinutes + 60, 24 * 60 - 1),
      );
      setDuration(String(Math.max(1, item.durationMinutes)));
      setDetails(item.details ?? '');
      setBookingUrl(item.bookingUrl ?? '');
      setPhotoUris(item.photoUris ?? []);
      setIsChoosingAddKind(false);
      onOpenTimeline?.();
      setIsAddingItem(true);
    },
    [resetAddForm],
  );

  const cancelAddToTimeline = useCallback(
    (
      importInProgressRef: { current: boolean },
      clearPreparedExpenseDraft: () => void,
    ) => {
      if (importInProgressRef.current) return;
      setIsAddingItem(false);
      clearPreparedExpenseDraft();
      resetAddForm();
    },
    [resetAddForm],
  );

  const handleFlightTripTypeChange = useCallback(
    (next: FlightTripType) => {
      setFlightTripType(next);
      if (next !== 'round-trip') return;
      const returnEmpty =
        !returnFlightDetails.flightNumber.trim() &&
        !returnFlightSchedule.date &&
        !returnFlightDetails.departureAirport.trim();
      if (!returnEmpty) return;
      const suggested = suggestReturnDraftFromOutbound(flightDetails, {
        date,
        startMinutes,
        endDate,
        endMinutes,
      });
      setReturnFlightDetails(suggested.details);
      setReturnFlightSchedule(suggested.schedule);
      setReturnFlightTitle(suggestReturnFlightTitle(suggested.details));
    },
    [
      date,
      endDate,
      endMinutes,
      flightDetails,
      returnFlightDetails.departureAirport,
      returnFlightDetails.flightNumber,
      returnFlightSchedule.date,
      startMinutes,
    ],
  );

  return {
    kind,
    setKind,
    title,
    setTitle,
    date,
    setDate,
    startMinutes,
    setStartMinutes,
    endDate,
    setEndDate,
    endMinutes,
    setEndMinutes,
    duration,
    setDuration,
    details,
    setDetails,
    bookingUrl,
    setBookingUrl,
    photoUris,
    setPhotoUris,
    flightDetails,
    setFlightDetails,
    flightDetailsError,
    setFlightDetailsError,
    flightTripType,
    setFlightTripType,
    returnFlightTitle,
    setReturnFlightTitle,
    returnFlightDetails,
    setReturnFlightDetails,
    returnFlightSchedule,
    setReturnFlightSchedule,
    importedFlightFileName,
    setImportedFlightFileName,
    pendingFlightImport,
    setPendingFlightImport,
    transportDetails,
    setTransportDetails,
    transportDetailsError,
    setTransportDetailsError,
    rentalDetails,
    setRentalDetails,
    rentalDetailsError,
    setRentalDetailsError,
    importedRentalFileName,
    setImportedRentalFileName,
    stayDetails,
    setStayDetails,
    stayDetailsError,
    setStayDetailsError,
    importedStayFileName,
    setImportedStayFileName,
    error,
    setError,
    isAddingItem,
    setIsAddingItem,
    isChoosingAddKind,
    setIsChoosingAddKind,
    editingItemId,
    setEditingItemId,
    appliedFlightImportFixture,
    defaultStayDetails,
    resetAddForm,
    prepareAddKind,
    chooseAddKind,
    beginEditingItem,
    cancelAddToTimeline,
    handleFlightTripTypeChange,
  };
}

export type TravelPlanDetailAddForm = ReturnType<typeof useTravelPlanDetailAddForm>;
