import type { PropsWithChildren, RefObject } from 'react';
import { useRef } from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bottomNavContentInset } from '@/components/navigation/bottom-nav-inset';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useUI } from '@/store/ui';
import { useAgentUiScrollContainer } from '@/utils/agent-ui/use-agent-ui-scroll-container';

import {
  usePageSurfaceBackground,
  useSafeAreaChrome,
} from './safe-area-chrome';
import { useScreenAtmosphereChrome } from './screen-atmosphere';

interface ScreenProps extends PropsWithChildren {
  /** Scrollable content (default) or a fixed layout */
  scroll?: boolean;
  /** Extra bottom padding for content above the tab bar, or only the device safe area */
  bottomInset?: boolean | 'safe';
  padded?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  scrollEnabled?: boolean;
  /**
   * Pull-to-refresh for scrollable screens (default true).
   * Disable on dense editors/forms where a pull would fight typing.
   */
  refresh?: boolean;
  /** Extra work after the shared cloud/friends refresh. */
  onRefresh?: () => void | Promise<void>;
  /** Optional access to the shared scroll container for targeted in-screen navigation. */
  scrollRef?: RefObject<ScrollView | null>;
  /** Forwarded after agent-ui scroll bookkeeping. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /**
   * Soft gradient underlay for glass plates (default). Disable when a
   * feature paints its own full-bleed atmosphere (Travel / Today washes).
   */
  atmosphere?: boolean;
}

export function Screen({
  children,
  scroll = true,
  bottomInset = true,
  padded = true,
  style,
  contentStyle,
  scrollEnabled = true,
  refresh = true,
  onRefresh,
  scrollRef,
  onScroll,
  atmosphere = true,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { spacing, layout } = useResponsive();
  const notifyPageInteraction = useUI((state) => state.notifyPageInteraction);
  const pull = usePullToRefresh(onRefresh);
  const viewportRef = useRef<View>(null);
  const agentScroll = useAgentUiScrollContainer(scrollRef, viewportRef);
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    agentScroll.onScroll?.(event);
    onScroll?.(event);
  };

  const flattened = StyleSheet.flatten(style) as ViewStyle | undefined;
  const styleBackground = flattened?.backgroundColor;
  const usesCustomBackground = styleBackground !== undefined;
  const useAtmosphere = atmosphere && !usesCustomBackground;
  const backgroundColor = useAtmosphere
    ? 'transparent'
    : styleBackground !== undefined
      ? styleBackground
      : theme.backgroundPrimary;
  const surfaceColor =
    !useAtmosphere && typeof backgroundColor === 'string'
      ? backgroundColor
      : undefined;
  // Default glass wash paints on AppSafeArea (window y=0) so status bar +
  // page share one continuous atmosphere — no hard safe-area seam.
  useScreenAtmosphereChrome(useAtmosphere);
  // Solid / custom fills still publish status-bar + dock colors.
  useSafeAreaChrome(surfaceColor, { priority: -1 });
  usePageSurfaceBackground(surfaceColor);

  const paddingStyle: ViewStyle = {
    // The app shell owns the non-scrolling top safe area.
    paddingTop: spacing.sm,
    paddingBottom:
      bottomInset === 'safe'
        ? insets.bottom + spacing.lg
        : bottomInset
          ? bottomNavContentInset(
              insets.bottom,
              spacing.sm,
              Platform.OS,
              layout.bottomNavBarBaseHeight,
            )
          : spacing.xl,
    ...(padded
      ? {
          paddingLeft: insets.left + layout.screenPadding,
          paddingRight: insets.right + layout.screenPadding,
        }
      : null),
  };

  const shell = scroll ? (
    <ScrollView
      ref={agentScroll.scrollRef}
      style={styles.scrollView}
      automaticallyAdjustKeyboardInsets
      scrollEnabled={scrollEnabled}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[styles.scrollContent, paddingStyle, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      onScroll={handleScroll}
      scrollEventThrottle={agentScroll.scrollEventThrottle}
      refreshControl={refresh ? pull.refreshControl : undefined}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, paddingStyle, contentStyle]}>{children}</View>
  );

  if (!scroll) {
    return (
      <View
        onTouchStart={notifyPageInteraction}
        style={[styles.fill, { backgroundColor }, style]}>
        {shell}
      </View>
    );
  }

  return (
    <View
      ref={viewportRef}
      onTouchStart={notifyPageInteraction}
      collapsable={false}
      style={[styles.fill, { backgroundColor }, style]}>
      {shell}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollView: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1 },
});
