import { BlurView } from 'expo-blur';
import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ModalProps,
  type ViewStyle,
} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  ReduceMotion,
  SlideInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  glassMaterials,
  motion,
  radii,
  springs,
  type AppIconName,
} from '@/design-system';
import { useDockedKeyboardInset } from '@/hooks/use-docked-keyboard-inset';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useUI } from '@/store/ui';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import { AppPromptHost } from './app-prompt';
import { ScreenAtmosphere } from './screen-atmosphere';
import { ScreenHeader } from './screen-header';
import { SheetGrabber } from './sheet-grabber';
import { useSheetDismissPan } from './use-sheet-dismiss-pan';

export interface SheetHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  subtitleIcon?: AppIconName;
  decoration?: ReactNode;
  onClose: () => void;
  closeAccessibilityLabel?: string;
  closeTestID?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * When false, grabber stays an a11y/agent target but does not use a Pressable
   * (parent header pan/tap gesture owns dismiss). Default true for standalone headers.
   */
  grabberInteractive?: boolean;
}

export function SheetHeader({
  eyebrow,
  title,
  subtitle,
  subtitleIcon,
  decoration,
  onClose,
  closeAccessibilityLabel = 'Dismiss',
  closeTestID,
  style,
  grabberInteractive = true,
}: SheetHeaderProps) {
  const { spacing } = useResponsive();
  const close = () => {
    Keyboard.dismiss();
    onClose();
  };
  return (
    <View style={[{ paddingBottom: spacing.xl, gap: spacing.sm }, style]}>
      <SheetGrabber
        testID={closeTestID}
        onPress={close}
        accessibilityLabel={closeAccessibilityLabel}
        interactive={grabberInteractive}
      />
      <ScreenHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        subtitleIcon={subtitleIcon}
        decoration={decoration}
      />
    </View>
  );
}

export interface SheetScaffoldProps extends PropsWithChildren {
  visible: boolean;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  subtitleIcon?: AppIconName;
  decoration?: ReactNode;
  onClose: () => void;
  closeAccessibilityLabel?: string;
  closeTestID?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Extra breathing room after the final body item, beyond safe-area padding. */
  additionalBottomInset?: number;
  footer?: ReactNode;
  maxHeight?: number;
  minHeight?: number;
  lockHeight?: boolean;
  /** Shrink the sheet to its body content until maxHeight requires scrolling. */
  fitContent?: boolean;
  scrollKey?: string | number;
  /**
   * `scaffold` wraps children in the canonical ScrollView.
   * `external` gives children a bounded, full-height body for virtualized lists.
   */
  bodyScrollMode?: 'scaffold' | 'external';
  /** Disable body scroll while nested gestures (e.g. color picker) are active. */
  scrollEnabled?: boolean;
  /** Tap dimmed area outside the card to dismiss (default on). Grabber still works. */
  dismissOnBackdropPress?: boolean;
  backdropTestID?: string;
  /** Orientations supported by the native modal host (iOS). */
  supportedOrientations?: ModalProps['supportedOrientations'];
  /**
   * `glass` = frosted translucent plate (app default).
   * Pass `solid` for dense editors that need opaque elevated paper.
   */
  surface?: 'solid' | 'glass';
}

