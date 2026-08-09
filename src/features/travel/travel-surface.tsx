import type { PropsWithChildren } from 'react';
import {
    StyleSheet,
    View,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

import { AppText, Card, GlassTonePill, Symbol } from '@/components/primitives';
import {
    darkTravelTheme,
    lightTravelTheme,
    type AppIconName,
    type Theme,
} from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

import {
    travelAtmosphereScheme,
    type TravelAtmosphere,
} from './travel-atmosphere-model';
import { HEADER_SKY_NIGHT_CHROME } from './travel-sky-condition';

/** Travel's open-sky accent. Shared control semantics remain unchanged. */
export const TRAVEL_EDITORIAL_ACCENT = '#2474A8';

/** Cool shadow that sits naturally on Travel's sky wash. */
export const TRAVEL_CARD_SHADOW = '0 3px 12px rgba(17, 74, 110, 0.16)';
export const TRAVEL_CARD_SHADOW_DARK = '0 4px 16px rgba(0, 0, 0, 0.45)';

export function travelCardShadow(theme: Theme): string {
  return theme.name === 'dark' ? TRAVEL_CARD_SHADOW_DARK : TRAVEL_CARD_SHADOW;
}

/** Travel pages fade a single blue wash into Today's neutral paper. */
const FALLBACK_ATMOSPHERE: TravelAtmosphere = {
  destination: 'Travel',
  timeOfDay: 'day',
};

function travelTopWash(theme: Theme): string {
  // Dark wash matches itinerary night-sky status chrome (not pure page black).
  return theme.name === 'dark'
    ? HEADER_SKY_NIGHT_CHROME
    : lightTravelTheme.backgroundPrimary;
}

/** Page paper under the Travel wash — cool gray (light) / black (dark). */
function travelPagePaper(theme: Theme): string {
  return theme.name === 'dark' ? darkTravelTheme.backgroundPrimary : '#F8F9FA';
}

export function travelSafeAreaBackground(theme: Theme): string {
  return travelTopWash(theme);
}

function travelBluePageGradient(theme: Theme): string {
  const wash = travelTopWash(theme);
  const paper = travelPagePaper(theme);
  return `linear-gradient(to bottom, ${wash} 0%, ${paper} 42%, ${paper} 100%)`;
}

export function travelPageBg(
  theme: Theme,
  _atmosphere: TravelAtmosphere = FALLBACK_ATMOSPHERE,
): string {
  return travelPagePaper(theme);
}

/** Blue-to-neutral page style shared by every Travel route. */
export function travelPageStyle(
  theme: Theme,
  atmosphere: TravelAtmosphere = FALLBACK_ATMOSPHERE,
): ViewStyle {
  return {
    backgroundColor: travelPageBg(theme, atmosphere),
    experimental_backgroundImage: travelBluePageGradient(theme),
  };
}

export function useTravelPageStyle(theme: Theme): ViewStyle {
  return travelPageStyle(theme);
}

/** Continue the page wash behind the status bar via shared `useSafeAreaChrome`. */
export function travelSafeAreaStyle(
  theme: Theme,
  _atmosphere: TravelAtmosphere = FALLBACK_ATMOSPHERE,
): ViewStyle {
  return { backgroundColor: travelSafeAreaBackground(theme) };
}

/**
 * Itinerary plan-detail shells: frosted airy glass in both themes.
 * Sky atmosphere shows through — do not paint opaque paper fills over these.
 * Optional `tintColor` matches the trip header artwork.
 */
export function travelItineraryShellProps(
  theme: Theme,
  tintColor?: string,
): {
  clear?: boolean;
  airy?: boolean;
  intensity?: number;
  tintColor?: string;
} {
  return {
    airy: true,
    intensity: theme.name === 'dark' ? 40 : 48,
    ...(tintColor ? { tintColor } : {}),
  };
}

/** Nested board / timeline mist chips — optional artwork tint. */
export function travelItineraryMistProps(tintColor?: string): {
  mist: true;
  tintColor?: string;
} {
  return {
    mist: true,
    ...(tintColor ? { tintColor } : {}),
  };
}

/** Primary / secondary / tertiary ink on itinerary glass or white shells. */
export function travelItineraryInk(
  theme: Theme,
  role: 'primary' | 'secondary' | 'tertiary' = 'primary',
  /** When artwork glass is dark, force light ink even in light theme. */
  options?: { darkGlass?: boolean },
): string {
  const darkGlass = theme.name === 'dark' || Boolean(options?.darkGlass);
  if (darkGlass) {
    if (role === 'secondary') return 'rgba(255,255,255,0.82)';
    if (role === 'tertiary') return 'rgba(255,255,255,0.68)';
    return '#FFFFFF';
  }
  if (role === 'secondary') return theme.textSecondary;
  if (role === 'tertiary') return theme.textTertiary;
  return theme.textPrimary;
}

/** Hairline card border from sheet chrome. */
export function travelCardBorder(theme: Theme): string {
  return theme.separator;
}

/** CTA / accent from sheet chrome (gradient start). */
export function travelAccent(theme: Theme): string {
  return theme.accentPrimary;
}

/** Three representative stops for callers that need concrete gradient colors. */
export function travelWashColors(
  theme: Theme,
  atmosphere: TravelAtmosphere = FALLBACK_ATMOSPHERE,
): [string, string, string] {
  const gradient = travelAtmosphereScheme(theme, atmosphere);
  return [gradient.stops[0], gradient.stops[1], gradient.stops[3]];
}

export function travelSkyColors(theme: Theme): [string, string, string] {
  return travelWashColors(theme);
}

/** Blue-to-neutral page backdrop matching the Travel routes. */
export function TravelSkyBackdrop(_props?: { variant?: 'wash' | 'sky' }) {
  const theme = useTheme();
  const pageStyle = useTravelPageStyle(theme);
  return (
    <View
      style={[StyleSheet.absoluteFill, pageStyle]}
      pointerEvents="none"
    />
  );
}

/** Elevated travel card — continuous radius + warm shadow like Add Stay panels. */
export function TravelSurfaceCard({
  children,
  style,
  bodyStyle,
  padding,
  onLayout,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  padding?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
}>) {
  const { spacing: rs } = useResponsive();
  const pad = padding ?? rs.md;
  return (
    <Card airy padded={false} onLayout={onLayout} style={style}>
      <View style={[styles.cardBody, { padding: pad, gap: rs.md }, bodyStyle]}>
        {children}
      </View>
    </Card>
  );
}

/** Tinted section label used across travel lists. */
export function TravelSectionLabel({
  title,
  count,
  icon,
}: {
  title: string;
  count?: number;
  icon?: AppIconName;
}) {
  const theme = useTheme();
  const accent = travelAccent(theme);
  const { spacing: rs, s } = useResponsive();
  return (
    <View
      style={[
        styles.sectionLabel,
        {
          paddingVertical: rs.xs,
          gap: rs.sm,
          minHeight: Math.max(44, s(44)),
        },
      ]}>
      {icon ? <Symbol name={icon} size="sm" color={accent} /> : null}
      <AppText
        variant="heading"
        style={styles.flex}
        fit
        numberOfLines={1}
        maxFontSizeMultiplier={1.15}>
        {title}
      </AppText>
      {count !== undefined ? (
        <GlassTonePill
          label={String(count)}
          toneColor={theme.accentPrimary}
          showDot={false}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    minWidth: 0,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: { flex: 1, flexShrink: 1, minWidth: 0 },
});
