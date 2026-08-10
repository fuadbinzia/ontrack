import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    AppText,
    Symbol,
    useSafeAreaChrome,
    useSafeAreaChromeOverlay,
} from '@/components/primitives';
import { tripDayCount } from '@/features/travel/date-range';
import { useTravelAtmosphere } from '@/features/travel/travel-atmosphere';
import {
    travelEditorialTextStyle,
    travelOverlineStyle,
} from '@/features/travel/travel-chrome';
import { TravelHeaderFlourish } from '@/features/travel/travel-flight-path-arc';
import { TravelHeaderSkyDecor } from '@/features/travel/travel-header-sky-decor';
import {
    TRAVEL_HEADER_DATES_SKY_OVERLAP,
    TRAVEL_HEADER_DATES_TOP_GAP,
    TRAVEL_HEADER_SKY_CONTENT_BAND,
    TRAVEL_HEADER_SKY_FADE_TAIL,
} from '@/features/travel/travel-header-sky-height';
import { matchCuratedAtmosphereForPlace } from '@/features/travel/travel-home-atmosphere-catalog';
import {
    atmosphereHeaderInkColors,
    resolveAtmosphereHeaderInk,
} from '@/features/travel/travel-home-atmosphere-ink';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import { travelHomeTokens } from '@/features/travel/travel-home-tokens';
import { TravelPlanTitle } from '@/features/travel/travel-plan-title';
import {
    headerSkyChromeColor,
    resolveHeaderSkyCondition,
} from '@/features/travel/travel-sky-condition';
import { travelPageBg } from '@/features/travel/travel-surface';
import { TravelTripDatesRow } from '@/features/travel/travel-trip-dates-row';
import { TravelTripNotesCard } from '@/features/travel/travel-trip-notes-card';
import { tripHeroPlaceName } from '@/features/travel/trip-hero-place';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

function TravelHeroGlassIconButton({
  icon,
  size,
  accessibilityLabel,
  testID,
  onPress,
  /** Overline beside the glass well — whole row is one back hit target. */
  label,
  labelStyle,
}: {
  icon: 'back' | 'add' | 'chat';
  size: number;
  accessibilityLabel: string;
  testID?: string;
  onPress: () => void;
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const dark = theme.name === 'dark';
  const { spacing } = useResponsive();
  // Same frost + ink as Travel Home FABs — never solid `clear` (opaque discs)
  // and never sky-matched white glyphs on white milk.
  const glyph = dark ? theme.textPrimary : travelHomeTokens.colors.ink;
  const handlePress = () => {
    haptics.tap();
    onPress();
  };
  const labeled = Boolean(label);
  return (
    <AgentTestId
      testID={testID}
      label={accessibilityLabel}
      onPress={handlePress}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={handlePress}
        hitSlop={Math.max(6, (44 - size) / 2)}
        style={({ pressed }) => [
          labeled
            ? {
                flexDirection: 'row' as const,
                alignItems: 'center' as const,
                gap: spacing.md,
                flexShrink: 1,
                minWidth: 0,
                opacity: pressed ? 0.72 : 1,
              }
            : {
                width: size,
                height: size,
                borderRadius: size / 2,
                opacity: pressed ? 0.72 : 1,
              },
        ]}>
        <TravelHomeGlass
          airy
          intensity={dark ? 40 : 48}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: dark
              ? undefined
              : travelHomeTokens.colors.circleFabShadow,
          }}>
          <View style={{ zIndex: 1 }}>
            <Symbol name={icon} size="md" color={glyph} />
          </View>
        </TravelHomeGlass>
        {labeled ? (
          <AppText variant="overline" fit style={labelStyle}>
            {label}
          </AppText>
        ) : null}
      </Pressable>
    </AgentTestId>
  );
}

