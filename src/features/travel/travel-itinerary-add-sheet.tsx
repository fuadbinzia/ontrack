import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import {
    BackHandler,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    View,
    type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radii } from '@/design-system';
import {
    ITEM_KINDS,
    TravelItineraryForm,
} from '@/features/travel/travel-itinerary-form';
import { ItinerarySheetSubmitButton } from '@/features/travel/travel-itinerary-sheet-fields';
import { TravelSheetHeader } from '@/features/travel/travel-sheet';
import type { TravelItemKind } from '@/features/travel/types';
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
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { spacing: rs, layout } = useResponsive();
  const measuredTabBarHeight = useUI((state) => state.tabBarHeight);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const dark = theme.name === 'dark';
  const kindLabel =
    ITEM_KINDS.find((entry) => entry.value === kind)?.label ?? 'Item';
  const title = editing
    ? kind === 'moment'
      ? 'Edit Moment'
      : kind === 'activity'
        ? 'Edit Activity'
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
  const sheetBottom = keyboardInset > 0 ? keyboardInset : tabBarHeight;
  // Keep room for the status bar + docked IME / tab bar.
  const sheetMaxHeight = Math.max(
    320,
    Math.round(windowHeight * 0.92) - sheetBottom,
  );

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const updateInset = (event: KeyboardEvent) => {
      Keyboard.scheduleLayoutAnimation(event);
      const { height: kbHeight, screenY, width: kbWidth } = event.endCoordinates;
      // Floating / side IMEs should not lift the sheet; docked IMEs must.
      const fullWidth = kbWidth >= windowWidth * 0.8;
      if (!fullWidth) {
        setKeyboardInset(0);
        return;
      }
      const fromScreenY = Math.max(0, windowHeight - screenY - insets.bottom);
      const fromHeight = Math.max(0, kbHeight - insets.bottom);
      setKeyboardInset(fromScreenY > 0 ? fromScreenY : fromHeight);
    };
    const showSubscription = Keyboard.addListener(showEvent, updateInset);
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [visible, insets.bottom, windowHeight, windowWidth]);

  if (!visible) return null;

  return (
    <View
      accessibilityViewIsModal
      style={[styles.overlay, { backgroundColor: theme.overlayScrim }]}>
      <Pressable
        accessibilityLabel="Close add to timeline"
        onPress={onClose}
        style={styles.backdrop}
      />
      <KeyboardAvoidingView
        // Inset lift owns avoidance (same as SheetScaffold).
        behavior={undefined}
        keyboardVerticalOffset={0}
        pointerEvents="box-none"
        style={styles.modalRoot}>
        <View
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
          <View
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
              onClose={onClose}
            />
          </View>

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
        </View>
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
