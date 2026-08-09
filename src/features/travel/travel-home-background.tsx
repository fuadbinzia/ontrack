import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePageSurfaceBackground } from '@/components/primitives';
import { travelHomeTokens } from '@/features/travel/travel-home-tokens';
import { useTheme } from '@/hooks/use-theme';

export const TRAVEL_HOME_ATMOSPHERE = require('../../../assets/images/travel/header-atmosphere-v2.png');
/** Dark-mode header wash — Iceland northern lights (not trip-card hero imagery). */
export const TRAVEL_HOME_ATMOSPHERE_NIGHT = require('../../../assets/images/travel/header-atmosphere-iceland-aurora.png');

type TravelHomeBackgroundProps = {
  enabled: boolean;
  /** Taller hero band when there are no trips (empty welcome straddles the fade). */
  empty?: boolean;
};

/**
 * Window-space height for the atmosphere hero band (includes status-bar inset).
 * Default ~top third for trip cards; empty welcome uses a deeper band so the
 * invitation sits in the soft photo→paper dissolve — never a full-page photo.
 */
export function travelHomeAtmosphereHeight(
  windowHeight: number,
  topInset: number,
  options?: { empty?: boolean },
): number {
  const ratio = options?.empty ? 0.44 : 0.34;
  return Math.round(windowHeight * ratio) + topInset;
}

/** Day mountain wash or Iceland aurora — same geometry either theme. */
export function travelHomeAtmosphereSource(themeName: string) {
  return themeName === 'dark' ? TRAVEL_HOME_ATMOSPHERE_NIGHT : TRAVEL_HOME_ATMOSPHERE;
}

/**
 * Page paper under the hero band + soft fade at the photo’s bottom edge.
 * The atmosphere photo itself is painted once on AppSafeArea via
 * `useSafeAreaChrome` at `travelHomeAtmosphereHeight` (not full-bleed).
 */
export function TravelHomeBackground({
  enabled: _enabled,
  empty = false,
}: TravelHomeBackgroundProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const dark = theme.name === 'dark';
  /** Content-space height of the upper atmosphere band. */
  const contentPhotoHeight =
    travelHomeAtmosphereHeight(height, insets.top, { empty }) - insets.top;
  const paper = dark ? theme.backgroundPrimary : travelHomeTokens.colors.surface;
  // Transparent Screen on Travel home — publish paper so the tab dock matches.
  usePageSurfaceBackground(paper, { priority: 1 });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]}>
      {/* Soften the hard bottom edge of the chrome photo into paper. */}
      <LinearGradient
        pointerEvents="none"
        colors={
          dark
            ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', paper]
            : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', paper]
        }
        locations={[0.4, 0.78, 1]}
        style={[
          styles.fade,
          {
            top: 0,
            height: contentPhotoHeight + 12,
          },
        ]}
      />
      {/* Solid paper under Your Trips — photo must not continue full-page. */}
      <View
        pointerEvents="none"
        style={[
          styles.paper,
          {
            top: contentPhotoHeight,
            backgroundColor: paper,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: 'transparent',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  paper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
