import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { EmptyState } from '@/components/primitives';
import { resolveTravelCoTravelerPeople } from '@/features/travel/travel-cotraveler-people';
import { TravelHomeSectionHeader } from '@/features/travel/travel-home-section-header';
import {
    travelHomeFontFamily,
    travelHomeTokens,
} from '@/features/travel/travel-home-tokens';
import { TravelHomeTripCard } from '@/features/travel/travel-home-trip-card';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

type TravelHomeYourTripsProps = {
  plans: readonly TravelPlan[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  /** Collapse expanded search (atmosphere peek + parent chrome). */
  onDismissSearch: () => void;
  selfDisplayName: string;
  atmosphereAverageColor?: string;
  onOpenTrip: (tripId: string) => void;
  onEditTrip: (tripId: string) => void;
  onViewTravelers: (tripId: string) => void;
  onLayoutY?: (tripId: string, y: number) => void;
};

/** True when trip search is expanded or has a non-empty query. */
export function isTravelHomeTripSearchActive(
  searchOpen: boolean,
  searchQuery: string,
): boolean {
  return searchOpen || Boolean(searchQuery.trim());
}

/**
 * Your Trips band — atmosphere dismiss peek, expandable search chip, and cards.
 */
export function TravelHomeYourTrips({
  plans,
  searchQuery,
  onSearchQueryChange,
  searchOpen,
  onSearchOpenChange,
  onDismissSearch,
  selfDisplayName,
  atmosphereAverageColor,
  onOpenTrip,
  onEditTrip,
  onViewTravelers,
  onLayoutY,
}: TravelHomeYourTripsProps) {
  const { s } = useResponsive();
  /**
   * Replay the landing motion on the stable list shell. Remounting by key on
   * every focus also remounted every hero carousel and restarted cover work.
   */
  const focusEntrance = useSharedValue(1);
  const focusEntranceStyle = useAnimatedStyle(() => ({
    opacity: focusEntrance.value,
    transform: [{ translateY: (1 - focusEntrance.value) * 12 }],
  }));
  useFocusEffect(
    useCallback(() => {
      cancelAnimation(focusEntrance);
      focusEntrance.value = 0;
      focusEntrance.value = withTiming(1, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      });
      return () => cancelAnimation(focusEntrance);
    }, [focusEntrance]),
  );
  const searchActive = isTravelHomeTripSearchActive(searchOpen, searchQuery);
  const peekHeight = s(travelHomeTokens.spacing.headerToSection);
  const showEmptySearch = plans.length === 0 && Boolean(searchQuery.trim());

  return (
    <View style={{ gap: s(travelHomeTokens.spacing.sectionGap) }}>
      <View>
        {searchActive ? (
          <AgentTestId
            testID={AgentUiIds.travel.list.searchDismiss}
            label="Dismiss trip search"
            onPress={onDismissSearch}
            style={{ height: peekHeight }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss trip search"
              onPress={onDismissSearch}
              style={{ flex: 1 }}
            />
          </AgentTestId>
        ) : (
          <View style={{ height: peekHeight }} />
        )}
        <AgentTestId testID={AgentUiIds.travel.home.sectionYourTrips}>
          <TravelHomeSectionHeader
            title="Your Trips"
            count={plans.length}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            searchOpen={searchOpen}
            onSearchOpenChange={onSearchOpenChange}
          />
        </AgentTestId>
      </View>

      {showEmptySearch ? (
        <AgentTestId testID={AgentUiIds.travel.list.emptySearch}>
          <EmptyState
            icon="search"
            title="No matching trips"
            message="Try a different title, destination, or note."
            titleStyle={{ fontFamily: travelHomeFontFamily }}
            messageStyle={{ fontFamily: travelHomeFontFamily }}
          />
        </AgentTestId>
      ) : null}

      <Animated.View
        style={[
          { gap: travelHomeTokens.spacing.cardGap },
          focusEntranceStyle,
        ]}
        onTouchStart={searchActive ? onDismissSearch : undefined}>
        {plans.map((plan, index) => (
          <TravelHomeTripCard
            key={plan.id}
            plan={plan}
            index={index}
            animateEntrance={false}
            soloAtmosphereShadow={plans.length === 1}
            atmosphereAverageColor={atmosphereAverageColor}
            travelers={resolveTravelCoTravelerPeople(plan, selfDisplayName)}
            onOpenTrip={onOpenTrip}
            onViewItinerary={onOpenTrip}
            onEditTrip={onEditTrip}
            onViewTravelers={onViewTravelers}
            onLayoutY={onLayoutY}
          />
        ))}
      </Animated.View>
    </View>
  );
}