export function TravelPlanHero({
  plan,
  onAddPress,
  onEditDates,
  onEditNotes,
  notesExpanded,
  onNotesExpandedChange,
  /** Denser dates/Notes frost while a flight card is expanded below. */
  denseHeroGlass = false,
  /** False during push entrance — solid chrome only; sky FX mounts after settle. */
  enableSkyDecor = true,
  /** Static-tier still average — itinerary glass tint tracks the photo plate. */
  onPlateAverageColor,
}: {
  plan: TravelPlan;
  onAddPress?: () => void;
  onEditDates?: () => void;
  onEditNotes?: () => void;
  notesExpanded?: boolean;
  onNotesExpandedChange?: (expanded: boolean) => void;
  denseHeroGlass?: boolean;
  enableSkyDecor?: boolean;
  onPlateAverageColor?: (hex: string | undefined) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const atmosphere = useTravelAtmosphere();
  const { s, spacing: rs, typography } = useResponsive();
  const dayCount = tripDayCount(plan.startDate, plan.endDate);
  const placeName = tripHeroPlaceName(plan.destination, plan.title);
  const destination = plan.destination.trim();
  const showPin =
    destination.length > 0 &&
    destination.toLowerCase() !== placeName.toLowerCase();
  const themeDark = theme.name === 'dark';

  // One continuous sky plate on app-shell chrome (status bar + header).
  // Stack content stays transparent over this band so aurora/day washes stay live.
  // Fade tail extends the overlay behind the dates card so sky dissolves into paper.
  const skyContentBand = Math.max(TRAVEL_HEADER_SKY_CONTENT_BAND, s(152));
  const skyFadeTail = Math.max(TRAVEL_HEADER_SKY_FADE_TAIL, s(40));
  const datesSkyOverlap = Math.max(0, s(TRAVEL_HEADER_DATES_SKY_OVERLAP));
  const datesTopGap = Math.max(rs.sm, s(TRAVEL_HEADER_DATES_TOP_GAP));
  const skyChromeHeight = insets.top + skyContentBand + skyFadeTail;
  const statusBandRatio =
    skyChromeHeight > 0 ? insets.top / skyChromeHeight : 0;
  const skyDestination = destination || atmosphere.destination || '';
  const skyCondition = resolveHeaderSkyCondition({
    themeDark,
    timeOfDay: atmosphere.timeOfDay,
    weatherCode: atmosphere.weatherCode,
    timezone: atmosphere.timezone,
    destination: skyDestination,
    latitude: atmosphere.latitude,
  });
  const skyChrome = headerSkyChromeColor({
    themeDark,
    look: skyCondition.look,
    destination: skyDestination,
  });
  // Static-tier destination still may report a richer average than solid chrome.
  const [plateAverageColor, setPlateAverageColor] = useState<
    string | undefined
  >();
  const handlePlateAverageColor = useCallback(
    (hex: string | undefined) => {
      setPlateAverageColor(hex);
      onPlateAverageColor?.(hex);
    },
    [onPlateAverageColor],
  );
  // Same luminance ink as Travel Home — white over night/aurora, black over bright day.
  // Curated midtones (e.g. Guatemala header-band sample) pin dark ink when set.
  const curatedTone = matchCuratedAtmosphereForPlace(skyDestination)[0]
    ?.headerTone;
  const { ink: skyInk, muted: skyInkMuted } = atmosphereHeaderInkColors(
    resolveAtmosphereHeaderInk({
      themeDark,
      averageColor: plateAverageColor ?? skyChrome,
      curatedTone,
    }),
  );
  // Theme paper — sky horizon dissolves into this just below the dates card.
  const pageBase = travelPageBg(theme);
  const backSize = Math.max(32, s(32));
  useSafeAreaChrome(skyChrome, { priority: 1 });
  const skyOverlay = useMemo(
    () =>
      enableSkyDecor ? (
        <TravelHeaderSkyDecor
          destination={skyDestination}
          dateKey={plan.startDate}
          latitude={atmosphere.latitude}
          longitude={atmosphere.longitude}
          timeOfDay={atmosphere.timeOfDay}
          weatherCode={atmosphere.weatherCode}
          timezone={atmosphere.timezone}
          statusBandRatio={statusBandRatio}
          fadeTo={pageBase}
          onPlateAverageColor={handlePlateAverageColor}
        />
      ) : undefined,
    [
      atmosphere.latitude,
      atmosphere.longitude,
      atmosphere.timeOfDay,
      atmosphere.timezone,
      atmosphere.weatherCode,
      enableSkyDecor,
      handlePlateAverageColor,
      pageBase,
      plan.startDate,
      skyDestination,
      statusBandRatio,
    ],
  );
  useSafeAreaChromeOverlay(skyOverlay, skyChromeHeight, { priority: 1 });

  return (
    <View style={[styles.hero, { gap: datesTopGap }]}>
      <View style={[styles.headerBlock, { minHeight: skyContentBand }]}>
        <View style={[styles.titleRow, { gap: rs.md }]}>
          <TravelHeaderFlourish style={styles.headerCopy}>
            <TravelHeroGlassIconButton
              icon="back"
              size={backSize}
              accessibilityLabel="Go Back"
              testID={AgentUiIds.chrome.back}
              label="Itinerary"
              labelStyle={[
                travelOverlineStyle,
                styles.serif,
                {
                  color: skyInkMuted,
                  fontSize: Math.max(12, typography.caption.fontSize),
                  lineHeight: Math.max(16, s(16)),
                },
              ]}
              // Always land on Travel home — never pop to a prior trip in the stack.
              // Guard dismiss: empty-stack POP → dev-only LogBox on Android.
              onPress={() => {
                if (router.canDismiss()) {
                  router.dismissTo('/(tabs)/travel' as Href);
                  return;
                }
                router.replace('/(tabs)/travel' as Href);
              }}
            />
            <View style={{ paddingLeft: backSize + rs.md }}>
              <TravelPlanTitle
                title={placeName}
                fontSize={Math.max(32, s(34))}
                style={{ color: skyInk }}
              />
              {showPin ? (
                <View
                  style={[
                    styles.pinRow,
                    {
                      gap: Math.max(3, rs.xxs),
                      marginTop: Math.max(2, s(2)),
                      paddingRight: Math.max(72, s(80)),
                    },
                  ]}>
                  <Symbol
                    name="location"
                    size={Math.max(12, s(13))}
                    color={skyInkMuted}
                  />
                  <AppText
                    variant="caption"
                    fit
                    numberOfLines={1}
                    style={[
                      styles.serif,
                      styles.pinLabel,
                      {
                        color: skyInkMuted,
                        fontSize: Math.max(13, typography.caption.fontSize),
                        lineHeight: Math.max(17, s(17)),
                      },
                    ]}>
                    {destination}
                  </AppText>
                </View>
              ) : null}
            </View>
          </TravelHeaderFlourish>
          <View style={[styles.headerActions, { gap: rs.sm }]}>
            <TravelHeroGlassIconButton
              icon="chat"
              size={backSize}
              accessibilityLabel={`Open Group Chat for ${plan.title}`}
              testID={AgentUiIds.travel.planDetail.groupChat}
              onPress={() => {
                router.push({
                  pathname: '/travel/[id]/chat',
                  params: { id: plan.id },
                } as never);
              }}
            />
            {onAddPress ? (
              <TravelHeroGlassIconButton
                icon="add"
                size={backSize}
                accessibilityLabel="Add to Timeline"
                testID={AgentUiIds.travel.planDetail.addToTimeline}
                onPress={onAddPress}
              />
            ) : null}
          </View>
        </View>
      </View>

      {/* Float dates on the dissolving sky — one composition, not a hard seam. */}
      <View style={{ marginTop: -datesSkyOverlap, zIndex: 2 }}>
        <TravelTripDatesRow
          startDate={plan.startDate}
          endDate={plan.endDate}
          dayCount={dayCount}
          compact
          denseGlass={denseHeroGlass}
          onPress={onEditDates}
          testID={onEditDates ? AgentUiIds.travel.list.editDates(plan.id) : undefined}
        />
      </View>

      {plan.notes || onEditNotes ? (
        <TravelTripNotesCard
          notes={plan.notes ?? ''}
          toggleTestID={AgentUiIds.travel.planDetail.notesSection}
          editTestID={
            onEditNotes ? AgentUiIds.travel.planDetail.editNotes : undefined
          }
          onEdit={onEditNotes}
          expanded={notesExpanded}
          onExpandedChange={onNotesExpandedChange}
          denseGlass={denseHeroGlass}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
  },
  headerBlock: {
    position: 'relative',
    width: '100%',
    overflow: 'visible',
  },
  titleRow: {
    position: 'relative',
    zIndex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    overflow: 'visible',
    paddingTop: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerCopy: {
    flex: 1,
    zIndex: 1,
  },
  serif: {
    ...travelEditorialTextStyle,
    fontWeight: '400',
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    flexShrink: 1,
  },
  pinLabel: {
    flexShrink: 1,
    minWidth: 0,
  },
});
