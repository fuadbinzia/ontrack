import type { ComponentProps } from 'react';
import { useEffect } from 'react';
import {
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSheetDismissPan } from '@/components/primitives/use-sheet-dismiss-pan';
import { radii } from '@/design-system';
import {
    ITEM_KINDS,
    TravelItineraryForm,
} from '@/features/travel/travel-itinerary-form';
import { ItinerarySheetSubmitButton } from '@/features/travel/travel-itinerary-sheet-fields';
import { TravelSheetHeader } from '@/features/travel/travel-sheet';
import type { TravelItemKind } from '@/features/travel/types';
import { useDockedKeyboardInset } from '@/hooks/use-docked-keyboard-inset';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useUI } from '@/store/ui';
import { AgentUiIds } from '@/utils/agent-ui';
import { BlurView } from 'expo-blur';

type FormProps = Omit<ComponentProps<typeof TravelItineraryForm>, 'kind' | 'hideSubmit'>;

function sheetSubtitle(kind: TravelItemKind, editing: boolean): string {
  if (editing) {
    switch (kind) {
      case 'moment':
        return 'Update this moment on your timeline';
      case 'activity':
        return 'Update this activity on your timeline';
      case 'event':
        return 'Update this event on your timeline';
      default:
        return 'Update details on your timeline';
    }
  }
  switch (kind) {
    case 'stay':
      return 'Add your stay details to keep everything organized';
    case 'flight':
      return 'Add your flight details to keep everything organized';
    case 'rental':
      return 'Add your rental details to keep everything organized';
    case 'transport':
      return 'Add route, schedule, ticket, and fare details';
    case 'moment':
      return 'Capture a moment from the trip';
    case 'event':
      return 'Add a show, concert, or other booked event';
    default:
      return 'Add details to keep everything organized';
  }
}

/**
 * In-tree overlay (not a react-native Modal host). System document/photo
 * pickers can present over it without iOS dismissing the sheet or requiring
 * a hide/show gap. Host must render this as a sibling of scroll content
 * (not inside ScrollView).
 */
