import { useMemo, type RefObject } from 'react';
import {
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Screen } from '@/components/primitives';
import { motion } from '@/design-system';
import { useTravelAtmosphere } from '@/features/travel/travel-atmosphere';
import { resolveTravelArtworkTintHex } from '@/features/travel/travel-artwork-tint';
import { TravelArtworkTintProvider } from '@/features/travel/travel-artwork-tint-context';
import { TravelCollapsibleSection } from '@/features/travel/travel-collapsible-section';
import {
    TRAVEL_HEADER_DATES_SKY_OVERLAP,
    TRAVEL_HEADER_DATES_TOP_GAP,
    TRAVEL_HEADER_SKY_CONTENT_BAND,
    TRAVEL_HEADER_SKY_FADE_TAIL,
    travelPlanSkyPageWashStyle,
} from '@/features/travel/travel-header-sky-height';
import { TravelItineraryTimeline } from '@/features/travel/travel-itinerary-timeline';
import { TravelPlanDetailBodySkeleton } from '@/features/travel/travel-plan-detail-body-skeleton';
import type { DetailSectionKey } from '@/features/travel/travel-plan-detail-sections';
import { TravelPlanHero } from '@/features/travel/travel-plan-hero';
import { TravelPlanTripTools } from '@/features/travel/travel-plan-trip-tools';
import {
    resolveHeaderSkyCondition,
    resolveHeaderSkyWashTop,
} from '@/features/travel/travel-sky-condition';
import { travelAccent } from '@/features/travel/travel-surface';
import { TravelTransportSections } from '@/features/travel/travel-transport-sections';
import type {
    TravelItemKind,
    TravelItineraryItem,
    TravelPlan,
} from '@/features/travel/types';
import type { TravelPlanDetailItemHandlers } from '@/features/travel/use-travel-plan-detail-item-handlers';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

type TravelPlanDetailBodyProps = {
  plan: TravelPlan;
  travelStyle: ViewStyle;
  sortedItinerary: TravelItineraryItem[];
  itemEditHandlers: TravelPlanDetailItemHandlers;
  collapsedDayDates: Set<string>;
  isSectionExpanded: (key: DetailSectionKey) => boolean;
  toggleSection: (key: DetailSectionKey) => void;
  onToggleDay: (date: string) => void;
  onAddPress: () => void;
  onAddKind: (kind: TravelItemKind) => void;
  onEditDates: () => void;
  onEditNotes: () => void;
  onOpenExpenses: () => void;
  notesExpanded: boolean;
  onNotesExpandedChange: (expanded: boolean) => void;
  /** Dates/Notes denser frost while a flight card is expanded. */
  denseHeroGlass?: boolean;
  /** After stack settle — mount transport/timeline/tools (hero/sky stay mounted). */
  bodyReady?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollOffsetYRef?: RefObject<number>;
  pendingFocusEntryKey?: string;
  onFocusEntryHandled?: () => void;
};

