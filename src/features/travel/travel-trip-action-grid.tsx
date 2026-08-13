import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";

import { AppText, GlassIconWell, Symbol } from "@/components/primitives";
import { type AppIconName, motion, spacing } from "@/design-system";
import { travelEditorialTextStyle } from "@/features/travel/travel-chrome";
import { promotesFlightSearch } from "@/features/travel/travel-mode";
import {
  travelAccent,
  travelItineraryInk,
  TravelSurfaceCard,
} from "@/features/travel/travel-surface";
import type { TravelPlanMode } from "@/features/travel/types";
import { useResponsive } from "@/hooks/use-responsive";
import { useTheme } from "@/hooks/use-theme";
import { AgentUiIds } from "@/utils/agent-ui";

import { TravelSheetAction } from "./travel-list-actions";

interface TravelTripActionGridProps {
  tripId: string;
  tripTitle: string;
  destination: string;
  mode: TravelPlanMode;
  isOnCalendar: boolean;
  /** When false, hide the Trip Itinerary CTA (already on plan detail). */
  showItineraryAction?: boolean;
  onOpenItinerary?: () => void;
  onOpenCalendar: () => void;
  onSearchFlights: () => void;
  onAddTransport: () => void;
  onSearchStays: () => void;
  onOpenStraiAway: () => void;
  onOpenWeather: () => void;
  onOpenCurrency: () => void;
  onOpenTranslator: () => void;
  onOpenExpenses: () => void;
  onOpenPackingList: () => void;
  onOpenChat: () => void;
  onOpenCoTravelers: () => void;
}

function ActionGroup({
  title,
  subtitle,
  icon,
  delay,
  children,
}: {
  title: string;
  subtitle: string;
  icon: AppIconName;
  delay: number;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  const iconSize = Math.max(34, s(36));
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.fade)
        .delay(delay)
        .reduceMotion(ReduceMotion.System)}
    >
      <TravelSurfaceCard padding={0}>
        <View style={[styles.group, { gap: rs.md, padding: rs.md }]}>
          <View style={[styles.groupHeader, { gap: rs.sm }]}>
            <GlassIconWell size={iconSize} borderRadius={Math.max(10, s(11))}>
              <Symbol name={icon} size="sm" color={travelAccent(theme)} />
            </GlassIconWell>
            <View style={styles.groupCopy}>
              <AppText
                variant="subheading"
                fit
                numberOfLines={1}
                style={[
                  styles.groupTitle,
                  { color: travelItineraryInk(theme) },
                ]}
              >
                {title}
              </AppText>
              <AppText
                variant="caption"
                fit
                numberOfLines={1}
                style={{ color: travelItineraryInk(theme, "secondary") }}
              >
                {subtitle}
              </AppText>
            </View>
          </View>
          <View style={[styles.grid, { gap: rs.sm }]}>{children}</View>
        </View>
      </TravelSurfaceCard>
    </Animated.View>
  );
}

