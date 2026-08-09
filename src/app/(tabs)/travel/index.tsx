import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    Screen,
    appPrompt,
    useSafeAreaChrome,
    useSafeAreaChromeOverlay,
} from '@/components/primitives';
import { spacing } from '@/design-system';
import { resolveSelfDisplayName } from '@/features/account/self-display-name';
import { useAuthSession } from '@/features/auth/auth-provider';
import { isTravelPlanOnCalendar, travelCalendarDrafts } from '@/features/travel/calendar';
import { validateTravelDateRange } from '@/features/travel/date-range';
import { persistTravelCoverPhoto } from '@/features/travel/destination-cover';
import { currencyFromLocale } from '@/features/travel/expenses/format-money';
import { repairTravelPlansChatAccess } from '@/features/travel/travel-chat-roster';
import { TravelFriendsSheet } from '@/features/travel/travel-friends-sheet';
import { travelHomeAtmosphereHeaderScrimColors } from '@/features/travel/travel-home-atmosphere-ink';
import {
    TravelHomeAtmosphereScrim,
    travelHomeAtmosphereScrimHeight,
} from '@/features/travel/travel-home-atmosphere-scrim';
import {
    TravelHomeBackground,
    travelHomeAtmosphereHeight,
} from '@/features/travel/travel-home-background';
import { TravelHomeEmpty } from '@/features/travel/travel-home-empty';
import { TravelHomeHeader } from '@/features/travel/travel-home-header';
import { filterTravelPlansByQuery } from '@/features/travel/travel-home-plan-search';
import { travelHomeTokens } from '@/features/travel/travel-home-tokens';
import {
    TravelHomeYourTrips,
    isTravelHomeTripSearchActive,
} from '@/features/travel/travel-home-your-trips';
import { TravelNewTripSheet } from '@/features/travel/travel-new-trip-sheet';
import { validateTravelPlanDetails } from '@/features/travel/travel-plan-details';
import { TravelPlanDetailsEditor } from '@/features/travel/travel-plan-details-editor';
import { useTravelPageStyle } from '@/features/travel/travel-surface';
import type { TravelPlan, TravelPlanMode } from '@/features/travel/types';
import { useTravelHomeAtmosphereImage } from '@/features/travel/use-travel-home-atmosphere-image';
import { useResponsive } from '@/hooks/use-responsive';
import { FeatureThemeProvider, useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import {
    orderTravelPlansByRecency,
    orderTravelPlansForLauncher,
    useTravel,
} from '@/store/travel';
import { toDateKey } from '@/utils/date';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';
import { newId } from '@/utils/id';
import { warmHrefsAfterTransition } from '@/utils/warm-navigation';

/** Primary travel planning tab — trip launcher (tools live on trip hub). */
export default function TravelScreen() {
  return (
    <FeatureThemeProvider feature="travel">
      <TravelScreenContent />
    </FeatureThemeProvider>
  );
}

function isCurrentOrUpcomingTrip(plan: TravelPlan, today: string): boolean {
  return plan.endDate >= today;
}

function TravelScreenContent() {
  const theme = useTheme();
  const travelStyle = useTravelPageStyle(theme);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { editCover, tripId } = useLocalSearchParams<{
    editCover?: string;
    tripId?: string;
  }>();
  const { spacing: rs } = useResponsive();
  const { user } = useAuthSession();
  const plans = useTravel((state) => state.plans);
  const recentPlanIds = useTravel((state) => state.recentPlanIds);
  const recordPlanInteraction = useTravel((state) => state.recordPlanInteraction);
  const savePlan = useTravel((state) => state.savePlan);
  const removePlan = useTravel((state) => state.removePlan);
  const activities = useSchedule((state) => state.activities);
  const replaceTravelActivities = useSchedule((state) => state.replaceTravelActivities);
  const dateLocale = usePreferences((state) => state.dateLocale);
  const preferencesName = usePreferences((state) => state.name);
  const selfDisplayName = useMemo(
    () => resolveSelfDisplayName({ preferencesName, user }),
    [preferencesName, user],
  );
  const today = toDateKey(new Date());
  // Welcome empty first — do not auto-open New Trip over the invitation.
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<TravelPlanMode>('flight');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [editingDetailsPlanId, setEditingDetailsPlanId] = useState<string>();
  const [editTitle, setEditTitle] = useState('');
  const [editMode, setEditMode] = useState<TravelPlanMode>('flight');
  const [editOrigin, setEditOrigin] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editCoverUri, setEditCoverUri] = useState<string | undefined>();
  const [detailsError, setDetailsError] = useState<string>();
  const [friendsPlanId, setFriendsPlanId] = useState<string>();
  const [friendsVisible, setFriendsVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const editScrollRef = useRef<ScrollView>(null);
  const tripOffsets = useRef<Record<string, number>>({});
  const [pendingCreatedTripId, setPendingCreatedTripId] = useState<string>();
  const [pendingFollowTripId, setPendingFollowTripId] = useState<string>();
  const [scrollTargetOffset, setScrollTargetOffset] = useState<number>();
  const [activeTripId, setActiveTripId] = useState<string>();
  const focusedTripId = typeof tripId === 'string' ? tripId : undefined;
  const scrollTargetTripId =
    pendingCreatedTripId ?? pendingFollowTripId ?? focusedTripId;

  const sortedPlans = useMemo(
    () => orderTravelPlansByRecency(plans, recentPlanIds),
    [plans, recentPlanIds],
  );
  const currentPlans = useMemo(
    () => sortedPlans.filter((plan) => isCurrentOrUpcomingTrip(plan, today)),
    [sortedPlans, today],
  );
  const launcherPlans = useMemo(
    () => orderTravelPlansForLauncher(plans, recentPlanIds, today),
    [plans, recentPlanIds, today],
  );
  const [tripSearchQuery, setTripSearchQuery] = useState('');
  const [tripSearchOpen, setTripSearchOpen] = useState(false);
  // Close only — section header clears query + keyboard after collapse settles.
  const collapseTripSearch = useCallback(() => {
    setTripSearchOpen(false);
  }, []);
  const tripSearchActive = isTravelHomeTripSearchActive(
    tripSearchOpen,
    tripSearchQuery,
  );
  const visibleLauncherPlans = useMemo(
    () => filterTravelPlansByQuery(launcherPlans, tripSearchQuery),
    [launcherPlans, tripSearchQuery],
  );
  const hasCurrentTrips = currentPlans.length > 0;

  useEffect(() => {
    if (!hasCurrentTrips) {
      setActiveTripId(undefined);
      return;
    }
    setActiveTripId((previous) => {
      if (previous && currentPlans.some((plan) => plan.id === previous)) {
        return previous;
      }
      return currentPlans[0]?.id;
    });
  }, [currentPlans, hasCurrentTrips]);

  const interactWithPlan = (planId: string) => {
    const alreadyFirst = sortedPlans[0]?.id === planId;
    recordPlanInteraction(planId);
    if (alreadyFirst) return;
    delete tripOffsets.current[planId];
    setScrollTargetOffset(undefined);
    setPendingFollowTripId(planId);
  };

  useEffect(() => {
    if (!showForm) return;
    setStartDate('');
    setEndDate('');
  }, [showForm]);

  useEffect(() => {
    if (!user?.id || plans.length === 0) return;
    let active = true;
    void repairTravelPlansChatAccess({
      plans: useTravel.getState().plans,
      savePlan: (plan) => {
        if (active) savePlan(plan);
      },
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user?.id, plans.length, savePlan]);

  useEffect(() => {
    if (
      !scrollTargetTripId ||
      !sortedPlans.some((plan) => plan.id === scrollTargetTripId)
    ) {
      return;
    }

    recordPlanInteraction(scrollTargetTripId);
    setShowForm(false);

    const offset = tripOffsets.current[scrollTargetTripId];
    if (offset === undefined) return;
    if (pendingCreatedTripId === scrollTargetTripId) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, offset - rs.sm),
          animated: true,
        });
        setPendingCreatedTripId(undefined);
      }, 100);
      return () => clearTimeout(timer);
    }
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, offset - rs.sm),
        animated: true,
      });
      if (pendingFollowTripId === scrollTargetTripId) {
        setPendingFollowTripId(undefined);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    pendingCreatedTripId,
    pendingFollowTripId,
    recordPlanInteraction,
    rs.sm,
    scrollTargetOffset,
    scrollTargetTripId,
    sortedPlans,
  ]);

  const rememberTripOffset = (planId: string, y: number) => {
    tripOffsets.current[planId] = y;
    if (planId !== scrollTargetTripId) return;
    setScrollTargetOffset((previous) => (previous === y ? previous : y));
  };

  const updateActiveTripFromScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (!hasCurrentTrips || currentPlans.length === 0) return;
    const y = event.nativeEvent.contentOffset.y;
    const anchor = y + 140;
    let nextId = currentPlans[0]?.id;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const plan of currentPlans) {
      const top = tripOffsets.current[plan.id];
      if (top === undefined) continue;
      const distance = Math.abs(top - anchor);
      if (distance < bestDistance) {
        bestDistance = distance;
        nextId = plan.id;
      }
    }
    if (nextId && nextId !== activeTripId) setActiveTripId(nextId);
  };

  const friendsPlan = sortedPlans.find((plan) => plan.id === friendsPlanId);
  const openFriends = (planId: string) => {
    // Open the sheet first — list reorder waits so the modal isn't fighting
    // a scroll/layout reshuffle on the same frame as the tap.
    setFriendsPlanId(planId);
    setFriendsVisible(true);
    deferAfterPageTransition(() => interactWithPlan(planId));
  };
  const closeFriends = () => {
    appPrompt.dismiss();
    setFriendsVisible(false);
  };

  const openItinerary = (planId: string) => {
    // Push only — list reorder / scroll follow wait until the itinerary
    // transition has settled so the JS thread stays free for the animation.
    router.push({
      pathname: '/travel/[id]',
      params: { id: planId },
    } as never);
    deferAfterPageTransition(() => interactWithPlan(planId));
  };

  // Warm itinerary JS + prefetch the active/next trip after the tab settles.
  const warmTripIds = useMemo(() => {
    const candidates = [
      activeTripId,
      ...visibleLauncherPlans.map((plan) => plan.id),
    ].filter((id): id is string => typeof id === 'string' && id.length > 0);
    const unique: string[] = [];
    for (const id of candidates) {
      if (!unique.includes(id)) unique.push(id);
      if (unique.length >= 2) break;
    }
    return unique;
  }, [activeTripId, visibleLauncherPlans]);

  useEffect(() => {
    if (showForm || editingDetailsPlanId) return;
    const cancelModule = deferAfterPageTransition(() => {
      // Evaluate the itinerary module graph before the user taps through.
      void import('@/features/travel/travel-plan-detail');
    });
    const cancelRoutes =
      warmTripIds.length === 0
        ? undefined
        : warmHrefsAfterTransition(
            warmTripIds.map((id) => ({
              pathname: '/travel/[id]',
              params: { id },
            })) as never,
          );
    return () => {
      cancelModule();
      cancelRoutes?.();
    };
  }, [editingDetailsPlanId, showForm, warmTripIds]);

  // Prefetch cover URIs for warmed trips so the itinerary hero isn't blank/laggy.
  useEffect(() => {
    if (warmTripIds.length === 0) return;
    return deferAfterPageTransition(() => {
      for (const id of warmTripIds) {
        const plan = plans.find((item) => item.id === id);
        const uri = plan?.coverUri?.trim();
        if (uri) void Image.prefetch(uri).catch(() => undefined);
      }
    });
  }, [plans, warmTripIds]);

  const creatingPlanRef = useRef(false);
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
    setEditMode(plan.mode ?? 'flight');
    setEditOrigin(plan.origin ?? '');
    setEditDestination(plan.destination);
    setEditNotes(plan.notes ?? '');
    setEditStartDate(plan.startDate);
    setEditEndDate(plan.endDate);
    setEditCoverUri(plan.coverUri);
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
    let coverUri = editCoverUri;
    if (coverUri && coverUri !== plan.coverUri) {
      try {
        coverUri = await persistTravelCoverPhoto(coverUri, plan.id);
      } catch {
        return setDetailsError('Couldn’t save the cover photo. Try another image.');
      }
    }
    const next: TravelPlan = {
      ...plan,
      ...validation.value,
      mode: editMode,
      origin: editOrigin.trim() || undefined,
      startDate: editStartDate,
      endDate: editEndDate,
      updatedAt: new Date().toISOString(),
    };
    if (coverUri) next.coverUri = coverUri;
    else delete next.coverUri;
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

  const atmosphereDestinations = useMemo(
    () =>
      sortedPlans
        .map((plan) => plan.destination?.trim() || plan.title?.trim() || '')
        .filter((label) => label.length >= 2),
    [sortedPlans],
  );

  const atmosphereImage = useTravelHomeAtmosphereImage({
    enabled: true,
    tripDestinations: atmosphereDestinations,
  });

  const hasNoTrips = launcherPlans.length === 0;
  const atmosphereHeight = travelHomeAtmosphereHeight(windowHeight, insets.top, {
    empty: hasNoTrips,
  });
  // Dark theme keeps white header ink; match the header’s effective tone.
  const atmosphereHeaderInk =
    theme.name === 'dark' ? 'light' : atmosphereImage.headerInk;
  const atmosphereScrim = useMemo(() => {
    if (
      !travelHomeAtmosphereHeaderScrimColors(
        atmosphereHeaderInk,
        atmosphereImage.averageColor,
      )
    ) {
      return undefined;
    }
    return (
      <TravelHomeAtmosphereScrim
        headerInk={atmosphereHeaderInk}
        averageColor={atmosphereImage.averageColor}
      />
    );
  }, [atmosphereHeaderInk, atmosphereImage.averageColor]);
  const atmosphereScrimHeight = travelHomeAtmosphereScrimHeight(insets.top);

  // Paint atmosphere on the app-shell chrome so it fills the status-bar band
  // (in-screen absolute layers are clipped by SafeAreaView and can't).
  // Hero band only — mock fades into paper before Your Trips (not full-page).
  // priority: 1 — nested travel stack layout also registers chrome at 0 and
  // would otherwise stomp this image after the child focus effect.
  useSafeAreaChrome(atmosphereImage.skyColor, {
    backgroundImage: atmosphereImage.source,
    backgroundImageHeight: atmosphereHeight,
    backgroundImageBlurRadius: travelHomeTokens.sizes.heroBlurRadius,
    priority: 1,
  });
  // Soft contrast veil behind status-bar chrome + Travel title/tagline.
  useSafeAreaChromeOverlay(atmosphereScrim, atmosphereScrimHeight, {
    priority: 1,
  });

  if (editingPlan) {
    return (
      <Screen
        key={`edit-trip-${editingPlan.id}`}
        scrollRef={editScrollRef}
        style={travelStyle}
        contentStyle={styles.screen}
        refresh={false}>
        <TravelPlanDetailsEditor
          plan={editingPlan}
          title={editTitle}
          mode={editMode}
          origin={editOrigin}
          destination={editDestination}
          notes={editNotes}
          onNotesChange={setEditNotes}
          startDate={editStartDate}
          endDate={editEndDate}
          coverUri={editCoverUri}
          error={detailsError}
          initialCoverPickerOpen={openCoverPickerOnEdit}
          onTitleChange={setEditTitle}
          onModeChange={setEditMode}
          onOriginChange={setEditOrigin}
          onDestinationChange={setEditDestination}
          onStartDateChange={setEditStartDate}
          onEndDateChange={setEditEndDate}
          onCoverUriChange={setEditCoverUri}
          onSave={() => void saveEditedDetails(editingPlan)}
          onCancel={() => setEditingDetailsPlanId(undefined)}
          onDelete={() => {
            removePlan(editingPlan.id);
            setEditingDetailsPlanId(undefined);
          }}
        />
      </Screen>
    );
  }

  return (
    <View style={styles.fill}>
      <TravelHomeBackground enabled empty={hasNoTrips} />
      <Screen
        scrollRef={scrollRef}
        style={styles.transparentScreen}
        refresh={!showForm}
        onScroll={updateActiveTripFromScroll}
        contentStyle={{
          gap: travelHomeTokens.spacing.cardGap,
          // Sit the Travel header flush under the safe-area chrome (no cream gap).
          paddingTop: 0,
        }}>
        <TravelHomeHeader
          onAddTrip={!showForm ? openCreateTrip : undefined}
          locationLabel={atmosphereImage.label}
          headerInk={atmosphereImage.headerInk}
          onPressAway={tripSearchActive ? collapseTripSearch : undefined}
        />

        {hasNoTrips ? (
          <TravelHomeEmpty onAddTrip={openCreateTrip} />
        ) : (
          <TravelHomeYourTrips
            plans={visibleLauncherPlans}
            searchQuery={tripSearchQuery}
            onSearchQueryChange={setTripSearchQuery}
            searchOpen={tripSearchOpen}
            onSearchOpenChange={setTripSearchOpen}
            onDismissSearch={collapseTripSearch}
            selfDisplayName={selfDisplayName}
            atmosphereAverageColor={atmosphereImage.averageColor}
            onOpenTrip={openItinerary}
            onEditTrip={(id) => {
              const next = sortedPlans.find((item) => item.id === id);
              if (next) beginEditingDetails(next);
            }}
            onViewTravelers={openFriends}
            onLayoutY={rememberTripOffset}
          />
        )}

        {friendsPlan ? (
          <TravelFriendsSheet
            plan={friendsPlan}
            visible={friendsVisible}
            onClose={closeFriends}
            onSavePlan={savePlan}
          />
        ) : null}
      </Screen>

      <TravelNewTripSheet
        visible={showForm}
        title={title}
        destination={destination}
        startDate={startDate}
        endDate={endDate}
        notes={notes}
        error={error}
        onTitleChange={setTitle}
        onDestinationChange={setDestination}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onNotesChange={setNotes}
        onCreate={createPlan}
        onClose={closeCreateTrip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  transparentScreen: {
    backgroundColor: 'transparent',
  },
  screen: { gap: spacing.md },
});
