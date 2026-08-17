import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { EmptyState, Screen, useSafeAreaChrome } from '@/components/primitives';
import { TravelScreenHeader } from '@/features/travel/travel-screen-header';
import {
  travelSafeAreaBackground,
  useTravelPageStyle,
} from '@/features/travel/travel-surface';
import { useRecoverReservedTravelPlan } from '@/features/travel/use-recover-reserved-travel-plan';
import { useTheme } from '@/hooks/use-theme';
import { useTravel } from '@/store/travel';
import { AgentUiIds } from '@/utils/agent-ui';
import { goBackOrReplace } from '@/utils/navigation';

type TravelTripHubScreenProps = {
  planId: string;
};

/** Legacy `/travel/<id>/hub` entry — forwards old links to Trip Tools. */
export function TravelTripHubScreen({ planId }: TravelTripHubScreenProps) {
  const theme = useTheme();
  const travelStyle = useTravelPageStyle(theme);
  useSafeAreaChrome(travelSafeAreaBackground(theme));
  const router = useRouter();
  useRecoverReservedTravelPlan(planId);
  const plan = useTravel((state) => state.plans.find((item) => item.id === planId));

  useEffect(() => {
    if (!planId || !plan) return;
    router.replace({
      pathname: '/travel/[id]/tools',
      params: { id: planId },
    } as never);
  }, [plan, planId, router]);

  if (!plan) {
    return (
      <Screen style={travelStyle} refresh={false}>
        <TravelScreenHeader
          title="Trip"
          subtitle="Tools"
          onClose={() => goBackOrReplace(router, '/(tabs)/travel')}
          closeAccessibilityLabel="Close trip tools"
          closeTestID={AgentUiIds.travel.hub.close}
        />
        <EmptyState
          icon="flight"
          title="This Trip Isn’t Here"
          message="It may have been removed, or the invite is no longer open."
          actionLabel="Back to Travel"
          actionTestID={AgentUiIds.travel.hub.backToTravel}
          onAction={() => goBackOrReplace(router, '/(tabs)/travel')}
        />
      </Screen>
    );
  }

  return <Screen style={travelStyle} refresh={false} />;
}
