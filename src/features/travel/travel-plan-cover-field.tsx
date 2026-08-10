import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, GlassIconWell, Symbol } from '@/components/primitives';
import { fontFamilies } from '@/design-system';
import {
    TRIP_COVER_UPLOAD_MAX,
    fetchDestinationCoverUri,
    localTripCoverUri,
} from '@/features/travel/destination-cover';
import { TravelAddPhotosModal } from '@/features/travel/travel-add-photos-modal';
import { itinerarySheetChrome } from '@/features/travel/travel-itinerary-sheet-chrome';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { pickCameraImage, pickLibraryImages } from '@/utils/pick-image';

/** Cover thumbnail control used while editing trip details (up to 3 uploads). */
export function TravelPlanCoverField({
  plan,
  coverUris,
  onCoverUrisChange,
  /** DEV: open the Trip Cover Photo modal on mount for simulator QA. */
  initialPickerOpen = false,
}: {
  plan: TravelPlan;
  coverUris: string[];
  onCoverUrisChange: (uris: string[]) => void;
  initialPickerOpen?: boolean;
}) {
  const theme = useTheme();
  const chrome = itinerarySheetChrome(theme);
  const { s, spacing: rs } = useResponsive();
  const size = Math.max(72, s(76));
  const thumb = Math.max(64, s(68));
  const localFallback = localTripCoverUri({
    ...plan,
    coverUri: undefined,
    coverUris: undefined,
  });
  const [remoteFallback, setRemoteFallback] = useState<{
    key: string;
    uri?: string;
  }>({ key: `${plan.id}:${plan.destination}:${plan.title}` });
  const [pickerVisible, setPickerVisible] = useState(initialPickerOpen);
  const destinationKey = `${plan.id}:${plan.destination}:${plan.title}`;
  const slotsLeft = Math.max(0, TRIP_COVER_UPLOAD_MAX - coverUris.length);
  const preview =
    coverUris[0] ??
    localFallback ??
    (remoteFallback.key === destinationKey ? remoteFallback.uri : undefined);

  useEffect(() => {
    if (coverUris.length > 0 || localFallback) return;
    let active = true;
    void fetchDestinationCoverUri({
      ...plan,
      coverUri: undefined,
      coverUris: undefined,
    }).then((uri) => {
      if (active) setRemoteFallback({ key: destinationKey, uri });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- destinationKey covers plan fields used for remote covers
  }, [coverUris.length, localFallback, destinationKey]);

  const appendUris = (uris: string[]) => {
    if (!uris.length || slotsLeft <= 0) return;
    const next = [...coverUris];
    for (const uri of uris) {
      if (next.length >= TRIP_COVER_UPLOAD_MAX) break;
      const trimmed = uri.trim();
      if (!trimmed || next.includes(trimmed)) continue;
      next.push(trimmed);
    }
    onCoverUrisChange(next);
  };

  const chooseLibrary = async () => {
    if (slotsLeft <= 0) return;
    const assets = await pickLibraryImages({
      allowsMultipleSelection: true,
      selectionLimit: slotsLeft,
      quality: 0.9,
    });
    if (assets?.length) appendUris(assets.map((asset) => asset.uri));
  };

  const chooseCamera = async () => {
    if (slotsLeft <= 0) return;
    const uri = await pickCameraImage({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (uri) appendUris([uri]);
  };

  const openPicker = () => {
    if (slotsLeft <= 0) return;
    haptics.tap();
    setPickerVisible(true);
  };
  const coverAgent = useAgentUiTarget(AgentUiIds.travel.editTrip.cover, {
    label: 'Add trip cover photos',
    onPress: openPicker,
  });

  return (
    <>
      <View style={{ gap: rs.md }}>
        <Pressable
          ref={coverAgent.ref}
          accessibilityRole="button"
          accessibilityLabel="Add trip cover photos"
          testID={coverAgent.testID}
          onLayout={coverAgent.onLayout}
          onPress={openPicker}
          style={({ pressed }) => [
            styles.row,
            { gap: rs.md, opacity: pressed ? 0.78 : 1 },
          ]}>
          {preview && coverUris.length === 0 ? (
            <View
              style={[
                styles.thumb,
                {
                  width: size,
                  height: size,
                  borderRadius: Math.max(16, s(16)),
                },
              ]}>
              <Image
                source={{ uri: preview }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                recyclingKey={preview}
              />
            </View>
          ) : coverUris.length === 0 ? (
            <GlassIconWell size={size} borderRadius={Math.max(16, s(16))}>
              <Symbol name="flight" size="md" color={chrome.icons.flight.fg} />
            </GlassIconWell>
          ) : null}
          <View style={styles.copy}>
            <AppText
              style={[
                styles.label,
                {
                  color: chrome.title,
                  fontSize: s(17),
                  lineHeight: s(22),
                },
              ]}
              fit
              numberOfLines={1}>
              Cover Photos
            </AppText>
            <AppText
              variant="caption"
              style={[styles.description, { color: chrome.subtitle }]}
              numberOfLines={2}>
              Up to {TRIP_COVER_UPLOAD_MAX}. Shown on your trip card.
            </AppText>
          </View>
        </Pressable>

        {coverUris.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.photoStrip, { gap: rs.sm }]}>
            {coverUris.map((uri, index) => (
              <CoverThumb
                key={`${uri}:${index}`}
                uri={uri}
                index={index}
                size={thumb}
                onRemove={() => {
                  haptics.tap();
                  onCoverUrisChange(coverUris.filter((_, i) => i !== index));
                }}
              />
            ))}
          </ScrollView>
        ) : null}

        {slotsLeft > 0 ? (
          <Button
            variant="secondary"
            icon="photo"
            testID={AgentUiIds.travel.editTrip.addCover}
            accessibilityLabel={
              coverUris.length ? 'Add more cover photos' : 'Add cover photos'
            }
            onPress={openPicker}>
            {coverUris.length ? 'Add More Photos' : 'Add Photos'}
          </Button>
        ) : null}
      </View>

      <TravelAddPhotosModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="Trip Cover Photos"
        subtitle={`Up to ${TRIP_COVER_UPLOAD_MAX}. Shown on your trip card.`}
        onTakePhoto={() => {
          void chooseCamera();
        }}
        onChooseFromPhotos={() => {
          void chooseLibrary();
        }}
        onRemovePhoto={
          coverUris.length === 1
            ? () => onCoverUrisChange([])
            : undefined
        }
        removeLabel="Remove Cover Photo"
      />
    </>
  );
}

function CoverThumb({
  uri,
  index,
  size,
  onRemove,
}: {
  uri: string;
  index: number;
  size: number;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const agent = useAgentUiTarget(AgentUiIds.travel.editTrip.removeCover(index), {
    label: `Remove cover photo ${index + 1}`,
    onPress: onRemove,
  });
  return (
    <View style={[styles.photoWrap, { width: size, height: size }]}>
      <Image
        source={{ uri }}
        style={styles.photo}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <Pressable
        ref={agent.ref}
        accessibilityRole="button"
        accessibilityLabel={`Remove cover photo ${index + 1}`}
        testID={agent.testID}
        onLayout={agent.onLayout}
        hitSlop={6}
        onPress={onRemove}
        style={[styles.photoRemove, { backgroundColor: theme.overlayScrim }]}>
        <Symbol name="close" size="sm" color={theme.textOnAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: {
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    fontFamily: fontFamilies.serif,
    fontWeight: '600',
  },
  description: {
    fontFamily: fontFamilies.serif,
    fontWeight: '600',
  },
  photoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoWrap: {
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