export function TravelItineraryAddSheet({
  visible,
  kind,
  editing = false,
  onClose,
  onAdd,
  ...formProps
}: {
  visible: boolean;
  kind: TravelItemKind;
  /** Prefill + save over an existing moment/activity. */
  editing?: boolean;
  onClose: () => void;
} & FormProps) {
  const theme = useTheme();
  const { allowsBlur } = usePerformanceTier();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { spacing: rs, layout } = useResponsive();
  const measuredTabBarHeight = useUI((state) => state.tabBarHeight);
  // In-tree overlay — Android adjustResize owns the lift (inset 0).
  const { keyboardInset, keyboardOpen } = useDockedKeyboardInset({
    enabled: visible,
    androidMode: 'resize',
  });
  const dark = theme.name === 'dark';
  const kindLabel =
    ITEM_KINDS.find((entry) => entry.value === kind)?.label ?? 'Item';
  const title = editing
    ? kind === 'moment'
      ? 'Edit Moment'
      : kind === 'activity'
        ? 'Edit Activity'
        : kind === 'event'
          ? 'Edit Event'
          : `Edit ${kindLabel}`
    : kind === 'moment'
      ? 'Add Moment'
      : kind === 'flight'
        ? 'Add Flights'
        : `Add ${kindLabel}`;
  const submitLabel = editing
    ? 'Save Changes'
    : kind === 'moment'
      ? 'Add Moment'
      : 'Add to Timeline';
  // In-tree overlay sits under the tab dock — clear it (IME covers the dock).
  const tabBarHeight =
    measuredTabBarHeight > 0
      ? measuredTabBarHeight
      : layout.bottomNavBarBaseHeight + insets.bottom;
  const sheetBottom =
    keyboardInset > 0 ? keyboardInset : keyboardOpen ? rs.sm : tabBarHeight;
  // Keep room for the status bar + docked IME / tab bar.
  const sheetMaxHeight = Math.max(
    320,
    Math.round(windowHeight * 0.92) - sheetBottom,
  );

  const { headerGesture, sheetStyle, scrimStyle, onSheetLayout, close, held } = useSheetDismissPan({
    visible,
    onClose,
  });

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [visible, close]);

  if (!held) return null;

  return (
    <View
      accessibilityViewIsModal
      pointerEvents={visible ? 'auto' : 'none'}
      style={styles.overlay}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.overlayScrim },
          scrimStyle,
        ]}
      />
      <Pressable
        accessibilityLabel="Close add to timeline"
        onPress={close}
        style={styles.backdrop}
      />
      <KeyboardAvoidingView
        // Inset lift owns avoidance (same as SheetScaffold).
        behavior={undefined}
        keyboardVerticalOffset={0}
        pointerEvents="box-none"
        style={styles.modalRoot}>
        <Animated.View
          onLayout={(event) => {
            onSheetLayout(Math.round(event.nativeEvent.layout.height));
          }}
          style={[
            styles.sheet,
            {
              backgroundColor: 'transparent',
              borderColor: dark
                ? 'rgba(255,255,255,0.22)'
                : 'rgba(255,255,255,0.7)',
              maxHeight: sheetMaxHeight,
              // Clear tab dock (or IME when open). CTA scrolls with the form.
              bottom: sheetBottom,
            },
            sheetStyle,
          ]}>
          {Platform.OS === 'android' ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                dark ? styles.androidGlassDark : styles.androidGlassLight,
              ]}
            />
          ) : (
            <>
              <BlurView
                intensity={allowsBlur ? 56 : 0}
                tint={dark ? 'dark' : 'light'}
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
              />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: dark
                      ? allowsBlur
                        ? 'rgba(12, 16, 24, 0.55)'
                        : 'rgba(12, 16, 24, 0.82)'
                      : allowsBlur
                        ? 'rgba(255, 255, 255, 0.62)'
                        : 'rgba(255, 255, 255, 0.9)',
                  },
                ]}
              />
            </>
          )}
          <GestureDetector gesture={headerGesture}>
            <Animated.View
              style={[
                styles.headerSlot,
                {
                  paddingHorizontal: rs.lg,
                },
              ]}>
              <TravelSheetHeader
                eyebrow="Itinerary"
                title={title}
                subtitle={sheetSubtitle(kind, editing)}
                closeAccessibilityLabel={
                  editing ? 'Close edit stop' : 'Close add to timeline'
                }
                closeTestID={AgentUiIds.travel.itineraryAdd.close}
                onClose={close}
                grabberInteractive={false}
              />
            </Animated.View>
          </GestureDetector>

          <View style={styles.body}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              automaticallyAdjustKeyboardInsets={false}
              showsVerticalScrollIndicator={false}
              bounces
              style={styles.scroll}
              contentContainerStyle={{
                flexGrow: 0,
                gap: rs.sm,
                paddingHorizontal: rs.lg,
                paddingTop: rs.xs,
                paddingBottom: rs.md,
              }}>
              <TravelItineraryForm
                kind={kind}
                hideSubmit
                onAdd={onAdd}
                {...formProps}
              />
              <View style={{ paddingTop: rs.xs }}>
                <ItinerarySheetSubmitButton
                  label={submitLabel}
                  onPress={onAdd}
                  testID={AgentUiIds.travel.itineraryAdd.submit}
                  icon={
                    editing ? 'check' : kind === 'moment' ? 'photo' : 'calendar-add'
                  }
                />
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    elevation: 50,
  },
  /** Full-screen scrim behind the sheet — must not sit above sheet controls. */
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalRoot: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    flexDirection: 'column',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  androidGlassLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    experimental_backgroundImage:
      'linear-gradient(165deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.64) 48%, rgba(255,255,255,0.8) 100%)',
  },
  androidGlassDark: {
    backgroundColor: 'rgba(12, 16, 24, 0.72)',
    experimental_backgroundImage:
      'linear-gradient(165deg, rgba(36,42,54,0.78) 0%, rgba(12,16,24,0.62) 50%, rgba(8,12,18,0.76) 100%)',
  },
  headerSlot: { flexShrink: 0 },
  body: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  scroll: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
});
