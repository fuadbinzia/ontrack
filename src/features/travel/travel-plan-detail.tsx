import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

import { EmptyState, Screen } from '@/components/primitives';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useAppIsActive } from '@/hooks/use-app-activity';
import type { StayBookingOpen } from '@/features/travel/booking-open';
import {
  isTravelPlanOnCalendar,
  travelCalendarDrafts,
} from '@/features/travel/calendar';
import { type ExpenseFormState } from '@/features/travel/expenses/expense-form';
import {
  stampOwnedItineraryDefaults,
  visibleItineraryForViewer,
} from '@/features/travel/itinerary-visibility';
import { TravelImportResult } from '@/features/travel/travel-import-result-modal';
import { TravelPlanDetailBody } from '@/features/travel/travel-plan-detail-body';
import { useTravelPlanDetailExpenseImport } from '@/features/travel/travel-plan-detail-expense-import';
import { TravelPlanDetailOverlays } from '@/features/travel/travel-plan-detail-overlays';
import {
  type DetailSectionKey,
  sectionDefaultExpanded,
} from '@/features/travel/travel-plan-detail-sections';
import {
  buildRevealItineraryUiPatch,
  type RevealItineraryTarget,
} from '@/features/travel/travel-reveal-itinerary-item';
import { useTravelPageStyle } from '@/features/travel/travel-surface';
import { expandTimelineEntries } from '@/features/travel/travel-timeline-entries';
import {
  autoCollapsedTimelineDates,
  resolveCollapsedTimelineDates,
  timelineDaysFromItems,
} from '@/features/travel/travel-timeline-progress';
import type {
  TravelItemKind,
  TravelItineraryItem,
  TravelPlan,
} from '@/features/travel/types';
import { useRecoverReservedTravelPlan } from '@/features/travel/use-recover-reserved-travel-plan';
import { useStraiAwayStayPull } from '@/features/travel/use-straiaway-stay-pull';
import { useTravelPlanConfirmationImports } from '@/features/travel/use-travel-plan-confirmation-imports';
import { useTravelPlanDetailAddForm } from '@/features/travel/use-travel-plan-detail-add-form';
import { useTravelPlanDetailAddItem } from '@/features/travel/use-travel-plan-detail-add-item';
import { useTravelPlanDetailEffects } from '@/features/travel/use-travel-plan-detail-effects';
import { buildTravelPlanDetailItemHandlers } from '@/features/travel/use-travel-plan-detail-item-handlers';
import { useTravelPlanItemDetailsEdit } from '@/features/travel/use-travel-plan-item-details-edit';
import { useTravelPlanItemMedia } from '@/features/travel/use-travel-plan-item-media';
import { useTheme } from '@/hooks/use-theme';
import {
  publishTravelTripItinerary,
  shouldSyncTravelItinerary,
} from '@/services/travel/itinerary-collaboration';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useTravel } from '@/store/travel';
import { useTravelPlanUi } from '@/store/travel-plan-ui';
import { AgentUiIds } from '@/utils/agent-ui';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';
import { warmHrefsAfterTransition } from '@/utils/warm-navigation';

type TravelPlanDetailProps = {
  planId: string;
  initialAddKind?: TravelItemKind;
  /** DEV: open the timeline kind chooser after navigating to a trip. */
  initialOpenAddPicker?: boolean;
  /** DEV: open the first trivago stay booking sheet after mount. */
  autoOpenStayBooking?: boolean;
  /** DEV: reservation email override when account email is unavailable. */
  autoOpenReservationEmail?: string;
  /** DEV: open the Expenses sheet on mount for simulator QA. */
  initialOpenExpenses?: boolean;
  /** DEV: open an import-result sheet on mount for simulator QA. */
  initialImportResult?: TravelImportResult;
  /** DEV: prefill Add Flight from a known confirmation fixture (no document picker). */
  initialFlightImportFixture?: 'roundtrip' | 'connecting' | 'jetblue';
};

