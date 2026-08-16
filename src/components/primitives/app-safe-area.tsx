import { Image, type ImageSource } from 'expo-image';
import * as SystemUI from 'expo-system-ui';
import type { PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    hideIosScrollEdgeScreenContext,
    ScreenContext,
} from '@/components/navigation/scroll-edge-effects';
import { useTheme } from '@/hooks/use-theme';

import {
    SafeAreaChromeProvider,
    useSafeAreaChromeBackground,
    useSafeAreaChromeColor,
    useSafeAreaChromeOverlayLayer,
} from './safe-area-chrome';

/**
 * Non-scrolling boundary for the entire navigation tree.
 * Keeping the top inset outside route scroll views prevents content and
 * overscroll effects from ever moving behind the device clock or cutout.
 *
 * The outer fill uses the focused route's safe-area chrome color when set
 * (Today wash, Travel sky, …) so header backgrounds continue into the
 * status-bar region without moving insets into scroll content.
 *
 * Chrome Image + overlay slots stay mounted as Fabric siblings — toggling
 * them with `{cond ? <ExpoImage/> : null}` next to itinerary sky caused iOS
 * `unmountChildComponentView` / ExpoFabricView SIGTRAP when opening a trip.
 */
export function AppSafeArea({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <SafeAreaChromeProvider>
      <ScreenContext.Provider value={hideIosScrollEdgeScreenContext}>
        <AppSafeAreaFrame style={style}>{children}</AppSafeAreaFrame>
      </ScreenContext.Provider>
    </SafeAreaChromeProvider>
  );
}

function AppSafeAreaFrame({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useTheme();
  const chromeColor = useSafeAreaChromeColor();
  const {
    image: chromeImage,
    height: chromeImageHeight,
    blurRadius: chromeImageBlurRadius,
    onError: chromeImageOnError,
  } = useSafeAreaChromeBackground();
  const { overlay: chromeOverlay, height: chromeOverlayHeight } =
    useSafeAreaChromeOverlayLayer();
  const backgroundColor = chromeColor ?? theme.backgroundPrimary;

  // Keep the last image source so ExpoImage never unmounts when chrome clears
  // during the Travel Home → itinerary push (Fabric sibling of the sky slot).
  const lastImageRef = useRef<ImageSource | undefined>(undefined);
  if (chromeImage) lastImageRef.current = chromeImage;
  const imageSource = chromeImage ?? lastImageRef.current;
  const showImage = Boolean(chromeImage && imageSource);
  const showOverlay = Boolean(chromeOverlay);
  const onImageErrorRef = useRef(chromeImageOnError);
  onImageErrorRef.current = chromeImageOnError;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(backgroundColor).catch(() => undefined);
  }, [backgroundColor]);

  return (
    <View style={[styles.fill, { backgroundColor }, style]}>
      {/*
        Always-mounted Fabric slots. Hide with opacity — never remount Image /
        overlay hosts as siblings when itinerary sky replaces home atmosphere.
      */}
      <View
        collapsable={false}
        pointerEvents="none"
        style={[
          styles.chromeImage,
          chromeImageHeight != null ? { height: chromeImageHeight } : StyleSheet.absoluteFill,
          { opacity: showImage ? 1 : 0 },
        ]}>
        {imageSource ? (
          <Image
            pointerEvents="none"
            source={imageSource}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition={{ top: '0%', left: '50%' }}
            blurRadius={chromeImageBlurRadius}
            // Soften source swaps (Travel home atmosphere rotation).
            transition={350}
            onError={() => {
              onImageErrorRef.current?.();
            }}
          />
        ) : null}
      </View>
      <View
        collapsable={false}
        pointerEvents="none"
        style={[
          styles.chromeOverlay,
          chromeOverlayHeight != null
            ? { height: chromeOverlayHeight }
            : StyleSheet.absoluteFill,
          { opacity: showOverlay ? 1 : 0 },
        ]}>
        {chromeOverlay}
      </View>
      <SafeAreaView edges={['top']} style={[styles.fill, styles.transparent]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  transparent: { backgroundColor: 'transparent' },
  chromeImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 0,
  },
  chromeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 0,
    overflow: 'visible',
  },
});
