import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type DimensionValue } from 'react-native';

import { GlassIconWell, Symbol } from '@/components/primitives';
import {
    fetchDestinationCoverUri,
    localTripCoverUri,
} from '@/features/travel/destination-cover';
import { itinerarySheetChrome } from '@/features/travel/travel-itinerary-sheet-chrome';
import { travelPlanModeIcon } from '@/features/travel/travel-mode';
import { TravelPhotoLightbox } from '@/features/travel/travel-photo-lightbox';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

/** Trip thumbnail — moment photo, destination landscape, or flight fallback. */
export function TravelTripCover({
  plan,
  width,
  height,
  borderRadius,
  expandable = true,
  onOpen,
}: {
  plan: TravelPlan;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  /** False when a parent card already owns the tap gesture. */
  expandable?: boolean;
  onOpen?: () => void;
}) {
  const theme = useTheme();
  const chrome = itinerarySheetChrome(theme);
  const flightTone = chrome.icons.flight;
  const { s } = useResponsive();
  const size = Math.max(88, s(96));
  const resolvedRadius = borderRadius ?? Math.max(16, s(18));
  const localUri = localTripCoverUri(plan);
  const [uri, setUri] = useState<string | undefined>(localUri);
  const [expanded, setExpanded] = useState(false);
  const destinationKey = `${plan.id}:${plan.destination}:${plan.title}`;
  const coverSize = {
    width: width ?? size,
    height: height ?? size,
  };

  useEffect(() => {
    let active = true;
    if (localUri) {
      // Custom/persisted cover must replace any previously fetched destination image.
      setUri(localUri);
      return () => {
        active = false;
      };
    }
    // Key on destination fields only — `plan` identity churn (weather/sync) must not abort.
    void fetchDestinationCoverUri(plan).then((next) => {
      if (active) setUri(next);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- destinationKey covers plan fields used for remote covers
  }, [destinationKey, localUri]);

  const cover = uri ? (
    <View
      style={[
        styles.cover,
        coverSize,
        { borderRadius: resolvedRadius },
      ]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={180}
        recyclingKey={uri}
      />
    </View>
  ) : (
    <GlassIconWell
      size={typeof coverSize.width === 'number' ? coverSize.width : size}
      borderRadius={resolvedRadius}
      style={[styles.cover, coverSize]}>
      <Symbol
        name={travelPlanModeIcon(plan.mode ?? 'flight')}
        size="md"
        color={flightTone.fg}
      />
    </GlassIconWell>
  );

  const open = () => {
    if (!uri) return;
    onOpen?.();
    haptics.tap();
    setExpanded(true);
  };
  const close = () => setExpanded(false);
  const coverLabel = `View ${plan.title} photo`;

  return (
    <>
      {expandable && uri ? (
        <AgentTestId
          testID={AgentUiIds.travel.list.cover(plan.id)}
          label={coverLabel}
          onPress={open}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={coverLabel}
            onPress={open}
            style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : undefined]}>
            {cover}
          </Pressable>
        </AgentTestId>
      ) : (
        cover
      )}
      <TravelPhotoLightbox
        uri={uri}
        visible={expanded}
        viewerKey={plan.id}
        onClose={close}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cover: {
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  pressable: { flexShrink: 0 },
  pressed: { opacity: 0.72 },
});