export function TravelPlanDetail(props: TravelPlanDetailProps) {
  const theme = useTheme();
  const travelStyle = useTravelPageStyle(theme);
  const router = useRouter();
  const planId =
    typeof props.planId === 'string'
      ? props.planId
      : Array.isArray(props.planId)
        ? String(props.planId[0] ?? '')
        : '';
  useRecoverReservedTravelPlan(planId || undefined);
  const plan = useTravel((state) =>
    planId ? state.plans.find((item) => item.id === planId) : undefined,
  );
  useStraiAwayStayPull(plan);
  // One stable tree from first paint: hero/sky Fabric overlay mounts once.
  // Entrance→Loaded swaps remounted ExpoFabricView (LinearGradient) and raced
  // AppContext ("The app context has been lost"). Heavy body waits for settle.
  const isFocused = useIsFocused();
  const appIsActive = useAppIsActive();
  const [transitionSettled, setTransitionSettled] = useState(false);
  useEffect(() => {
    if (!isFocused || transitionSettled) return;
    return deferAfterPageTransition(() => setTransitionSettled(true));
  }, [isFocused, transitionSettled]);

  if (!plan) {
    return (
      <Screen style={travelStyle}>
        <EmptyState
          icon="flight"
          title="Trip Not Found"
          message="This trip may have been removed on another device."
          actionLabel="Back to Travel"
          actionTestID={AgentUiIds.travel.planDetail.backToTravel}
          onAction={() => router.replace('/travel' as never)}
        />
      </Screen>
    );
  }
  return (
    <TravelPlanDetailLoaded
      {...props}
      planId={planId}
      plan={plan}
      bodyReady={transitionSettled}
      active={isFocused && appIsActive}
    />
  );
}

