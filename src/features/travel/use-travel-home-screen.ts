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

import { travelHomeScreenStyles as styles } from '@/features/travel/travel-home-screen-styles';
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
import {
    persistTravelCoverPhotos,
    uploadedTripCoverUris,
} from '@/features/travel/destination-cover';
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
import {
    stripTripCoverUploads,
    tripCoverUploadFields,
    validateTravelPlanDetails,
} from '@/features/travel/travel-plan-details';
import { TravelPlanDetailsEditor } from '@/features/travel/travel-plan-details-editor';
import { useTravelPageStyle } from '@/features/travel/travel-surface';
import type { TravelPlan, TravelPlanMode } from '@/features/travel/types';
import type { TravelDestinationLocation } from '@/features/travel/map/types';
import { useTravelHomeAtmosphereChrome } from '@/features/travel/use-travel-home-atmosphere-chrome';
import { useTravelHomePlanActions } from '@/features/travel/use-travel-home-plan-actions';
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

function isCurrentOrUpcomingTrip(plan: TravelPlan, today: string): boolean {
  return plan.endDate >= today;
}


export function useTravelHomeScreen() {

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
  const [destinationLocation, setDestinationLocation] =
    useState<TravelDestinationLocation>();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [editingDetailsPlanId, setEditingDetailsPlanId] = useState<string>();
  const [editTitle, setEditTitle] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editDestinationLocation, setEditDestinationLocation] =
    useState<TravelDestinationLocation>();
  const [editNotes, setEditNotes] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editCoverUris, setEditCoverUris] = useState<string[]>([]);
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
        if (!plan) continue;
        for (const uri of uploadedTripCoverUris(plan)) {
          void Image.prefetch(uri).catch(() => undefined);
        }
      }
    });
  }, [plans, warmTripIds]);

  const creatingPlanRef = useRef(false);
  const {
    createPlan,
    beginEditingDetails,
    openCoverPickerOnEdit,
    saveEditedDetails,
    editingPlan,
    openCreateTrip,
    closeCreateTrip,
  } = useTravelHomePlanActions({
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
    editCover: typeof editCover === 'string' ? editCover : undefined,
    sortedPlans,
    savePlan: savePlan as any,
    recordPlanInteraction,
    replaceTravelActivities,
    activities,
    creatingPlanRef,
    interactWithPlan,
    editScrollRef,
  });

  const {
    atmosphereImage,
    hasNoTrips,
    atmosphereHeight,
    atmosphereHeaderInk,
    atmosphereScrim,
    atmosphereScrimHeight,
  } = useTravelHomeAtmosphereChrome({ sortedPlans, launcherPlans });


  return {
    showForm,
    setShowForm,
    title,
    setTitle,
    mode,
    setMode,
    destination,
    setDestination,
    destinationLocation,
    setDestinationLocation,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    notes,
    setNotes,
    error,
    setError,
    editingDetailsPlanId,
    setEditingDetailsPlanId,
    editTitle,
    setEditTitle,
    editDestination,
    setEditDestination,
    editDestinationLocation,
    setEditDestinationLocation,
    editNotes,
    setEditNotes,
    editStartDate,
    setEditStartDate,
    editEndDate,
    setEditEndDate,
    editCoverUris,
    setEditCoverUris,
    detailsError,
    setDetailsError,
    friendsPlanId,
    setFriendsPlanId,
    friendsVisible,
    setFriendsVisible,
    pendingCreatedTripId,
    setPendingCreatedTripId,
    pendingFollowTripId,
    setPendingFollowTripId,
    scrollTargetOffset,
    setScrollTargetOffset,
    activeTripId,
    setActiveTripId,
    tripSearchQuery,
    setTripSearchQuery,
    tripSearchOpen,
    setTripSearchOpen,
    theme,
    travelStyle,
    insets,
    router,
    plans,
    recentPlanIds,
    recordPlanInteraction,
    savePlan,
    removePlan,
    activities,
    replaceTravelActivities,
    dateLocale,
    preferencesName,
    selfDisplayName,
    today,
    scrollRef,
    editScrollRef,
    tripOffsets,
    focusedTripId,
    scrollTargetTripId,
    sortedPlans,
    currentPlans,
    launcherPlans,
    collapseTripSearch,
    tripSearchActive,
    visibleLauncherPlans,
    hasCurrentTrips,
    interactWithPlan,
    rememberTripOffset,
    updateActiveTripFromScroll,
    friendsPlan,
    openFriends,
    closeFriends,
    openItinerary,
    warmTripIds,
    creatingPlanRef,
    createPlan,
    beginEditingDetails,
    openCoverPickerOnEdit,
    saveEditedDetails,
    editingPlan,
    openCreateTrip,
    closeCreateTrip,
    atmosphereImage,
    hasNoTrips,
    atmosphereHeight,
    atmosphereHeaderInk,
    atmosphereScrim,
    atmosphereScrimHeight,
    editCover,
    tripId,
    rs,
    user,
  };
}
