import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
} from 'react-native-reanimated';

import {
    fetchDestinationHeroUris,
    uploadedTripCoverUris,
} from '@/features/travel/destination-cover';
import { peekUnsplashCoverColor } from '@/features/travel/destination-cover-lookup';
import { travelHomeFixtureHeroSource } from '@/features/travel/fixtures/travel-home';
import {
    travelHomeAtmosphereSource,
} from '@/features/travel/travel-home-background';
import { TravelHomeCarouselStepper } from '@/features/travel/travel-home-carousel-stepper';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';
import {
    travelHomeHeroContentPosition,
    travelHomeHeroOverscanStyle,
} from '@/features/travel/travel-home-hero-focus';
import { TravelHomeEditIcon } from '@/features/travel/travel-home-icons';
import {
    travelHomeImageHeight,
    travelHomeTokens,
} from '@/features/travel/travel-home-tokens';
import type { TravelPlan } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

type TravelHomeHeroCarouselProps = {
  plan: TravelPlan;
  width: number;
  onEdit: () => void;
  onActiveImageChange?: (
    uri: string | undefined,
    index: number,
    pageCount: number,
  ) => void;
};

/** Horizontal paging hero (1–3 images) with edit control + page ticks. */
export function TravelHomeHeroCarousel({
  plan,
  width,
  onEdit,
  onActiveImageChange,
}: TravelHomeHeroCarouselProps) {
  const theme = useTheme();
  const { s } = useResponsive();
  const { width: windowWidth } = useWindowDimensions();
  const heroWidth = Math.max(1, Math.min(width, windowWidth));
  const height = travelHomeImageHeight(heroWidth);
  /** Drive ticks from this carousel — avoid parent page-count lag until swipe. */
  const scrollProgress = useSharedValue(0);
  const stepperTop = Math.max(10, s(travelHomeTokens.sizes.carouselBottomInset + 4));
  /**
   * Bump when uploaded covers or destination identity change so Fast Refresh /
   * warm screens drop stale plates.
   */
  const uploadedKey = uploadedTripCoverUris(plan).join('|');
  const destinationKey = `cover-v13:${plan.id}:${plan.destination}:${plan.title}:${uploadedKey}`;
  const fixtureSource =
    __DEV__ ? travelHomeFixtureHeroSource(plan.id) : undefined;
  const fallbackSource = travelHomeAtmosphereSource(theme.name);
  /**
   * Carousel pages: user uploads when present, else a rotating live destination
   * trio. Scenic underlay is loading/miss only — never a stand-in carousel page.
   */
  const [uris, setUris] = useState<string[]>([]);
  const [failedUris, setFailedUris] = useState<Record<string, true>>({});
  /** URI that has fired expo-image `onLoad` — not merely been requested. */
  const [paintedRemoteUri, setPaintedRemoteUri] = useState<string | undefined>();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const destinationLabel = plan.destination.trim() || plan.title;
  const visibleUris = uris.filter((uri) => !failedUris[uri]);
  const pageWidth = heroWidth;
  // Hide fixture/fallback only after a hero plate actually paints. URI
  // presence alone left Android on brandBlueSoft while proxies were mid-load
  // or silent-failed without onError.
  const hasPaintedRemote = Boolean(
    paintedRemoteUri && visibleUris.includes(paintedRemoteUri),
  );

  // Clear only when the trip/cover identity changes — keep the prior trio
  // painted while focus re-picks a rotated set from the landmark pool.
  useEffect(() => {
    setIndex(0);
    setUris([]);
    setFailedUris({});
    setPaintedRemoteUri(undefined);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [destinationKey, fixtureSource]);

  // Uploads win; otherwise rotate live destination landmark photos each focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const uploaded = uploadedTripCoverUris(plan);
      if (uploaded.length > 0) {
        setFailedUris({});
        setUris(uploaded);
        setIndex(0);
        scrollProgress.value = 0;
        onActiveImageChange?.(uploaded[0], 0, uploaded.length);
        if (uploaded[1]) {
          void Image.prefetch(uploaded[1]).catch(() => undefined);
        }
        return () => {
          active = false;
        };
      }

      // Fixture/atmosphere underlay while remotes load (and if they miss).
      const cancel = deferAfterPageTransition(() => {
        void fetchDestinationHeroUris(plan, undefined, { salt: Date.now() }).then(
          (next) => {
            if (!active || next.length === 0) return;
            setFailedUris({});
            setUris(next);
            setIndex(0);
            scrollProgress.value = 0;
            onActiveImageChange?.(next[0], 0, next.length);
            if (next[1]) {
              void Image.prefetch(next[1]).catch(() => undefined);
            }
          },
        );
      });
      return () => {
        active = false;
        cancel();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- destinationKey covers plan fields
    }, [destinationKey, fixtureSource]),
  );

  useEffect(() => {
    // Empty uris = still loading / cleared for a refetch. Leave the parent's
    // page count alone (trip card resets on plan.id) so ticks don't vanish.
    if (visibleUris.length === 0) return;
    const nextIndex = Math.min(index, visibleUris.length - 1);
    if (nextIndex !== index) setIndex(nextIndex);
    scrollRef.current?.scrollTo({ x: nextIndex * heroWidth, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to failure/uri changes
  }, [failedUris, uris, heroWidth]);

  // Publish page count before paint so glass ticks show without waiting for a swipe.
  useLayoutEffect(() => {
    if (visibleUris.length === 0) return;
    const nextIndex = Math.min(index, visibleUris.length - 1);
    onActiveImageChange?.(
      visibleUris[nextIndex],
      nextIndex,
      visibleUris.length,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirror pager to parent
  }, [visibleUris.length, index, failedUris, uris]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (pageWidth <= 0) return;
      scrollProgress.value = event.contentOffset.x / pageWidth;
    },
  });

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / heroWidth);
    const clamped = Math.max(0, Math.min(visibleUris.length - 1, next));
    setIndex(clamped);
    scrollProgress.value = clamped;
    onActiveImageChange?.(
      visibleUris[clamped],
      clamped,
      visibleUris.length,
    );
    const prefetchUri = visibleUris[clamped + 1];
    if (prefetchUri) {
      void Image.prefetch(prefetchUri).catch(() => undefined);
    }
  };

  const editVisual = Math.max(40, s(travelHomeTokens.sizes.editButton));
  const editHit = Math.max(
    Platform.OS === 'android'
      ? travelHomeTokens.sizes.touchTargetMinAndroid
      : travelHomeTokens.sizes.touchTargetMin,
    editVisual,
  );
  const editInset = Math.max(10, s(travelHomeTokens.spacing.editInset));
  const heroSurface =
    theme.name === 'dark'
      ? theme.backgroundSunken
      : travelHomeTokens.colors.brandBlueSoft;

  const heroTopRadius = travelHomeTokens.radius.heroTop;
  const imageRadiusStyle = {
    borderTopLeftRadius: heroTopRadius,
    borderTopRightRadius: heroTopRadius,
  } as const;

  const scrollInteractive = hasPaintedRemote && visibleUris.length > 1;
  // Keep ScrollView mounted with stable index-keyed page shells. Slot count
  // tracks visible URIs (min 1 placeholder) so users can't page into blanks.
  const heroPageSlots = Math.max(1, visibleUris.length);
  const scenicUnderlay = fixtureSource ?? fallbackSource;

  return (
    <View
      collapsable={false}
      style={[
        styles.hero,
        imageRadiusStyle,
        {
          width: heroWidth,
          height,
          backgroundColor: heroSurface,
        },
      ]}>
      {/*
        Hero Fabric children are ONLY Views (media → edit → dots). expo-image as
        a direct sibling was unmounting out of sync and SIGABRTing
        `unmountChildComponentView` on this 362×199 plate. Images stay nested
        inside the non-collapsible media slot; ScrollView stays mounted.
      */}
      <View
        collapsable={false}
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, imageRadiusStyle, { backgroundColor: heroSurface }]}>
        {/*
          Remotes stay at full opacity underneath so iOS expo-image can decode
          and fire onLoad. Hiding this ScrollView at opacity 0 until paint
          deadlocked iOS: steppers showed (URI count) but onLoad never ran,
          so the scenic plate + scroll lock stuck forever.
        */}
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={scrollInteractive}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          onMomentumScrollEnd={onScrollEnd}
          scrollEventThrottle={16}
          style={[StyleSheet.absoluteFill, imageRadiusStyle]}
          pointerEvents={hasPaintedRemote ? 'auto' : 'none'}
          accessibilityElementsHidden={!hasPaintedRemote}
          importantForAccessibility={
            hasPaintedRemote ? 'yes' : 'no-hide-descendants'
          }
          accessibilityRole="adjustable"
          accessibilityLabel={`${destinationLabel} destination photos`}
          accessibilityValue={{
            min: 1,
            max: Math.max(1, visibleUris.length),
            now: index + 1,
            text:
              visibleUris.length > 0
                ? `Photo ${index + 1} of ${visibleUris.length}`
                : 'Loading destination photos',
          }}>
          {Array.from({ length: heroPageSlots }, (_, pageIndex) => {
            const uri = visibleUris[pageIndex];
            return (
              <View
                key={`hero-page-${pageIndex}`}
                collapsable={false}
                style={[styles.heroPage, { width: heroWidth, height }]}>
                <Image
                  source={uri ? { uri } : fallbackSource}
                  style={[
                    imageRadiusStyle,
                    travelHomeHeroOverscanStyle(heroWidth, height),
                    {
                      backgroundColor: heroSurface,
                      opacity: uri ? 1 : 0,
                    },
                  ]}
                  contentFit="cover"
                  // Short hero crops empty into sky unless we bias downward;
                  // bright Unsplash averages escalate the pull-up.
                  contentPosition={travelHomeHeroContentPosition(
                    uri ? peekUnsplashCoverColor(uri) : undefined,
                  )}
                  transition={uri ? 180 : 0}
                  recyclingKey={uri ?? `hero-page-empty-${pageIndex}`}
                  accessible={false}
                  importantForAccessibility="no"
                  onLoad={() => {
                    if (!uri) return;
                    setPaintedRemoteUri((previous) => previous ?? uri);
                  }}
                  onError={() => {
                    if (!uri) return;
                    setFailedUris((previous) =>
                      previous[uri] ? previous : { ...previous, [uri]: true },
                    );
                    setPaintedRemoteUri((previous) =>
                      previous === uri ? undefined : previous,
                    );
                  }}
                />
              </View>
            );
          })}
        </Animated.ScrollView>
        {/*
          Scenic cover on top until a hero plate paints. Never key this off
          URI presence alone — Android used to flash brandBlueSoft while
          proxies were mid-load / silent-fail. pointerEvents none so the
          underlay never steals the edit FAB hit target.
        */}
        <Image
          source={scenicUnderlay}
          style={[
            styles.fallback,
            imageRadiusStyle,
            travelHomeHeroOverscanStyle(heroWidth, height),
            {
              backgroundColor: heroSurface,
              zIndex: 2,
              opacity: hasPaintedRemote ? 0 : 1,
            },
          ]}
          contentFit="cover"
          contentPosition={travelHomeHeroContentPosition()}
          transition={180}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no"
        />
      </View>

      {/*
        Absolute layout lives on this View (not only AgentTestId) so the pencil
        FAB stays pinned in production, where AgentTestId may skip its registry
        wrapper when style is omitted.
      */}
      <View
        collapsable={false}
        pointerEvents="box-none"
        style={[
          styles.editWrap,
          {
            top: editInset,
            right: editInset,
            width: editHit,
            height: editHit,
          },
        ]}>
        <AgentTestId
          testID={AgentUiIds.travel.list.editTrip(plan.id)}
          label={`Edit ${destinationLabel} trip`}
          onPress={() => {
            haptics.tap();
            onEdit();
          }}
          style={styles.editHit}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${destinationLabel} trip`}
            onPress={() => {
              haptics.tap();
              onEdit();
            }}
            hitSlop={4}
            style={({ pressed }) => [
              styles.editButton,
              {
                width: editVisual,
                height: editVisual,
                borderRadius: editVisual / 2,
                opacity: pressed ? 0.72 : 1,
              },
            ]}>
            <TravelHomeGlass
              intensity={theme.name === 'dark' ? 44 : 56}
              style={{
                width: editVisual,
                height: editVisual,
                borderRadius: editVisual / 2,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  theme.name === 'dark'
                    ? undefined
                    : travelHomeTokens.colors.circleFabShadow,
              }}>
              <TravelHomeEditIcon
                size={Math.max(16, s(18))}
                color={
                  theme.name === 'dark'
                    ? theme.textPrimary
                    : travelHomeTokens.colors.ink
                }
              />
            </TravelHomeGlass>
          </Pressable>
        </AgentTestId>
      </View>

      {/*
        Page ticks live here (not on the trip card) so count comes from
        visibleUris synchronously — parent heroPager used to lag until swipe.
      */}
      <View
        collapsable={false}
        pointerEvents="none"
        style={[styles.stepperOverlay, { top: stepperTop }]}>
        <TravelHomeCarouselStepper
          // Match scrollInteractive — never advertise paging before remotes paint.
          count={hasPaintedRemote ? visibleUris.length : 0}
          index={index}
          progress={scrollProgress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  heroPage: {
    overflow: 'hidden',
  },
  fallback: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  editWrap: {
    position: 'absolute',
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editHit: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 3,
    alignItems: 'center',
  },
});