/** Predictable trip action hierarchy: next step first, related tools grouped below. */
export function TravelTripActionGrid({
  tripId,
  tripTitle,
  destination,
  mode,
  isOnCalendar,
  showItineraryAction = true,
  onOpenItinerary,
  onOpenCalendar,
  onSearchFlights,
  onAddTransport,
  onSearchStays,
  onOpenStraiAway,
  onOpenWeather,
  onOpenCurrency,
  onOpenTranslator,
  onOpenExpenses,
  onOpenPackingList,
  onOpenChat,
  onOpenCoTravelers,
}: TravelTripActionGridProps) {
  return (
    <View style={styles.container}>
      {showItineraryAction && onOpenItinerary ? (
        <View style={styles.itineraryAction}>
          <TravelSheetAction
            label="Trip Itinerary"
            icon="list"
            tone="flight"
            wide
            testID={AgentUiIds.travel.list.itinerary(tripId)}
            onPress={onOpenItinerary}
            accessibilityLabel="Trip Itinerary"
          />
        </View>
      ) : null}

      <ActionGroup
        title="Book & Organize"
        subtitle="Bookings, plans, and trip essentials"
        icon="maintenance"
        delay={0}
      >
        <TravelSheetAction
          label="Calendar"
          icon="sync"
          tone="calendar"
          testID={AgentUiIds.travel.list.calendar(tripId)}
          onPress={onOpenCalendar}
          accessibilityLabel={
            isOnCalendar
              ? `Sync changes for ${tripTitle} with Calendar`
              : `Add ${tripTitle} to Calendar`
          }
        />
        {promotesFlightSearch(mode) ? (
          <TravelSheetAction
            label="Search Flights"
            icon="flight"
            tone="flight"
            testID={AgentUiIds.travel.list.searchFlights(tripId)}
            onPress={onSearchFlights}
            accessibilityLabel={`Search Flights for ${tripTitle}`}
          />
        ) : (
          <TravelSheetAction
            label="Add Transport"
            icon="route"
            tone="flight"
            testID={AgentUiIds.travel.list.addTransport(tripId)}
            onPress={onAddTransport}
            accessibilityLabel={`Add Transport for ${tripTitle}`}
          />
        )}
        <TravelSheetAction
          label="Search Stays"
          icon="lodging"
          tone="lodging"
          testID={AgentUiIds.travel.list.searchStays(tripId)}
          onPress={onSearchStays}
          accessibilityLabel={`Search Stays for ${tripTitle}`}
        />
        <TravelSheetAction
          label="StraiAway"
          icon="link"
          tone="link"
          testID={AgentUiIds.travel.list.straiaway(tripId)}
          onPress={onOpenStraiAway}
          accessibilityLabel={`Send or open stays in StraiAway for ${tripTitle}`}
        />
        <TravelSheetAction
          label="Expenses"
          icon="receipt"
          tone="expense"
          testID={AgentUiIds.travel.list.expenses(tripId)}
          onPress={onOpenExpenses}
          accessibilityLabel={`Open Expenses for ${tripTitle}`}
        />
        <TravelSheetAction
          label="Checklist"
          icon="backpack"
          tone="link"
          testID={AgentUiIds.travel.list.packingList(tripId)}
          onPress={onOpenPackingList}
          accessibilityLabel={`Open Checklist for ${tripTitle}`}
        />
      </ActionGroup>

      <ActionGroup
        title="At Your Destination"
        subtitle={`Useful while you’re in ${destination || "town"}`}
        icon="location"
        delay={50}
      >
        <TravelSheetAction
          label="Trip Weather"
          icon="weather"
          tone="clock"
          testID={AgentUiIds.travel.list.tripWeather(tripId)}
          onPress={onOpenWeather}
          accessibilityLabel={`View Weather for ${destination}`}
        />
        <TravelSheetAction
          label="Currency"
          icon="calculator"
          tone="currency"
          testID={AgentUiIds.travel.list.currency(tripId)}
          onPress={onOpenCurrency}
          accessibilityLabel={`Convert Currency for ${destination}`}
        />
        <TravelSheetAction
          label="Translator"
          icon="translator"
          tone="link"
          testID={AgentUiIds.travel.list.translator(tripId)}
          onPress={onOpenTranslator}
          accessibilityLabel={`Open Translator for ${destination}`}
        />
      </ActionGroup>

      <ActionGroup
        title="Travel Together"
        subtitle="Keep everyone in the loop"
        icon="people"
        delay={100}
      >
        <TravelSheetAction
          label="Group Chat"
          icon="chat"
          tone="chat"
          testID={AgentUiIds.travel.list.groupChat(tripId)}
          onPress={onOpenChat}
          accessibilityLabel={`Open Group Chat for ${tripTitle}`}
        />
        <TravelSheetAction
          label="Co-Travelers"
          icon="people"
          tone="people"
          testID={AgentUiIds.travel.list.coTravelers(tripId)}
          onPress={onOpenCoTravelers}
          accessibilityLabel={`Open Co-Travelers for ${tripTitle}`}
        />
      </ActionGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  itineraryAction: {
    width: "75%",
    alignSelf: "center",
  },
  group: {
    width: "100%",
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  groupCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  groupTitle: {
    ...travelEditorialTextStyle,
    flexShrink: 1,
    minWidth: 0,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