/** Canonical modal sheet: safe areas, swipe grabber, scroll body, and in-scroll CTA. */
export function SheetScaffold({
  visible,
  eyebrow,
  title,
  subtitle,
  subtitleIcon,
  decoration,
  onClose,
  closeAccessibilityLabel = 'Dismiss',
  closeTestID,
  contentContainerStyle,
  additionalBottomInset = 0,
  footer,
  maxHeight,
  minHeight,
  lockHeight = false,
  fitContent = false,
  scrollKey,
  bodyScrollMode = 'scaffold',
  scrollEnabled = true,
  dismissOnBackdropPress = true,
  backdropTestID,
  supportedOrientations,
  surface = 'glass',
  children,
}: SheetScaffoldProps) {
  const theme = useTheme();
  const { allowsBlur } = usePerformanceTier();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { spacing, layout } = useResponsive();
  const scrollRef = useRef<ScrollView>(null);
  // Layout anchor: lets agent-ui dump the plate's painted bounds.
  const plateAgent = useAgentUiTarget(AgentUiIds.sheet.plate, { label: title });
  const [lockedHeight, setLockedHeight] = useState<number>();
  const { headerGesture, sheetStyle, scrimStyle, onSheetLayout, close } =
    useSheetDismissPan({
      visible,
      onClose,
    });
  // Modal ignores Android soft-input — lift on both platforms.
  const { keyboardInset } = useDockedKeyboardInset({
    enabled: visible,
    androidMode: 'modal',
  });
  // Room above the soft keyboard so fields + footer stay reachable.
  const availableHeight = Math.max(
    320,
    windowHeight - insets.top - spacing.sm - keyboardInset,
  );
  const sheetMaxHeight =
    maxHeight == null
      ? Math.round(availableHeight * 0.98)
      : Math.min(maxHeight, availableHeight);
  const sheetMinHeight =
    minHeight == null
      ? undefined
      : Math.min(Math.max(0, minHeight), sheetMaxHeight);
  const glass = surface === 'glass';
  const dark = theme.name === 'dark';
  // Safe-area pad lives on the footer/body — never on the sheet chrome — so the
  // glass/solid plate paints flush to the physical bottom (Android especially).
  // The tab dock hides while a sheet is open (modalSheetCount) so this pad is
  // clean frost — dock labels must never read through as a fake "gap".
  const bottomPad = Math.max(insets.bottom, spacing.md) + additionalBottomInset;
  const sheetEntrance = SlideInDown.springify()
    .damping(springs.sheet.damping)
    .stiffness(springs.sheet.stiffness)
    .mass(springs.sheet.mass)
    .overshootClamping(1)
    .reduceMotion(ReduceMotion.System);
  useEffect(() => {
    if (!visible) {
      setLockedHeight(undefined);
      return;
    }
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [scrollKey, title, visible]);
  // Hide the tab dock while this sheet is open — dock labels bleeding through
  // the frosted plate read as a fake gap below short (fitContent) sheets.
  const beginModalSheet = useUI((state) => state.beginModalSheet);
  const endModalSheet = useUI((state) => state.endModalSheet);
  useEffect(() => {
    if (!visible) return;
    beginModalSheet();
    return endModalSheet;
  }, [visible, beginModalSheet, endModalSheet]);

  // Dismiss unmounts immediately — holding a Modal for exit anim traps touches
  // and makes the next navigation feel stuck under an invisible overlay.
  if (!visible) return null;

  return (
    <Modal
      // Present the native host immediately. Reanimated owns the visible
      // scrim/card entrance below; a native fade serializes presentation and
      // creates a pause between the initiating tap and the first painted frame.
      animationType="none"
      hardwareAccelerated
      onRequestClose={close}
      presentationStyle="overFullScreen"
      supportedOrientations={supportedOrientations}
      statusBarTranslucent
      navigationBarTranslucent
      transparent
      visible
    >
      {/*
        Modal hosts its own native root — gestures need a GH root inside the
        Modal (app-root GestureHandlerRootView does not cover this tree).
      */}
      <GestureHandlerRootView accessibilityViewIsModal style={styles.modalRoot}>
        {/*
          Scrim fades in place; card rises from below. Native Modal slide
          would drag the dim with the sheet. (Reanimated: SlideInDown =
          start below viewport → settle at target.)
        */}
        <Animated.View
          entering={FadeIn.duration(motion.fade).reduceMotion(
            ReduceMotion.System,
          )}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.overlayScrim },
            scrimStyle,
          ]}
        />
        {/*
          Soft chroma wash under glass sheets so BlurView / frosted CTAs catch
          color instead of milking a flat dim scrim into opaque beige paper.
        */}
        {glass ? (
          <View pointerEvents="none" style={styles.atmosphereUnderlay}>
            <ScreenAtmosphere />
          </View>
        ) : null}
        {dismissOnBackdropPress ? (
          <Pressable
            testID={backdropTestID}
            accessibilityRole="button"
            accessibilityLabel={closeAccessibilityLabel}
            onPress={close}
            style={[StyleSheet.absoluteFill, styles.dismissLayer]}
          />
        ) : null}
        <KeyboardAvoidingView
          // Inset lift owns avoidance — KAV padding double-counts with absolute
          // bottom sheets (and Android never honored behavior here anyway).
          behavior={undefined}
          keyboardVerticalOffset={0}
          pointerEvents="box-none"
          // Absolute fill (not flex-end). Short fitContent plates must pin with
          // bottom:0 to the modal root — flex-end hosts can leave a dock-sized gap.
          style={[styles.avoid, { paddingTop: insets.top }]}
        >
          <Animated.View
            entering={sheetEntrance}
            ref={plateAgent.ref}
            testID={plateAgent.testID}
            onLayout={(event) => {
              plateAgent.onLayout?.(event);
              const next = Math.round(event.nativeEvent.layout.height);
              onSheetLayout(next);
              if (!lockHeight || lockedHeight != null) return;
              if (next > 0) setLockedHeight(next);
            }}
            pointerEvents="auto"
            style={[
              styles.sheet,
              glass ? styles.sheetGlass : null,
              {
                backgroundColor: glass
                  ? 'transparent'
                  : theme.backgroundElevated,
                borderColor: glass
                  ? dark
                    ? glassMaterials.border.darkStrong
                    : glassMaterials.border.lightStrong
                  : 'transparent',
                maxHeight: sheetMaxHeight,
                minHeight: sheetMinHeight,
                height:
                  bodyScrollMode === 'external'
                    ? sheetMaxHeight
                    : lockHeight
                      ? lockedHeight
                      : undefined,
                paddingHorizontal: layout.screenPadding,
                // Lift flush-bottom sheet above docked IME (chat / add-sheet pattern).
                // Keep an explicit absolute pin — flex-end alone can float the plate.
                position: 'absolute' as const,
                left: 0,
                right: 0,
                bottom: keyboardInset,
              },
              sheetStyle,
            ]}
          >
            {/*
              Glass underlay is a Fabric sibling of header/body — never wrap
              remounting chrome inside BlurView (unmountChildComponentView).
              Always mount BlurView when glass (intensity 0 when blur gated).
            */}
            {glass ? (
              Platform.OS === 'android' ? (
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
                    intensity={allowsBlur ? 64 : 0}
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
                            ? glassMaterials.sheet.darkFillBlur
                            : glassMaterials.sheet.darkFillSolid
                          : allowsBlur
                            ? glassMaterials.sheet.lightFillBlur
                            : glassMaterials.sheet.lightFillSolid,
                      },
                    ]}
                  />
                </>
              )
            ) : null}
            <GestureDetector gesture={headerGesture}>
              <Animated.View
                style={styles.headerSlot}
                onStartShouldSetResponder={() => {
                  Keyboard.dismiss();
                  return false;
                }}
              >
                <SheetHeader
                  eyebrow={eyebrow}
                  title={title}
                  subtitle={subtitle}
                  subtitleIcon={subtitleIcon}
                  decoration={decoration}
                  onClose={close}
                  closeAccessibilityLabel={closeAccessibilityLabel}
                  closeTestID={closeTestID}
                  grabberInteractive={false}
                />
              </Animated.View>
            </GestureDetector>
            {/*
              Bound the ScrollView viewport so tall forms scroll under maxHeight
              (Android Yoga especially). CTA lives in-scroll — never pinned under
              the tab dock / home indicator.
            */}
            {fitContent ? (
              <View
                style={[
                  styles.fitContentBody,
                  {
                    gap: spacing.lg,
                    // Plate pins flush to the physical bottom; keep a small lip
                    // under the last row. Safe-area clearance is the plate itself
                    // covering the home indicator — not an empty frosted band.
                    paddingBottom: bottomPad,
                  },
                  contentContainerStyle,
                ]}
              >
                {children}
                {footer ? (
                  <View style={{ paddingTop: spacing.xs }}>{footer}</View>
                ) : null}
              </View>
            ) : (
              <View style={styles.body}>
                {bodyScrollMode === 'external' ? (
                  <View
                    style={[
                      styles.externalContent,
                      { paddingBottom: bottomPad },
                      contentContainerStyle,
                    ]}
                  >
                    {children}
                    {footer ? (
                      <View style={{ paddingTop: spacing.xs }}>{footer}</View>
                    ) : null}
                  </View>
                ) : (
                  <ScrollView
                    key={scrollKey ?? 'sheet'}
                    ref={scrollRef}
                    scrollEnabled={scrollEnabled}
                    // Sheet lifts via keyboardInset — extra scroll insets would double-pad.
                    automaticallyAdjustKeyboardInsets={false}
                    contentInsetAdjustmentBehavior="never"
                    keyboardDismissMode={
                      Platform.OS === 'ios' ? 'interactive' : 'on-drag'
                    }
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    style={styles.scroll}
                    contentContainerStyle={[
                      styles.content,
                      {
                        gap: spacing.lg,
                        paddingBottom: bottomPad,
                      },
                      contentContainerStyle,
                    ]}
                  >
                    {children}
                    {footer ? (
                      <View style={{ paddingTop: spacing.xs }}>{footer}</View>
                    ) : null}
                  </ScrollView>
                )}
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
        <AppPromptHost embedded />
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  atmosphereUnderlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.55,
  },
  dismissLayer: { zIndex: 0 },
  avoid: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    flexDirection: 'column',
    // Absolute bottom pin — flex-end alone can leave a gap on Android when the
    // dialog window / nav-bar insets disagree with Yoga.
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  sheetGlass: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  /**
   * Dense frosted plate — readable form chrome over the dim scrim.
   * Prior ~0.58 milk let Travel Home trip titles bleed through New Trip fields
   * on Android (no BlurView). Match sheet.lightFillSolid / darkFillSolid.
   */
  androidGlassLight: {
    backgroundColor: glassMaterials.sheet.lightFillSolid,
    experimental_backgroundImage:
      'linear-gradient(165deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.82) 48%, rgba(252,250,246,0.90) 100%)',
  },
  androidGlassDark: {
    backgroundColor: glassMaterials.sheet.darkFillSolid,
    experimental_backgroundImage:
      'linear-gradient(165deg, rgba(36,42,54,0.88) 0%, rgba(12,16,24,0.78) 50%, rgba(8,12,18,0.86) 100%)',
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
  externalContent: { flex: 1, minHeight: 0 },
  content: { flexGrow: 1 },
  fitContentBody: { alignSelf: 'stretch' },
});
