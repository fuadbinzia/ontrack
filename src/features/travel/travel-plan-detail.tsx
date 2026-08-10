import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { EmptyState, Screen } from '@/components/primitives';
import { useAuthSession } from '@/features/auth/auth-provider';
import type { StayBookingOpen } from '@/features/travel/booking-open';
import {
    isTravelPlanOnCalendar,
    travelCalendarDrafts,
} from '@/features/travel/calendar';
import {
    type ExpenseFormState,
} from '@/features/travel/expenses/expense-form';
import {
    stampOwnedItineraryDefaults,
    visibleItineraryForViewer,
} from '@/features/travel/itinerary-visibility';
import { useTravelAtmosphere } from '@/features/travel/travel-atmosphere';
import {
    TRAVEL_HEADER_DATES_SKY_OVERLAP,
    TRAVEL_HEADER_DATES_TOP_GAP,
    TRAVEL_HEADER_SKY_CONTENT_BAND,
    TRAVEL_HEADER_SKY_FADE_TAIL,
    travelPlanSkyPageWashStyle,
} from '@/features/travel/travel-header-sky-height';
import {
    TravelImportResult,
} from '@/features/travel/travel-import-result-modal';
import { TravelPlanDetailBody } from '@/features/travel/travel-plan-detail-body';
import {
    useTravelPlanDetailExpenseImport,
} from '@/features/travel/travel-plan-detail-expense-import';
import { TravelPlanDetailOverlays } from '@/features/travel/travel-plan-detail-overlays';
import {
    type DetailSectionKey,
    sectionDefaultExpanded,
} from '@/features/travel/travel-plan-detail-sections';
import { TravelPlanHero } from '@/features/travel/travel-plan-hero';
import { resolveHeaderSkyWashTop } from '@/features/travel/travel-sky-condition';
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
import { useTravelPlanConfirmationImports } from '@/features/travel/use-travel-plan-confirmation-imports';
import { useTravelPlanDetailAddForm } from '@/features/travel/use-travel-plan-detail-add-form';
import { useTravelPlanDetailAddItem } from '@/features/travel/use-travel-plan-detail-add-item';
import { useTravelPlanDetailEffects } from '@/features/travel/use-travel-plan-detail-effects';
import { buildTravelPlanDetailItemHandlers } from '@/features/travel/use-travel-plan-detail-item-handlers';
import { useTravelPlanItemDetailsEdit } from '@/features/travel/use-travel-plan-item-details-edit';
import { useTravelPlanItemMedia } from '@/features/travel/use-travel-plan-item-media';
import { useResponsive } from '@/hooks/use-responsive';
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
  // Light hero shell paints with the push (and during router.prefetch). Heavy
  // itinerary waits until the screen is focused *and* the stack settle so
  // preloaded routes don't mount timeline/sky/overlays off-screen.
  const isFocused = useIsFocused();
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
  if (!transitionSettled) {
    return <TravelPlanDetailEntrance plan={plan} />;
  }
  return <TravelPlanDetailLoaded {...props} planId={planId} plan={plan} />;
}

/** First-paint shell during stack push — solid sky + hero only. */
function TravelPlanDetailEntrance({ plan }: { plan: TravelPlan }) {
  const theme = useTheme();
  const atmosphere = useTravelAtmosphere();
  const travelStyle = useTravelPageStyle(theme);
  const { s, spacing: rs } = useResponsive();
  const skyContentBand = Math.max(TRAVEL_HEADER_SKY_CONTENT_BAND, s(152));
  const skyFadeTail = Math.max(TRAVEL_HEADER_SKY_FADE_TAIL, s(40));
  const datesTopGap = Math.max(rs.sm, s(TRAVEL_HEADER_DATES_TOP_GAP));
  const datesSkyOverlap = Math.max(0, s(TRAVEL_HEADER_DATES_SKY_OVERLAP));
  const skyDestination =
    plan.destination.trim() || atmosphere.destination || '';
  const washTop = resolveHeaderSkyWashTop({
    themeDark: theme.name === 'dark',
    timeOfDay: atmosphere.timeOfDay,
    weatherCode: atmosphere.weatherCode,
    timezone: atmosphere.timezone,
    destination: skyDestination,
    latitude: atmosphere.latitude,
  });
  const paper =
    typeof travelStyle.backgroundColor === 'string'
      ? travelStyle.backgroundColor
      : theme.backgroundPrimary;
  const planUi = useTravelPlanUi((state) => state.byPlanId[plan.id]);
  const notesExpanded = planUi?.notesExpanded ?? false;

  return (
    <View style={styles.root}>
      <View style={styles.fill}>
        <View
          pointerEvents="none"
          style={travelPlanSkyPageWashStyle({
            skyContentBand,
            washTop,
            paper,
            fadeTail: skyFadeTail,
            washOffset: Math.max(0, datesTopGap - datesSkyOverlap),
          })}
        />
        <Screen
          style={styles.transparentScreen}
          contentStyle={{ gap: Math.max(rs.md, s(20)), paddingTop: 0 }}
          refresh={false}>
          <TravelPlanHero
            plan={plan}
            // Paint sky/destination still during push — solid chrome alone
            // reads as an empty wash (esp. warm Android day / Guatemala).
            notesExpanded={notesExpanded}
          />
        </Screen>
      </View>
    </View>
  );
}

