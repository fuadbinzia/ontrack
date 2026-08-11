import { useEffect, type MutableRefObject, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

import { isTravelPlanOnCalendar, travelCalendarDrafts } from '@/features/travel/calendar';
import { validateTravelDateRange } from '@/features/travel/date-range';
import {
  persistTravelCoverPhotos,
  uploadedTripCoverUris,
} from '@/features/travel/destination-cover';
import { currencyFromLocale } from '@/features/travel/expenses/format-money';
import {
  stripTripCoverUploads,
  tripCoverUploadFields,
  validateTravelPlanDetails,
} from '@/features/travel/travel-plan-details';
import type { TravelPlan, TravelPlanMode } from '@/features/travel/types';
import type { TravelDestinationLocation } from '@/features/travel/map/types';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';
import { newId } from '@/utils/id';

type Args = {
  title: string;
  destination: string;
  destinationLocation?: TravelDestinationLocation;
  startDate: string;
  endDate: string;
  notes: string;
  mode: TravelPlanMode;
  dateLocale: string;
  setError: (v: string | undefined) => void;
  setShowForm: (v: boolean) => void;
  setTitle: (v: string) => void;
  setMode: (v: TravelPlanMode) => void;
  setDestination: (v: string) => void;
  setDestinationLocation: (v: TravelDestinationLocation | undefined) => void;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  setNotes: (v: string) => void;
  setPendingCreatedTripId: (v: string | undefined) => void;
  setEditingDetailsPlanId: (v: string | undefined) => void;
  setEditTitle: (v: string) => void;
  setEditDestination: (v: string) => void;
  setEditDestinationLocation: (v: TravelDestinationLocation | undefined) => void;
  setEditNotes: (v: string) => void;
  setEditStartDate: (v: string) => void;
  setEditEndDate: (v: string) => void;
  setEditCoverUris: (v: string[]) => void;
  setDetailsError: (v: string | undefined) => void;
  editTitle: string;
  editDestination: string;
  editDestinationLocation?: TravelDestinationLocation;
  editNotes: string;
  editStartDate: string;
  editEndDate: string;
  editCoverUris: string[];
  editingDetailsPlanId: string | undefined;
  editCover?: string;
  sortedPlans: TravelPlan[];
  savePlan: (plan: TravelPlan) => TravelPlan | undefined | void;
  recordPlanInteraction: (planId: string) => void;
  replaceTravelActivities: (planId: string, drafts: ReturnType<typeof travelCalendarDrafts>) => void;
  activities: any[];
  creatingPlanRef: MutableRefObject<boolean>;
  interactWithPlan: (planId: string) => void;
  editScrollRef: RefObject<ScrollView | null>;
};

export function useTravelHomePlanActions(args: Args) {
  const {
    title,
    destination,
    destinationLocation,
    startDate,
    endDate,
    notes,
    mode,
    dateLocale,
    setError,
    setShowForm,
    setTitle,
    setMode,
    setDestination,
    setDestinationLocation,
    setStartDate,
    setEndDate,
    setNotes,
    setPendingCreatedTripId,
    setEditingDetailsPlanId,
    setEditTitle,
    setEditDestination,
    setEditDestinationLocation,
    setEditNotes,
    setEditStartDate,
    setEditEndDate,
    setEditCoverUris,
    setDetailsError,
    editTitle,
    editDestination,
    editDestinationLocation,
    editNotes,
    editStartDate,
    editEndDate,
    editCoverUris,
    editingDetailsPlanId,
    editCover,
    sortedPlans,
    savePlan,
    recordPlanInteraction,
    replaceTravelActivities,
    activities,
    creatingPlanRef,
    interactWithPlan,
    editScrollRef,
  } = args;

  const createPlan = () => {
    if (creatingPlanRef.current) return;
    setError(undefined);
    const detailsValidation = validateTravelPlanDetails({
      title,
      destination,
      notes,
    });
    if (!detailsValidation.ok) return setError(detailsValidation.error);
    const validation = validateTravelDateRange(startDate, endDate);
    if (validation.error) return setError(validation.error);
    creatingPlanRef.current = true;
    const now = new Date().toISOString();
    const planId = newId('trip');
    const basePlan: TravelPlan = {
      id: planId,
      ...detailsValidation.value,
      ...(destinationLocation ? { destinationLocation } : {}),
      mode,
      startDate,
      endDate,
      itinerary: [],
      participants: [],
      baseCurrency: currencyFromLocale(dateLocale),
      expenses: [],
      createdAt: now,
      updatedAt: now,
    };
    const saved = savePlan(basePlan);
    if (!saved) {
      creatingPlanRef.current = false;
      setError(
        'Couldn’t create this trip. Your details are still here—please try again.',
      );
      return;
    }
    recordPlanInteraction(planId);
    setTitle('');
    setMode('flight');
    setDestination('');
    setDestinationLocation(undefined);
    setStartDate('');
    setEndDate('');
    setNotes('');
    setPendingCreatedTripId(planId);
    setShowForm(false);
    creatingPlanRef.current = false;
  };

  const beginEditingDetails = (plan: TravelPlan) => {
    // Swap to the editor before list reorder so the tap feels instant.
    setEditingDetailsPlanId(plan.id);
    setEditTitle(plan.title);
    setEditDestination(plan.destination);
    setEditDestinationLocation(plan.destinationLocation);
    setEditNotes(plan.notes ?? '');
    setEditStartDate(plan.startDate);
    setEditEndDate(plan.endDate);
    // Durable uploads only — never seed the editor with a live destination URL.
    setEditCoverUris(uploadedTripCoverUris(plan));
    setDetailsError(undefined);
    deferAfterPageTransition(() => interactWithPlan(plan.id));
  };

  const openCoverPickerOnEdit =
    __DEV__ && (editCover === '1' || editCover === 'true');
  useEffect(() => {
    if (!openCoverPickerOnEdit) return;
    const plan = sortedPlans[0];
    if (!plan || editingDetailsPlanId) return;
    beginEditingDetails(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once for DEV deep link
  }, [openCoverPickerOnEdit, sortedPlans, editingDetailsPlanId]);

  const saveEditedDetails = async (plan: TravelPlan) => {
    setDetailsError(undefined);
    const validation = validateTravelPlanDetails({
      title: editTitle,
      destination: editDestination,
      notes: editNotes,
    });
    if (!validation.ok) return setDetailsError(validation.error);
    const dateValidation = validateTravelDateRange(
      editStartDate,
      editEndDate,
      plan.itinerary,
    );
    if (dateValidation.error) return setDetailsError(dateValidation.error);
    let coverUris = editCoverUris
      .map((uri) => uri.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (coverUris.length > 0) {
      try {
        coverUris = await persistTravelCoverPhotos(coverUris, plan.id);
      } catch {
        return setDetailsError('Couldn’t save the cover photo. Try another image.');
      }
    }
    // Omit prior uploads when cleared so the trip card falls back to a live
    // destination photo (or the scenic placeholder when live isn't available).
    const next: TravelPlan = {
      ...stripTripCoverUploads(plan),
      ...validation.value,
      // Explicit undefined clears coordinates when destination copy was typed manually.
      destinationLocation: editDestinationLocation,
      startDate: editStartDate,
      endDate: editEndDate,
      updatedAt: new Date().toISOString(),
      ...tripCoverUploadFields(coverUris),
    };
    const isOnCalendar = isTravelPlanOnCalendar(activities, plan.id);
    savePlan(next);
    if (isOnCalendar) replaceTravelActivities(next.id, travelCalendarDrafts(next));
    setEditingDetailsPlanId(undefined);
  };

  const editingPlan = sortedPlans.find((plan) => plan.id === editingDetailsPlanId);

  useEffect(() => {
    if (!editingDetailsPlanId) return;
    const timer = setTimeout(() => {
      editScrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 500);
    return () => clearTimeout(timer);
  }, [editingDetailsPlanId]);

  const openCreateTrip = () => {
    setError(undefined);
    setShowForm(true);
  };

  const closeCreateTrip = () => {
    setError(undefined);
    setShowForm(false);
  };


  return {
    createPlan,
    beginEditingDetails,
    openCoverPickerOnEdit,
    saveEditedDetails,
    editingPlan,
    openCreateTrip,
    closeCreateTrip,
  };
}
