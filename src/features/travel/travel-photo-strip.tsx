import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassPlate, Symbol } from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { isLoadableTravelPhotoUri } from '@/features/travel/travel-moment-media';
import { TravelPhotoLightbox } from '@/features/travel/travel-photo-lightbox';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { resolveCloudMediaUri } from '@/services/cloud/media';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

type StripEntry = {
  /** Stable store / agent key (may be an `ontrack-media:` marker). */
  source: string;
  /** URI safe to feed expo-image. */
  display: string;
};

/** Timeline moment photos — glass underlay, drop dead URIs, placeholder on paint fail. */
export function PhotoStrip({
  uris,
  viewerKey,
}: {
  uris: string[];
  /** Stable key for photo open / lightbox agent ids (usually item id). */
  viewerKey: string;
}) {
  const theme = useTheme();
  const { s } = useResponsive();
  const size = Math.max(72, s(88));
  const [viewUri, setViewUri] = useState<string | undefined>();
  const [entries, setEntries] = useState<StripEntry[]>(() =>
    syncStripEntries(uris),
  );
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [painted, setPainted] = useState<Record<string, true>>({});

  const urisKey = uris.join('\0');
  useEffect(() => {
    let cancelled = false;
    const nextUris = urisKey ? urisKey.split('\0') : [];
    setFailed({});
    setPainted({});
    setEntries(syncStripEntries(nextUris));

    const cloud = nextUris.filter((uri) => uri.startsWith('ontrack-media:'));
    if (!cloud.length) return;

    void (async () => {
      const resolved = new Map<string, string>();
      for (const uri of cloud) {
        try {
          const display = await resolveCloudMediaUri(uri);
          if (isLoadableTravelPhotoUri(display)) resolved.set(uri, display);
        } catch {
          // Drop markers that cannot mint a paint URL.
        }
      }
      if (cancelled) return;
      setEntries(
        nextUris.flatMap((uri) => {
          if (uri.startsWith('ontrack-media:')) {
            const display = resolved.get(uri);
            return display ? [{ source: uri, display }] : [];
          }
          return isLoadableTravelPhotoUri(uri)
            ? [{ source: uri, display: uri }]
            : [];
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [urisKey]);

  if (!entries.length) return null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photoStrip}
        style={styles.photoStripScroll}>
        {entries.map((entry, index) => {
          const broken = Boolean(failed[entry.display]);
          const openLabel = broken ? 'Photo unavailable' : 'View photo';
          const openPhoto = () => {
            if (broken || !painted[entry.display]) return;
            haptics.tap();
            setViewUri(entry.display);
          };
          return (
            <View
              key={entry.source}
              style={[styles.photoWrap, { width: size, height: size }]}>
              <GlassPlate mist style={styles.photoPlate} />
              {broken ? (
                <View
                  accessibilityRole="image"
                  accessibilityLabel={openLabel}
                  style={styles.photoUnavailable}>
                  <Symbol name="photo" size="md" color={theme.textTertiary} />
                </View>
              ) : (
                <AgentTestId
                  testID={AgentUiIds.travel.timelineItem.photo(viewerKey, index)}
                  label={openLabel}
                  onPress={openPhoto}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={openLabel}
                    onPress={openPhoto}
                    style={({ pressed }) => [
                      styles.photo,
                      pressed ? styles.photoPressed : undefined,
                    ]}>
                    <Image
                      source={{ uri: entry.display }}
                      style={styles.photo}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      recyclingKey={`moment-photo:${entry.source}`}
                      onLoad={() =>
                        setPainted((prev) =>
                          prev[entry.display]
                            ? prev
                            : { ...prev, [entry.display]: true },
                        )
                      }
                      onError={() =>
                        setFailed((prev) =>
                          prev[entry.display]
                            ? prev
                            : { ...prev, [entry.display]: true },
                        )
                      }
                    />
                  </Pressable>
                </AgentTestId>
              )}
            </View>
          );
        })}
      </ScrollView>
      <TravelPhotoLightbox
        uri={viewUri}
        visible={Boolean(viewUri)}
        viewerKey={viewerKey}
        onClose={() => setViewUri(undefined)}
      />
    </>
  );
}

function syncStripEntries(uris: string[]): StripEntry[] {
  return uris.flatMap((uri) => {
    if (uri.startsWith('ontrack-media:')) return [];
    return isLoadableTravelPhotoUri(uri)
      ? [{ source: uri, display: uri }]
      : [];
  });
}

const styles = StyleSheet.create({
  photoStripScroll: { alignSelf: 'stretch' },
  // flexGrow + center keeps a short strip centered; multi-photo still scrolls.
  photoStrip: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  photoWrap: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  photoPlate: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.md,
  },
  photo: { width: '100%', height: '100%' },
  photoPressed: { opacity: 0.72 },
  photoUnavailable: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