function TravelPlanDetailLoaded({
  planId,
  plan,
  initialAddKind,
  initialOpenAddPicker = false,
  autoOpenStayBooking = false,
  autoOpenReservationEmail,
  initialOpenExpenses = false,
  initialImportResult,
  initialFlightImportFixture,
}: TravelPlanDetailProps & { plan: TravelPlan }) {
  const theme = useTheme();
  const travelStyle = useTravelPageStyle(theme);
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

  // Warm trip-tool routes after the itinerary settles (staggered, max 3).
  useEffect(() => {
    return warmHrefsAfterTransition([
      { pathname: '/travel/[id]/stays', params: { id: planId } },
      { pathname: '/travel/[id]/flights', params: { id: planId } },
      { pathname: '/travel/[id]/chat', params: { id: planId } },
    ] as never);
  }, [planId]);

  const updatePlan = (next: TravelPlan) => {
    const stamped = stampOwnedItineraryDefaults(next, localUserId);
    const saved = savePlan(stamped);
    if (!saved) return;
    // Calendar membership is opt-in from the Travel tab — never auto-create
    // events when editing itinerary, expenses, or notes on plan detail.
    if (isTravelPlanOnCalendar(activities, stamped.id)) {
      replaceTravelActivities(stamped.id, travelCalendarDrafts(stamped));
    }
    if (shouldSyncTravelItinerary(stamped)) {
      void publishTravelTripItinerary(stamped).catch(() => undefined);
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

  const itemEdit = useTravelPlanItemDetailsEdit({ plan, itinerary, updatePlan });
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
  const { addItem } = useTravelPlanDetailAddItem({
    planId,
    plan,
    form,
    dateDisplayFormat,
    updatePlan,
    setExpenseDraft,
    setOpenExpenseSheet,
    maybeShowImportedAddPrompt: expenseImport.maybeShowImportedAddPrompt,
  });

  const planUi = useTravelPlanUi((state) => state.byPlanId[planId]);
  const patchPlanUi = useTravelPlanUi((state) => state.patchPlanUi);
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
    const tick = () => setTimelineNow(new Date());
    const interval = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  // Keep persisted day collapse in sync with clock-driven auto-collapse for
  // untouched days so remounts don't flash a stale open/closed set.
  useEffect(() => {
    const next = [...collapsedDayDates].sort();
    const current = [...persistedCollapsedDays].sort();
    if (next.length === current.length && next.every((date, i) => date === current[i])) {
      return;
    }
    patchPlanUi(planId, { collapsedDayDates: next });
  }, [collapsedDayDates, persistedCollapsedDays, patchPlanUi, planId]);

  const transportCounts = {
    flights: sortedItinerary.filter((item) => item.kind === 'flight').length,
    ground: sortedItinerary.filter((item) => item.kind === 'transport').length,
    stays: sortedItinerary.filter((item) => item.kind === 'stay').length,
    rentals: sortedItinerary.filter((item) => item.kind === 'rental').length,
  };
  const isSectionExpanded = (key: DetailSectionKey) =>
    sectionExpanded[key] ?? sectionDefaultExpanded(key, transportCounts);
  const toggleSection = (key: DetailSectionKey) => {
    patchPlanUi(planId, {
      sectionExpanded: {
        ...sectionExpanded,
        [key]: !(sectionExpanded[key] ?? sectionDefaultExpanded(key, transportCounts)),
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
        travelStyle={travelStyle}
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
        onOpenExpenses={() => setOpenExpenseSheet(true)}
        notesExpanded={notesExpanded}
        onNotesExpandedChange={setNotesExpanded}
        denseHeroGlass={denseHeroGlass}
      />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  transparentScreen: { backgroundColor: 'transparent' },
});
