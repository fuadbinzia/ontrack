import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Symbol } from '@/components/primitives';

import {
  atmosphereHeaderInkColors,
  type TravelAtmosphereHeaderInk,
} from '@/features/travel/travel-home-atmosphere-ink';
import { wrapAtmosphereLocationCaption } from '@/features/travel/travel-home-atmosphere-location';
import { TravelHomeAtmosphereText } from '@/features/travel/travel-home-atmosphere-text';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import {
  TravelHomePlusIcon,
  TravelHomeRouteFlourish,
} from '@/features/travel/travel-home-icons';
import {
  travelHomeFontFamily,
  travelHomeTokens,
} from '@/features/travel/travel-home-tokens';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

type TravelHomeHeaderProps = {
  onAddTrip?: () => void;
  onOpenMap?: () => void;
  /** Atmosphere plate place caption when known. */
  locationLabel?: string;
  /** Plate-aware header ink (`light` = white over dark washes). */
  headerInk?: TravelAtmosphereHeaderInk;
  style?: StyleProp<ViewStyle>;
};

/** Compact Travel Home header — title, tagline, route motif, FAB +. */
export function TravelHomeHeader({
  onAddTrip,
  onOpenMap,
  locationLabel,
  headerInk = 'light',
  style,
}: TravelHomeHeaderProps) {
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  const dark = theme.name === 'dark';
  // Default white over photo; only flip to black when the plate sample is bright.
  const effectiveInk = dark ? 'light' : headerInk;
  const { ink, muted } = atmosphereHeaderInkColors(effectiveInk);
  const brand = dark ? theme.accentPrimary : travelHomeTokens.colors.brandBlue;
  const addVisual = Math.max(44, s(travelHomeTokens.sizes.addButton));
  const addHit = Math.max(travelHomeTokens.sizes.touchTargetMin, addVisual);
  const mapVisual = Math.max(42, s(44));
  const mapHit = Math.max(travelHomeTokens.sizes.touchTargetMin, mapVisual);
  const titleSize = Math.max(42, s(travelHomeTokens.sizes.displayTitle));
  const taglineSize = Math.max(13, s(travelHomeTokens.type.heroTagline));
  const locationSize = Math.max(12, s(12));
  const titleToTagline = Math.max(6, s(travelHomeTokens.type.titleToTaglineGap));
  const captionSpoken = locationLabel?.replace(/\s+/g, ' ').trim();
  const caption = captionSpoken
    ? wrapAtmosphereLocationCaption(captionSpoken)
    : undefined;
  const locationLines = caption ? caption.split('\n').length : 0;
  const taglineLineHeight = Math.round(taglineSize * 1.28);
  const locationLineHeight = Math.round(locationSize * 1.28);
  /** Long place names wrap to two lines beside the tagline. */
  const taglineRowMinHeight = locationLines > 0
    ? Math.max(taglineLineHeight, locationLineHeight * locationLines)
    : taglineLineHeight;
  /** Clear air between trail tip and the add FAB. */
  const trailButtonGap = Math.max(12, s(14));
  /** Keep the plane off the title ink — shortens the flex trail. */
  const titlePlaneGap = Math.max(14, s(18));
  const planeSize = Math.max(30, s(34));
  /** Tall enough for the kit mock S (trough + crest) without vertical crush. */
  const flourishHeight = Math.max(40, s(44));
  /**
   * Title allows Dynamic Type up to 1.15× — line box must clear the scaled
   * serif caps or iOS clips the top of “Travel” (and the row/FAB with it).
   */
  const titleMaxMultiplier = 1.15;
  const titleLineHeight = Math.round(titleSize * titleMaxMultiplier * 1.12);
  const [flourishWidth, setFlourishWidth] = useState(0);

  const rootStyle = [
    styles.root,
    {
      gap: Math.max(2, rs.xs - 1),
      // Keep the first ink/FAB below the ScrollView clip edge.
      paddingTop: Math.max(4, rs.xs),
      paddingBottom: travelHomeTokens.spacing.headerBottom,
    },
    style,
  ];

  const content = (
    <>
      <View style={styles.topRow}>
        <TravelHomeAtmosphereText
          allowFontScaling
          maxFontSizeMultiplier={titleMaxMultiplier}
          numberOfLines={1}
          containerStyle={styles.titleWrap}
          style={{
            color: ink,
            fontFamily: travelHomeFontFamily,
            fontSize: titleSize,
            lineHeight: titleLineHeight,
            fontWeight: '400',
            letterSpacing: 0,
            includeFontPadding: false,
          }}>
          Travel
        </TravelHomeAtmosphereText>

        <View
          pointerEvents="none"
          onLayout={(event) => {
            const next = Math.round(event.nativeEvent.layout.width);
            if (next > 0 && next !== flourishWidth) setFlourishWidth(next);
          }}
          style={[
            styles.motifBand,
            {
              height: flourishHeight,
              marginLeft: titlePlaneGap,
              marginRight: onAddTrip || onOpenMap ? trailButtonGap : 0,
            },
          ]}>
          {flourishWidth > 0 ? (
            <TravelHomeRouteFlourish
              width={flourishWidth}
              planeSize={planeSize}
              height={flourishHeight}
              color={travelHomeTokens.colors.motifTan}
            />
          ) : null}
        </View>

        {onOpenMap ? (
          <AgentTestId
            testID={AgentUiIds.travel.map.open}
            label="Open travel atlas"
            onPress={() => {
              haptics.tap();
              onOpenMap();
            }}
            style={[styles.addWrap, { width: mapHit, height: mapHit, marginRight: 6 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open travel atlas"
              onPress={() => {
                haptics.tap();
                onOpenMap();
              }}
              hitSlop={4}
              style={({ pressed }) => [
                styles.addButton,
                {
                  width: mapVisual,
                  height: mapVisual,
                  borderRadius: mapVisual / 2,
                  opacity: pressed ? 0.84 : 1,
                },
              ]}>
              <TravelHomeGlass
                intensity={dark ? 44 : 56}
                style={{
                  width: mapVisual,
                  height: mapVisual,
                  borderRadius: mapVisual / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: dark ? undefined : travelHomeTokens.colors.circleFabShadow,
                }}>
                <Symbol name="atlas" size={Math.max(19, s(21))} color={dark ? brand : travelHomeTokens.colors.ink} />
              </TravelHomeGlass>
            </Pressable>
          </AgentTestId>
        ) : null}

        {onAddTrip ? (
          <AgentTestId
            testID={AgentUiIds.travel.newTrip.open}
            label="Add trip"
            onPress={() => {
              haptics.tap();
              onAddTrip();
            }}
            style={[styles.addWrap, { width: addHit, height: addHit }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add trip"
              onPress={() => {
                haptics.tap();
                onAddTrip();
              }}
              hitSlop={4}
              style={({ pressed }) => [
                styles.addButton,
                {
                  width: addVisual,
                  height: addVisual,
                  borderRadius: addVisual / 2,
                  opacity: pressed ? 0.84 : 1,
                },
              ]}>
              <TravelHomeGlass
                intensity={dark ? 44 : 56}
                style={{
                  width: addVisual,
                  height: addVisual,
                  borderRadius: addVisual / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: dark
                    ? undefined
                    : travelHomeTokens.colors.circleFabShadow,
                }}>
                <TravelHomePlusIcon
                  size={Math.max(18, s(20))}
                  color={dark ? brand : travelHomeTokens.colors.ink}
                />
              </TravelHomeGlass>
            </Pressable>
          </AgentTestId>
        ) : null}
      </View>

      <View
        style={[
          styles.taglineRow,
          {
            marginTop: titleToTagline,
            gap: Math.max(8, s(10)),
            minHeight: taglineRowMinHeight,
          },
        ]}>
        <TravelHomeAtmosphereText
          allowFontScaling
          maxFontSizeMultiplier={1.15}
          numberOfLines={1}
          containerStyle={styles.taglineWrap}
          style={{
            color: muted,
            fontFamily: travelHomeFontFamily,
            fontSize: taglineSize,
            lineHeight: taglineLineHeight,
            fontWeight: '400',
            letterSpacing: 0,
            includeFontPadding: false,
          }}>
          Plan. Explore. Remember.
        </TravelHomeAtmosphereText>

        {caption ? (
          <AgentTestId
            testID={AgentUiIds.travel.list.atmosphereLocation}
            style={styles.locationSlot}>
            <TravelHomeAtmosphereText
              accessibilityRole="text"
              accessibilityLabel={`Atmosphere location, ${captionSpoken}`}
              allowFontScaling
              maxFontSizeMultiplier={1.15}
              numberOfLines={2}
              containerStyle={styles.locationTextWrap}
              style={{
                color: muted,
                fontFamily: travelHomeFontFamily,
                fontSize: locationSize,
                lineHeight: locationLineHeight,
                fontWeight: '400',
                letterSpacing: 0.15,
                includeFontPadding: false,
                textAlign: 'right',
              }}>
              {caption}
            </TravelHomeAtmosphereText>
          </AgentTestId>
        ) : null}
      </View>
    </>
  );

  return <View style={rootStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  titleWrap: {
    flexShrink: 0,
    zIndex: 1,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  taglineWrap: {
    flexShrink: 0,
  },
  locationSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  locationTextWrap: {
    width: '100%',
  },
  motifBand: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  addWrap: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
