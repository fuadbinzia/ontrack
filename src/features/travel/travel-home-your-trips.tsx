import { View } from 'react-native';

import { EmptyState, useListEnterIds } from '@/components/primitives';
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
  selfDisplayName: string;
  atmosphereAverageColor?: string;
  onOpenTrip: (tripId: string) => void;
  onEditTrip: (tripId: string) => void;
  onViewTravelers: (tripId: string) => void;
  onLayoutY?: (tripId: string, y: number) => void;
};

/**
 * Your Trips band — always-open search field and cards.
 */
export function TravelHomeYourTrips({
  plans,
  searchQuery,
  onSearchQueryChange,
  selfDisplayName,
  atmosphereAverageColor,
  onOpenTrip,
  onEditTrip,
  onViewTravelers,
  onLayoutY,
}: TravelHomeYourTripsProps) {
  const { s } = useResponsive();
  const peekHeight = s(travelHomeTokens.spacing.headerToSection);
  const showEmptySearch = plans.length === 0 && Boolean(searchQuery.trim());
  const tripEnterIds = useListEnterIds(
    'travel-home',
    plans.map((plan) => plan.id),
  );

  return (
    <View style={{ gap: s(travelHomeTokens.spacing.sectionGap) }}>
      <View>
        <View style={{ height: peekHeight }} />
        <AgentTestId testID={AgentUiIds.travel.home.sectionYourTrips}>
          <TravelHomeSectionHeader
            title="Your Trips"
            count={plans.length}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
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

      <View style={{ gap: travelHomeTokens.spacing.cardGap }}>
        {plans.map((plan, index) => (
          <TravelHomeTripCard
            key={plan.id}
            plan={plan}
            index={index}
            animateEntrance={tripEnterIds.has(plan.id)}
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
    </View>
  );
}
