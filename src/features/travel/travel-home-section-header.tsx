import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Keyboard,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    ReduceMotion,
    runOnJS,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import { Symbol } from '@/components/primitives';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import {
    travelHomeFontFamily,
    travelHomeTokens,
} from '@/features/travel/travel-home-tokens';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

type TravelHomeSectionHeaderProps = {
  /** Placeholder when search is shown; visible title when search is omitted. */
  title: string;
  count?: number;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  /** Controlled open state (parent can collapse on scroll / chrome taps). */
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
};

const EXPAND_MS = 280;
const COLLAPSE_MS = 340;
const EXPAND_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const COLLAPSE_EASING = Easing.bezier(0.33, 0, 0.2, 1);

/**
 * Compact “Your Trips” search chip that expands to a full-width field on tap.
 * Width + label/field crossfade for a smooth open/close (no outer plate).
 */
export function TravelHomeSectionHeader({
  title,
  count,
  searchQuery = '',
  onSearchQueryChange,
  searchOpen: searchOpenProp,
  onSearchOpenChange,
}: TravelHomeSectionHeaderProps) {
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const ignoreBlurRef = useRef(false);
  const wasOpenRef = useRef(false);
  const hasQuery = Boolean(searchQuery.trim());
  const [searchOpenState, setSearchOpenState] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  const searchOpen =
    searchOpenProp !== undefined ? searchOpenProp : searchOpenState;
  const setSearchOpen = useCallback(
    (open: boolean) => {
      onSearchOpenChange?.(open);
      if (searchOpenProp === undefined) {
        setSearchOpenState(open);
      }
    },
    [onSearchOpenChange, searchOpenProp],
  );
  const dark = theme.name === 'dark';
  // Theme-native glass: light frost in light mode, dark frost in dark.
  const plateInk = dark ? '#FFFFFF' : travelHomeTokens.colors.ink;
  const fieldInk = plateInk;
  const fieldMuted = dark
    ? 'rgba(255,255,255,0.88)'
    : travelHomeTokens.colors.inkMuted;
  const titleSize = Math.max(18, s(travelHomeTokens.sizes.sectionTitle));
  const searchTextSize = Math.max(15, s(travelHomeTokens.sizes.searchFieldText));
  const showCount = count !== undefined && count > 0;
  const circle = Math.max(22, s(travelHomeTokens.sizes.countCircle));
  const tripsWord = count === 1 ? 'trip' : 'trips';
  const padX = Math.max(12, rs.sm);
  const padY = Math.max(8, s(8));
  const radius = Math.max(14, s(16));
  const fieldHeight = Math.max(36, s(38));
  const searchIconSize = Math.max(14, Math.round(searchTextSize * 0.92));
  const scoopPadL = Math.max(10, s(10));
  const scoopPadR = Math.max(8, s(8));
  const scoopGap = s(6);
  const iconHitW = Math.max(
    travelHomeTokens.sizes.touchTargetMin - 12,
    searchIconSize + s(8),
  );
  const iconHitH = Math.max(
    travelHomeTokens.sizes.touchTargetMin - 12,
    fieldHeight - s(4),
  );
  // Match visual air after the glyph (hit-box inset + row gap).
  const iconToTitleGap =
    Math.round((iconHitW - searchIconSize) / 2) + scoopGap;
  // Hug icon + full title + badge — never rely on a too-small fallback width.
  const chipWidth =
    titleWidth > 0
      ? Math.ceil(
          scoopPadL +
            iconHitW +
            scoopGap +
            titleWidth +
            (showCount ? iconToTitleGap + circle : 0) +
            scoopPadR +
            StyleSheet.hairlineWidth * 2 +
            2,
        )
      : 0;
  const showSearch = typeof onSearchQueryChange === 'function';
  // Drive open from searchOpen only — keep query until the collapse animation settles.
  const openSearch = showSearch && searchOpen;
  const progress = useSharedValue(openSearch ? 1 : 0);
  const collapsedW = useSharedValue(0);
  const expandedW = useSharedValue(0);

  const finishCollapseCleanup = useCallback(() => {
    onSearchQueryChange?.('');
    Keyboard.dismiss();
  }, [onSearchQueryChange]);

  const collapseSearch = useCallback(() => {
    ignoreBlurRef.current = true;
    inputRef.current?.blur();
    setSearchOpen(false);
  }, [setSearchOpen]);

  useEffect(() => {
    if (hasQuery) setSearchOpen(true);
  }, [hasQuery, setSearchOpen]);

  useEffect(() => {
    if (chipWidth > 0) collapsedW.value = chipWidth;
  }, [chipWidth, collapsedW]);

  useEffect(() => {
    if (trackWidth > 0) expandedW.value = trackWidth;
  }, [trackWidth, expandedW]);

  useEffect(() => {
    const opening = openSearch;
    const closing = wasOpenRef.current && !opening;
    wasOpenRef.current = opening;
    const duration = reduceMotion
      ? 0
      : opening
        ? EXPAND_MS
        : COLLAPSE_MS;
    progress.value = withTiming(
      opening ? 1 : 0,
      {
        duration,
        easing: opening ? EXPAND_EASING : COLLAPSE_EASING,
        reduceMotion: ReduceMotion.System,
      },
      (finished) => {
        if (!finished || !closing) return;
        runOnJS(finishCollapseCleanup)();
      },
    );
  }, [finishCollapseCleanup, openSearch, progress, reduceMotion]);

  useEffect(() => {
    if (!openSearch) return;
    const delay = reduceMotion ? 0 : Math.round(EXPAND_MS * 0.55);
    const id = setTimeout(() => {
      inputRef.current?.focus();
    }, delay);
    return () => clearTimeout(id);
  }, [openSearch, reduceMotion]);

  const shellStyle = useAnimatedStyle(() => {
    const from = collapsedW.value > 0 ? collapsedW.value : expandedW.value;
    const to = expandedW.value > 0 ? expandedW.value : from;
    if (from <= 0 && to <= 0) {
      return { alignSelf: 'flex-start' as const };
    }
    return {
      width: interpolate(
        progress.value,
        [0, 1],
        [from > 0 ? from : to, to > 0 ? to : from],
        Extrapolation.CLAMP,
      ),
    };
  });

  // Wide overlap so label eases in while the field eases out (no hard cut).
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.35, 0.75, 1],
      [1, 1, 0.25, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const fieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.25, 0.65, 1],
      [0, 0.15, 0.85, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const searchAgent = useAgentUiTarget(AgentUiIds.travel.list.search, {
    label: title,
    value: searchQuery,
    onPress: showSearch && !openSearch
      ? () => {
          setSearchOpen(true);
        }
      : undefined,
  });
  const minimizeAgent = useAgentUiTarget(
    openSearch ? AgentUiIds.travel.list.searchMinimize : undefined,
    {
      label: 'Minimize trip search',
      onPress: collapseSearch,
    },
  );
  const clearAgent = useAgentUiTarget(
    openSearch && hasQuery ? AgentUiIds.travel.list.searchClear : undefined,
    {
      label: 'Clear trip search',
      onPress: () => onSearchQueryChange?.(''),
    },
  );

  const renderCountBadge = () =>
    showCount ? (
      <TravelHomeGlass
        inverted
        intensity={dark ? 56 : 44}
        accessibilityRole="text"
        accessibilityLabel={`${count} ${tripsWord}`}
        style={[
          styles.badge,
          {
            width: circle,
            height: circle,
            borderRadius: circle / 2,
          },
        ]}>
        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.1}
          numberOfLines={1}
          style={{
            // `inverted` is always a dark plate — white ink on every theme.
            color: '#FFFFFF',
            fontSize: Math.max(11, s(12)),
            fontWeight: '400',
            fontFamily: travelHomeFontFamily,
          }}>
          {count}
        </Text>
      </TravelHomeGlass>
    ) : null;

  const plateStyle = {
    borderRadius: radius,
    paddingHorizontal: padX,
    paddingVertical: padY,
    minHeight: Math.max(40, s(40)),
    gap: s(8),
  };

  const scoopStyle = {
    height: fieldHeight,
    borderRadius: fieldHeight / 2,
    paddingLeft: scoopPadL,
    paddingRight: scoopPadR,
    gap: scoopGap,
  };

  const titleTextStyle = {
    color: fieldMuted,
    fontFamily: travelHomeFontFamily,
    fontSize: searchTextSize,
    lineHeight: Math.round(searchTextSize * 1.2),
    fontWeight: '400' as const,
    letterSpacing: -0.2,
  };

  if (!showSearch) {
    return (
      <TravelHomeGlass
        intensity={dark ? 48 : 44}
        style={[
          styles.plate,
          plateStyle,
          {
            alignSelf: 'stretch',
            width: '100%',
          },
        ]}>
        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.15}
          numberOfLines={1}
          style={{
            flex: 1,
            flexShrink: 1,
            minWidth: 0,
            color: plateInk,
            fontFamily: travelHomeFontFamily,
            fontSize: titleSize,
            lineHeight: titleSize * 1.15,
            fontWeight: '400',
            letterSpacing: -0.3,
          }}>
          {title}
        </Text>
        {renderCountBadge()}
      </TravelHomeGlass>
    );
  }

  const iconHit = {
    width: iconHitW,
    height: iconHitH,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <View
      style={styles.track}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== trackWidth) setTrackWidth(next);
      }}>
      {/* Measure full title width so the collapsed pill never ellipsizes. */}
      <Text
        pointerEvents="none"
        allowFontScaling
        maxFontSizeMultiplier={1.15}
        numberOfLines={1}
        style={[titleTextStyle, styles.measureTitle]}
        onTextLayout={(event) => {
          const next = Math.ceil(
            event.nativeEvent.lines.reduce(
              (max, line) => Math.max(max, line.width),
              0,
            ),
          );
          if (next > 0 && next !== titleWidth) setTitleWidth(next);
        }}>
        {title}
      </Text>

      <Animated.View style={[styles.shell, shellStyle]}>
        <TravelHomeGlass
          intensity={dark ? 36 : 52}
          style={[styles.search, scoopStyle, styles.searchFill]}>
          <Pressable
            ref={
              (openSearch ? minimizeAgent.ref : searchAgent.ref) as never
            }
            testID={
              openSearch ? minimizeAgent.testID : searchAgent.testID
            }
            onLayout={
              openSearch ? minimizeAgent.onLayout : searchAgent.onLayout
            }
            accessibilityRole="button"
            accessibilityLabel={
              openSearch ? 'Minimize trip search' : `Search ${title}`
            }
            hitSlop={8}
            onPress={() => {
              if (openSearch) collapseSearch();
              else setSearchOpen(true);
            }}
            style={iconHit}>
            <Symbol name="search" size={searchIconSize} color={fieldMuted} />
          </Pressable>

          <View style={[styles.fieldSlot, styles.fieldSlotOpen]}>
            <Animated.View
              pointerEvents={openSearch ? 'none' : 'auto'}
              style={[styles.fieldLayer, labelStyle]}>
              <Pressable
                accessibilityElementsHidden={openSearch}
                importantForAccessibility={
                  openSearch ? 'no-hide-descendants' : 'yes'
                }
                disabled={openSearch}
                onPress={() => setSearchOpen(true)}
                style={styles.fieldPress}>
                <Text
                  allowFontScaling
                  maxFontSizeMultiplier={1.15}
                  numberOfLines={1}
                  style={titleTextStyle}>
                  {title}
                </Text>
              </Pressable>
            </Animated.View>

            <Animated.View
              pointerEvents={openSearch ? 'auto' : 'none'}
              style={[styles.fieldLayer, fieldStyle]}>
              <TextInput
                ref={(node) => {
                  inputRef.current = node;
                  if (openSearch) {
                    searchAgent.ref(node as never);
                  }
                }}
                testID={openSearch ? searchAgent.testID : undefined}
                onLayout={openSearch ? searchAgent.onLayout : undefined}
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                placeholder={title}
                placeholderTextColor={fieldMuted}
                accessibilityLabel={title}
                editable={openSearch}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="never"
                underlineColorAndroid="transparent"
                onSubmitEditing={collapseSearch}
                onBlur={() => {
                  if (ignoreBlurRef.current) {
                    ignoreBlurRef.current = false;
                    return;
                  }
                  if (openSearch) collapseSearch();
                }}
                style={[
                  titleTextStyle,
                  {
                    flex: 1,
                    flexShrink: 1,
                    minWidth: 0,
                    paddingVertical: 0,
                    color: fieldInk,
                  },
                ]}
              />
            </Animated.View>
          </View>

          {hasQuery ? (
            <Pressable
              ref={clearAgent.ref as never}
              testID={clearAgent.testID}
              onLayout={clearAgent.onLayout}
              accessibilityRole="button"
              accessibilityLabel="Clear trip search"
              hitSlop={8}
              onPressIn={() => {
                ignoreBlurRef.current = true;
              }}
              onPress={() => {
                onSearchQueryChange?.('');
                requestAnimationFrame(() => {
                  inputRef.current?.focus();
                  ignoreBlurRef.current = false;
                });
              }}
              style={{
                width: Math.max(22, s(22)),
                height: Math.max(22, s(22)),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Symbol
                name="close"
                size={Math.max(12, s(13))}
                color={fieldMuted}
              />
            </Pressable>
          ) : null}
          {showCount ? (
            <View style={{ marginLeft: iconToTitleGap - scoopGap }}>
              {renderCountBadge()}
            </View>
          ) : null}
        </TravelHomeGlass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    alignSelf: 'stretch',
  },
  measureTitle: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
    zIndex: -1,
  },
  shell: {
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchFill: {
    width: '100%',
  },
  fieldSlot: {
    height: '100%',
    justifyContent: 'center',
  },
  fieldSlotOpen: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  fieldLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
  fieldPress: {
    justifyContent: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