function TravelPlanDetailLoaded({
  planId,
  plan,
  bodyReady,
  active,
  initialAddKind,
  initialOpenAddPicker = false,
  autoOpenStayBooking = false,
  autoOpenReservationEmail,
  initialOpenExpenses = false,
  initialImportResult,
  initialFlightImportFixture,
}: TravelPlanDetailProps & {
  plan: TravelPlan;
  bodyReady: boolean;
  active: boolean;
}) {
  const savePlan = useTravel((state) => state.savePlan);
  const replaceTravelActivities = useSchedule(
    (state) => state.replaceTravelActivities,
  );
  const activities = useSchedule((state) => state.activities);
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const { user } = useAuthSession();
  const accountEmail = user?.email?.trim().toLowerCase() || undefined;
  const localUserId = user?.id;
  const itinerary = Array.isArray(plan.itinerary) ? plan.itinerary : [];

  // Warm the top itinerary destinations after the stack settles (max 3).
  useEffect(() => {
    if (!bodyReady || !active) return;
    return warmHrefsAfterTransition([
      { pathname: '/travel/[id]/tools', params: { id: planId } },
      { pathname: '/travel/[id]/stays', params: { id: planId } },
      { pathname: '/travel/[id]/flights', params: { id: planId } },
    ] as never);
  }, [active, bodyReady, planId]);

  const updatePlan = (next: TravelPlan) => {
    const stamped = stampOwnedItineraryDefaults(next, localUserId);
    const nextItemIds = new Set(stamped.itinerary.map((item) => item.id));
    const deletedItemIds = plan.itinerary
      .map((item) => item.id)
      .filter((id) => !nextItemIds.has(id));
    const saved = savePlan(stamped);
    if (!saved) return;
    // Calendar membership is opt-in from the Travel tab — never auto-create
    // events when editing itinerary, expenses, or notes on plan detail.
    if (isTravelPlanOnCalendar(activities, stamped.id)) {
      replaceTravelActivities(stamped.id, travelCalendarDrafts(stamped));
    }
    if (shouldSyncTravelItinerary(stamped)) {
      void publishTravelTripItinerary(stamped, { deletedItemIds }).catch(
        () => undefined,
      );
    }
  };
  const form = useTravelPlanDetailAddForm({
    plan,
    initialAddKind,
    initialOpenAddPicker,
    accountEmail,
  });
  const [devBookingOpen, setDevBookingOpen] = useState<Extract<
    StayBookingOpen,
    { mode: 'webview' }
  > | null>(null);
  useTravelPlanDetailEffects({
    planId,
    plan,
    form,
    updatePlan,
    accountEmail,
    initialFlightImportFixture,
    autoOpenStayBooking,
    autoOpenReservationEmail,
    setDevBookingOpen,
  });

  const itemEdit = useTravelPlanItemDetailsEdit({
    plan,
    itinerary,
    updatePlan,
  });
  const itemMedia = useTravelPlanItemMedia({
    planId,
    plan,
    itinerary,
    updatePlan,
  });
  const [openExpenseSheet, setOpenExpenseSheet] = useState(initialOpenExpenses);
  const [editingTripDates, setEditingTripDates] = useState(false);
  const [editingTripNotes, setEditingTripNotes] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseFormState>();
  const [preparedExpenseDraft, setPreparedExpenseDraft] =
    useState<ExpenseFormState>();
  const [importResult, setImportResult] = useState<TravelImportResult | null>(
    initialImportResult ?? null,
  );
  const expenseImport = useTravelPlanDetailExpenseImport({
    kind: form.kind,
    preparedExpenseDraft,
    setPreparedExpenseDraft,
    setExpenseDraft,
    setOpenExpenseSheet,
    setImportResult,
  });

  const goToItinerarySafely = () => {
    setOpenExpenseSheet(false);
    setExpenseDraft(undefined);
    setPreparedExpenseDraft(undefined);
    setImportResult(null);
    expenseImport.importResultExpenseRef.current = null;
    form.setIsAddingItem(false);
    form.setIsChoosingAddKind(false);
    itemMedia.clearAddPhotos();
    itemMedia.setRemoveConfirm(null);
    setDevBookingOpen(null);
  };

  const confirmationImports = useTravelPlanConfirmationImports({
    plan,
    updatePlan,
    accountEmail,
    navigation: {
      onOpenExpenseDraft: (_planId, draft) => {
        setExpenseDraft(draft);
        setOpenExpenseSheet(true);
      },
      onPrepareExpenseDraft: (_planId, draft) => setPreparedExpenseDraft(draft),
      onGoToItinerary: goToItinerarySafely,
    },
    addSheet: {
      date: form.date,
      startMinutes: form.startMinutes,
      setTitle: form.setTitle,
      setDetails: form.setDetails,
      setBookingUrl: form.setBookingUrl,
      setDate: form.setDate,
      setStartMinutes: form.setStartMinutes,
      setEndDate: form.setEndDate,
      setEndMinutes: form.setEndMinutes,
      setDuration: form.setDuration,
      setKind: form.setKind,
      setIsAddingItem: form.setIsAddingItem,
      setError: form.setError,
      setFlightDetails: form.setFlightDetails,
      setFlightDetailsError: form.setFlightDetailsError,
      setImportedFlightFileName: form.setImportedFlightFileName,
      setFlightTripType: form.setFlightTripType,
      setReturnFlightTitle: form.setReturnFlightTitle,
      setReturnFlightDetails: form.setReturnFlightDetails,
      setReturnFlightSchedule: form.setReturnFlightSchedule,
      setPendingFlightImport: form.setPendingFlightImport,
      setRentalDetails: form.setRentalDetails,
      setRentalDetailsError: form.setRentalDetailsError,
      setImportedRentalFileName: form.setImportedRentalFileName,
      setStayDetails: form.setStayDetails,
      setStayDetailsError: form.setStayDetailsError,
      setImportedStayFileName: form.setImportedStayFileName,
    },
    edit: {
      setEditingFlightItemId: itemEdit.setEditingFlightItemId,
      setEditedFlightDetails: itemEdit.setEditedFlightDetails,
      setEditedFlightDetailsError: itemEdit.setEditedFlightDetailsError,
      setEditedFlightFileName: itemEdit.setEditedFlightFileName,
      setEditingRentalItemId: itemEdit.setEditingRentalItemId,
      setEditedRentalDetailsError: itemEdit.setEditedRentalDetailsError,
      setEditingStayItemId: itemEdit.setEditingStayItemId,
      setEditedStayDetails: itemEdit.setEditedStayDetails,
      setEditedStayDetailsError: itemEdit.setEditedStayDetailsError,
      setEditedStayFileName: itemEdit.setEditedStayFileName,
    },
  });
  const planUi = useTravelPlanUi((state) => state.byPlanId[planId]);
  const patchPlanUi = useTravelPlanUi((state) => state.patchPlanUi);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetYRef = useRef(0);
  const [pendingFocusEntryKey, setPendingFocusEntryKey] = useState<string>();
  const onScrollOffset = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );
  const clearPendingFocus = useCallback(() => {
    setPendingFocusEntryKey(undefined);
  }, []);
  const sectionExpanded = planUi?.sectionExpanded ?? {};
  const dayCollapseTouched = useMemo(
    () => new Set(planUi?.dayCollapseTouched ?? []),
    [planUi?.dayCollapseTouched],
  );
  const persistedCollapsedDays = useMemo(
    () => new Set(planUi?.collapsedDayDates ?? []),
    [planUi?.collapsedDayDates],
  );
  const [timelineNow, setTimelineNow] = useState(() => new Date());
  const sortedItinerary = useMemo(
    () =>
      visibleItineraryForViewer(itinerary, localUserId).sort(
        (left, right) =>
          left.date.localeCompare(right.date) ||
          left.startMinutes - right.startMinutes,
      ),
    [itinerary, localUserId],
  );
  const timelineDays = useMemo(
    () => timelineDaysFromItems(sortedItinerary),
    [sortedItinerary],
  );
  const collapsedDayDates = useMemo(() => {
    const autoCollapsed = autoCollapsedTimelineDates(timelineDays, timelineNow);
    return resolveCollapsedTimelineDates({
      days: timelineDays,
      autoCollapsed,
      currentCollapsed: persistedCollapsedDays,
      userTouched: dayCollapseTouched,
    });
  }, [timelineDays, timelineNow, persistedCollapsedDays, dayCollapseTouched]);

  useEffect(() => {
    if (!active) return;
    const tick = () => setTimelineNow(new Date());
    const interval = setInterval(tick, 60_000);
    tick();
    return () => clearInterval(interval);
  }, [active]);

  // Keep persisted day collapse in sync with clock-driven auto-collapse for
  // untouched days so remounts don't flash a stale open/closed set.
  useEffect(() => {
    const next = [...collapsedDayDates].sort();
    const current = [...persistedCollapsedDays].sort();
    if (
      next.length === current.length &&
      next.every((date, i) => date === current[i])
    ) {
      return;
    }
    patchPlanUi(planId, { collapsedDayDates: next });
  }, [collapsedDayDates, persistedCollapsedDays, patchPlanUi, planId]);

  const transportCounts = {
    flights: sortedItinerary.filter((item) => item.kind === 'flight').length,
    ground: sortedItinerary.filter((item) => item.kind === 'transport').length,
    stays: sortedItinerary.filter((item) => item.kind === 'stay').length,
    rentals: sortedItinerary.filter((item) => item.kind === 'rental').length,
    events: sortedItinerary.filter((item) => item.kind === 'event').length,
  };
  const isSectionExpanded = (key: DetailSectionKey) =>
    sectionExpanded[key] ?? sectionDefaultExpanded(key, transportCounts);
  const toggleSection = (key: DetailSectionKey) => {
    patchPlanUi(planId, {
      sectionExpanded: {
        ...sectionExpanded,
        [key]: !(
          sectionExpanded[key] ?? sectionDefaultExpanded(key, transportCounts)
        ),
      },
    });
  };
  const defaultCollapsedItemIds = useMemo(
    () =>
      new Set([
        ...itinerary.map((item) => item.id),
        ...expandTimelineEntries(itinerary).map((entry) => entry.key),
      ]),
    [itinerary],
  );
  const revealItineraryItem = useCallback(
    (target: RevealItineraryTarget) => {
      const latest =
        useTravel.getState().plans.find((entry) => entry.id === planId) ?? plan;
      const latestItems = Array.isArray(latest?.itinerary)
        ? latest.itinerary
        : itinerary;
      const { patch, focusEntryKey } = buildRevealItineraryUiPatch({
        target,
        sectionExpanded,
        minimizedItemIds: planUi?.minimizedItemIds,
        defaultMinimizedItemIds: [...defaultCollapsedItemIds],
        collapsedDayDates: [...collapsedDayDates],
        dayCollapseTouched: [...dayCollapseTouched],
        itinerary: latestItems,
        planStartDate: latest.startDate,
        planEndDate: latest.endDate,
      });
      patchPlanUi(planId, patch);
      setPendingFocusEntryKey(focusEntryKey);
    },
    [
      collapsedDayDates,
      dayCollapseTouched,
      defaultCollapsedItemIds,
      itinerary,
      plan,
      planId,
      planUi?.minimizedItemIds,
      patchPlanUi,
      sectionExpanded,
    ],
  );
  const { addItem } = useTravelPlanDetailAddItem({
    planId,
    plan,
    form,
    dateDisplayFormat,
    updatePlan,
    setExpenseDraft,
    setOpenExpenseSheet,
    maybeShowImportedAddPrompt: expenseImport.maybeShowImportedAddPrompt,
    onRevealItem: revealItineraryItem,
  });
  const collapsedItemIds = planUi?.minimizedItemIds
    ? new Set(planUi.minimizedItemIds)
    : defaultCollapsedItemIds;
  const toggleItineraryItem = (itemId: string) => {
    const next = new Set(planUi?.minimizedItemIds ?? defaultCollapsedItemIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    patchPlanUi(planId, { minimizedItemIds: [...next] });
  };
  const toggleDay = (date: string) => {
    const nextTouched = new Set(dayCollapseTouched);
    nextTouched.add(date);
    const nextCollapsed = new Set(collapsedDayDates);
    if (nextCollapsed.has(date)) nextCollapsed.delete(date);
    else nextCollapsed.add(date);
    patchPlanUi(planId, {
      dayCollapseTouched: [...nextTouched],
      collapsedDayDates: [...nextCollapsed],
    });
  };
  const notesExpanded = planUi?.notesExpanded ?? false;
  const setNotesExpanded = (expanded: boolean) => {
    patchPlanUi(planId, { notesExpanded: expanded });
  };
  // Hero dates/Notes sit over sky — densify only while a flight card is open
  // so airy frost stays the default when nothing is stacked under them.
  const denseHeroGlass = sortedItinerary.some(
    (item) => item.kind === 'flight' && !collapsedItemIds.has(item.id),
  );
  const openTimelineSection = () =>
    patchPlanUi(planId, {
      sectionExpanded: { ...sectionExpanded, timeline: true },
    });
  const itemEditHandlers = buildTravelPlanDetailItemHandlers({
    planId,
    plan,
    minimizedItemIds: collapsedItemIds,
    dateDisplayFormat,
    itemEdit,
    itemMedia,
    confirmationImports,
    onToggle: toggleItineraryItem,
    updatePlan,
    setExpenseDraft,
    setOpenExpenseSheet,
    onBeginItemEdit: (item: TravelItineraryItem) =>
      form.beginEditingItem(item, openTimelineSection),
  });
  const chooseAddKind = (kind: TravelItemKind) =>
    form.chooseAddKind(kind, openTimelineSection);
  const cancelAddToTimeline = () =>
    form.cancelAddToTimeline(confirmationImports.importInProgressRef, () =>
      setPreparedExpenseDraft(undefined),
    );

  return (
    <View style={styles.root}>
      <TravelPlanDetailBody
        plan={plan}
        sortedItinerary={sortedItinerary}
        itemEditHandlers={itemEditHandlers}
        collapsedDayDates={collapsedDayDates}
        isSectionExpanded={isSectionExpanded}
        toggleSection={toggleSection}
        onToggleDay={toggleDay}
        onAddPress={() => form.setIsChoosingAddKind(true)}
        onAddKind={chooseAddKind}
        onEditDates={() => setEditingTripDates(true)}
        onEditNotes={() => setEditingTripNotes(true)}
        notesExpanded={notesExpanded}
        onNotesExpandedChange={setNotesExpanded}
        denseHeroGlass={denseHeroGlass}
        bodyReady={bodyReady}
        scrollRef={scrollRef}
        onScroll={onScrollOffset}
        pendingFocusEntryKey={pendingFocusEntryKey}
        onFocusEntryHandled={clearPendingFocus}
        scrollOffsetYRef={scrollOffsetYRef}
      />
      {bodyReady ? (
        <TravelPlanDetailOverlays
          plan={plan}
          itinerary={itinerary}
          form={form}
          confirmationImports={confirmationImports}
          itemMedia={itemMedia}
          editingTripDates={editingTripDates}
          setEditingTripDates={setEditingTripDates}
          editingTripNotes={editingTripNotes}
          setEditingTripNotes={setEditingTripNotes}
          openExpenseSheet={openExpenseSheet}
          setOpenExpenseSheet={setOpenExpenseSheet}
          expenseDraft={expenseDraft}
          setExpenseDraft={setExpenseDraft}
          importResult={importResult}
          setImportResult={setImportResult}
          importResultExpenseRef={expenseImport.importResultExpenseRef}
          devBookingOpen={devBookingOpen}
          setDevBookingOpen={setDevBookingOpen}
          updatePlan={updatePlan}
          chooseAddKind={chooseAddKind}
          cancelAddToTimeline={cancelAddToTimeline}
          addItem={addItem}
          goToItinerarySafely={goToItinerarySafely}
          openImportedExpenseReview={expenseImport.openImportedExpenseReview}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
