import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

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
   * Trip-card `FadeInDown` only runs on mount. Tab stays mounted (and
   * neighbor `preload` can mount Travel off-screen), so bump a key on every
   * focus to remount the list — same Today activity-card spring, every land.
   */
  const [entranceKey, setEntranceKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setEntranceKey((key) => key + 1);
    }, []),
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

      {entranceKey > 0 ? (
        <View
          // Search gets a clean, non-animated tree. Reanimated entrance
          // transforms do not participate in Yoga layout and can otherwise
          // let later cards paint over earlier card bodies while filtering.
          key={`${entranceKey}-${searchActive ? 'search' : 'browse'}`}
          style={{ gap: travelHomeTokens.spacing.cardGap }}
          onTouchStart={searchActive ? onDismissSearch : undefined}>
          {plans.map((plan, index) => (
            <TravelHomeTripCard
              key={plan.id}
              plan={plan}
              index={index}
              animateEntrance={!searchActive}
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
        </View>
      ) : null}
    </View>
  );
}