export function TravelPlanDetailBody({
  plan,
  travelStyle,
  sortedItinerary,
  itemEditHandlers,
  collapsedDayDates,
  isSectionExpanded,
  toggleSection,
  onToggleDay,
  onAddPress,
  onAddKind,
  onEditDates,
  onEditNotes,
  onOpenExpenses,
  notesExpanded,
  onNotesExpandedChange,
  denseHeroGlass = false,
  bodyReady = true,
  scrollRef,
  onScroll,
  scrollOffsetYRef,
  pendingFocusEntryKey,
  onFocusEntryHandled,
}: TravelPlanDetailBodyProps) {
  const theme = useTheme();
  const atmosphere = useTravelAtmosphere();
  const { s, spacing: rs } = useResponsive();
  // Match hero header→dates breathing room between Notes / Transport / Timeline.
  const sectionGap = Math.max(rs.md, s(20));
  // Clear the sky band so app-shell chrome can meet the in-header plate.
  const skyContentBand = Math.max(TRAVEL_HEADER_SKY_CONTENT_BAND, s(152));
  const skyFadeTail = Math.max(TRAVEL_HEADER_SKY_FADE_TAIL, s(40));
  const datesTopGap = Math.max(rs.sm, s(TRAVEL_HEADER_DATES_TOP_GAP));
  const datesSkyOverlap = Math.max(0, s(TRAVEL_HEADER_DATES_SKY_OVERLAP));
  const skyDestination =
    plan.destination.trim() || atmosphere.destination || '';
  const themeDark = theme.name === 'dark';
  const skyCondition = resolveHeaderSkyCondition({
    themeDark,
    timeOfDay: atmosphere.timeOfDay,
    weatherCode: atmosphere.weatherCode,
    timezone: atmosphere.timezone,
    destination: skyDestination,
    latitude: atmosphere.latitude,
  });
  const washTop = resolveHeaderSkyWashTop({
    themeDark,
    timeOfDay: atmosphere.timeOfDay,
    weatherCode: atmosphere.weatherCode,
    timezone: atmosphere.timezone,
    destination: skyDestination,
    latitude: atmosphere.latitude,
  });
  const artworkTint = useMemo(
    () =>
      resolveTravelArtworkTintHex({
        themeDark,
        look: skyCondition.look,
        destination: skyDestination,
      }),
    [skyCondition.look, skyDestination, themeDark],
  );
  const paper =
    typeof travelStyle.backgroundColor === 'string'
      ? travelStyle.backgroundColor
      : theme.backgroundPrimary;

  return (
    <TravelArtworkTintProvider hex={artworkTint}>
      <View style={styles.fill}>
        {/*
          Short sky→paper dissolve starting at the dates card so the artwork
          floor meets that seam (not a peach strip above it).
        */}
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
          contentStyle={{ gap: sectionGap, paddingTop: 0 }}
          refresh={false}
          scrollRef={scrollRef}
          onScroll={onScroll}>
          <TravelPlanHero
            plan={plan}
            onAddPress={bodyReady ? onAddPress : undefined}
            onEditDates={bodyReady ? onEditDates : undefined}
            onEditNotes={bodyReady ? onEditNotes : undefined}
            notesExpanded={notesExpanded}
            onNotesExpandedChange={
              bodyReady ? onNotesExpandedChange : undefined
            }
            denseHeroGlass={denseHeroGlass}
          />
          {bodyReady ? (
            <Animated.View
              entering={FadeIn.duration(motion.fade).reduceMotion(
                ReduceMotion.System,
              )}>
              <View style={{ gap: sectionGap }}>
                <TravelTransportSections
                  items={sortedItinerary}
                  transportExpanded={isSectionExpanded('transport')}
                  flightsExpanded={isSectionExpanded('flights')}
                  groundExpanded={isSectionExpanded('ground')}
                  staysExpanded={isSectionExpanded('stays')}
                  rentalsExpanded={isSectionExpanded('rentals')}
                  eventsExpanded={isSectionExpanded('events')}
                  onToggleTransport={() => toggleSection('transport')}
                  onToggleFlights={() => toggleSection('flights')}
                  onToggleGround={() => toggleSection('ground')}
                  onToggleStays={() => toggleSection('stays')}
                  onToggleRentals={() => toggleSection('rentals')}
                  onToggleEvents={() => toggleSection('events')}
                  onAddKind={onAddKind}
                  {...itemEditHandlers}
                />
                <TravelCollapsibleSection
                  title="Timeline"
                  icon="clock"
                  accentColor={travelAccent(theme)}
                  card
                  compact
                  tightHeader
                  flushContent
                  expanded={isSectionExpanded('timeline')}
                  onToggle={() => toggleSection('timeline')}
                  toggleTestID={AgentUiIds.travel.planDetail.timelineSection}
                  titleVariant="subheading">
                  <TravelItineraryTimeline
                    items={sortedItinerary}
                    collapsedDayDates={collapsedDayDates}
                    onToggleDay={onToggleDay}
                    pendingFocusEntryKey={pendingFocusEntryKey}
                    onFocusEntryHandled={onFocusEntryHandled}
                    scrollRef={scrollRef}
                    scrollOffsetYRef={scrollOffsetYRef}
                    {...itemEditHandlers}
                  />
                </TravelCollapsibleSection>
                <TravelPlanTripTools
                  plan={plan}
                  expanded={isSectionExpanded('tools')}
                  onToggle={() => toggleSection('tools')}
                  onOpenExpenses={onOpenExpenses}
                  onAddTransport={() => onAddKind('transport')}
                />
              </View>
            </Animated.View>
          ) : (
            <TravelPlanDetailBodySkeleton
              cardHint={sortedItinerary.length}
            />
          )}
        </Screen>
      </View>
    </TravelArtworkTintProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  transparentScreen: { backgroundColor: 'transparent' },
});
