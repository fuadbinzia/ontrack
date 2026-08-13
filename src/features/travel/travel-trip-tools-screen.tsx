import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

import {
  AppText,
  EmptyState,
  GlassIconWell,
  HeaderBackButton,
  Screen,
  Symbol,
} from "@/components/primitives";
import { travelEditorialTextStyle } from "@/features/travel/travel-chrome";
import { TravelPlanTripTools } from "@/features/travel/travel-plan-trip-tools";
import { TravelScreenHeader } from "@/features/travel/travel-screen-header";
import { useRecoverReservedTravelPlan } from "@/features/travel/use-recover-reserved-travel-plan";
import { useTravelTripToolsBackground } from "@/features/travel/use-travel-trip-tools-background";
import { useResponsive } from "@/hooks/use-responsive";
import { useTheme } from "@/hooks/use-theme";
import { useTravel } from "@/store/travel";
import { AgentUiIds } from "@/utils/agent-ui";
import { goBackOrReplace } from "@/utils/navigation";

export function TravelTripToolsScreen({ planId }: { planId: string }) {
  const router = useRouter();
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  useTravelTripToolsBackground();
  useRecoverReservedTravelPlan(planId || undefined);
  const plan = useTravel((state) =>
    planId ? state.plans.find((item) => item.id === planId) : undefined,
  );
  const tripHref = {
    pathname: "/travel/[id]",
    params: { id: planId },
  } as const;

  if (!plan) {
    return (
      <Screen
        style={styles.transparentScreen}
        refresh={false}
        atmosphere={false}
        contentStyle={{ gap: rs.lg }}
      >
        <TravelScreenHeader
          title="Trip Tools"
          eyebrow="Itinerary"
          leading={
            <HeaderBackButton
              compact
              accessibilityLabel="Back to trip"
              testID={AgentUiIds.travel.tripTools.back}
              onPress={() => goBackOrReplace(router, tripHref)}
            />
          }
        />
        <EmptyState
          icon="flight"
          title="Trip Not Found"
          message="This trip may have been removed on another device."
          actionLabel="Back to Travel"
          actionTestID={AgentUiIds.travel.tripTools.backToTravel}
          onAction={() => router.replace("/travel" as never)}
        />
      </Screen>
    );
  }

  const destination = plan.destination.trim() || plan.title;

  return (
    <Screen
      style={styles.transparentScreen}
      refresh={false}
      atmosphere={false}
      contentStyle={{
        gap: Math.max(rs.md, s(18)),
        paddingBottom: Math.max(96, s(110)),
      }}
    >
      <TravelScreenHeader
        title="Trip Tools"
        eyebrow="Itinerary"
        subtitle={`Plan, prepare, and explore ${destination}.`}
        leading={
          <HeaderBackButton
            compact
            accessibilityLabel="Back to trip"
            testID={AgentUiIds.travel.tripTools.back}
            onPress={() => goBackOrReplace(router, tripHref)}
          />
        }
        trailing={
          <GlassIconWell
            variant="airy"
            size={Math.max(40, s(42))}
            borderRadius={Math.max(13, s(14))}
          >
            <Symbol name="maintenance" size="md" color={theme.accentPrimary} />
          </GlassIconWell>
        }
      />
      <AppText
        variant="overline"
        fit
        numberOfLines={1}
        style={[
          travelEditorialTextStyle,
          { color: theme.textSecondary, paddingHorizontal: rs.xs },
        ]}
      >
        YOUR TRAVEL DESK
      </AppText>
      <TravelPlanTripTools
        plan={plan}
        onAddTransport={() => {
          router.replace({
            pathname: "/travel/[id]",
            params: { id: plan.id, add: "transport" },
          } as never);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  transparentScreen: {
    backgroundColor: "transparent",
  },
});
