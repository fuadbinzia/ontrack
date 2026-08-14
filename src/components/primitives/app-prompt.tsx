import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useId, type ReactNode } from 'react';
import {
    BackHandler,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    useWindowDimensions,
    View,
    type ModalProps,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { create } from 'zustand';

import {
    appTextStyle,
    borders,
    layout,
    motion,
    radii,
    spacing,
    springs,
    type AppIconName,
    type Theme,
} from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import { AppText } from './app-text';
import { fieldTitleCase } from './field-title-case';
import { GlassIconWell } from './glass-icon-well';
import { GlassPlate } from './glass-plate';
import { Symbol } from './symbol';

type PromptActionStyle = 'default' | 'cancel' | 'destructive' | 'primary' | 'secondary';

interface PromptAction {
  text: string;
  onPress?: () => void;
  style?: PromptActionStyle;
  hideIcon?: boolean;
  disabled?: boolean;
  testID?: string;
}

interface PromptRequest {
  id: number;
  title: string;
  message?: string;
  content?: ReactNode;
  actions: PromptAction[];
  cancelable: boolean;
  scrollableMessage?: boolean;
  icon?: AppIconName | null;
  theme?: Theme;
  onDismiss?: () => void;
  supportedOrientations?: ModalProps['supportedOrientations'];
}

interface PromptState {
  request: PromptRequest | null;
  embeddedHostIds: string[];
  show: (request: PromptRequest) => void;
  dismiss: () => void;
  registerEmbeddedHost: (id: string) => void;
  unregisterEmbeddedHost: (id: string) => void;
}

interface AppAlertOptions {
  cancelable?: boolean;
  scrollableMessage?: boolean;
  /** Prompt header mark. Pass null when custom content owns the visual identity. */
  icon?: AppIconName | null;
  content?: ReactNode;
  theme?: Theme;
  onDismiss?: () => void;
  supportedOrientations?: ModalProps['supportedOrientations'];
}

interface AppActionSheetOptions {
  title?: string;
  message?: string;
  options: string[];
  cancelButtonIndex?: number;
  destructiveButtonIndex?: number | number[];
  disabledButtonIndices?: number[];
}

const useAppPrompt = create<PromptState>((set) => ({
  request: null,
  embeddedHostIds: [],
  show: (request) => set({ request }),
  dismiss: () => set({ request: null }),
  registerEmbeddedHost: (id) =>
    set((state) => ({
      embeddedHostIds: state.embeddedHostIds.includes(id)
        ? state.embeddedHostIds
        : [...state.embeddedHostIds, id],
    })),
  unregisterEmbeddedHost: (id) =>
    set((state) => ({
      embeddedHostIds: state.embeddedHostIds.filter((hostId) => hostId !== id),
    })),
}));

let nextPromptId = 0;

function showPrompt(
  request: Omit<PromptRequest, 'id'>,
) {
  nextPromptId += 1;
  useAppPrompt.getState().show({ ...request, id: nextPromptId });
}

export const appPrompt = {
  alert(
    title: string,
    message?: string,
    actions?: PromptAction[],
    options?: AppAlertOptions,
  ) {
    const resolvedActions =
      actions && actions.length > 0 ? actions : [{ text: 'OK' }];
    showPrompt({
      title,
      message,
      content: options?.content,
      actions: resolvedActions,
      cancelable:
        options?.cancelable === true ||
        resolvedActions.some((action) => action.style === 'cancel'),
      scrollableMessage: options?.scrollableMessage,
      icon: options?.icon,
      theme: options?.theme,
      onDismiss: options?.onDismiss,
      supportedOrientations: options?.supportedOrientations,
    });
  },

  actionSheet(
    options: AppActionSheetOptions,
    callback: (buttonIndex: number) => void,
  ) {
    const destructiveIndices = new Set(
      Array.isArray(options.destructiveButtonIndex)
        ? options.destructiveButtonIndex
        : options.destructiveButtonIndex === undefined
          ? []
          : [options.destructiveButtonIndex],
    );
    const disabledIndices = new Set(options.disabledButtonIndices ?? []);
    showPrompt({
      title: options.title ?? 'Choose an Option',
      message: options.message,
      actions: options.options.map((text, index) => ({
        text,
        disabled: disabledIndices.has(index),
        style:
          index === options.cancelButtonIndex
            ? 'cancel'
            : destructiveIndices.has(index)
              ? 'destructive'
              : 'default',
        onPress: () => callback(index),
      })),
      cancelable: options.cancelButtonIndex !== undefined,
    });
  },

  dismiss() {
    useAppPrompt.getState().dismiss();
  },
};

export function AppPromptHost({ embedded = false }: { embedded?: boolean }) {
  const { height: windowHeight } = useWindowDimensions();
  const hostTheme = useTheme();
  const request = useAppPrompt((state) => state.request);
  const theme = request?.theme ?? hostTheme;
  const dismiss = useAppPrompt((state) => state.dismiss);
  const embeddedHostIds = useAppPrompt((state) => state.embeddedHostIds);
  const registerEmbeddedHost = useAppPrompt((state) => state.registerEmbeddedHost);
  const unregisterEmbeddedHost = useAppPrompt((state) => state.unregisterEmbeddedHost);
  const embeddedHostId = useId();
  const activeEmbeddedHostId = embeddedHostIds.at(-1);
  const active = embedded
    ? activeEmbeddedHostId === embeddedHostId
    : activeEmbeddedHostId === undefined;

  useEffect(() => {
    if (!embedded) return;
    registerEmbeddedHost(embeddedHostId);
    return () => unregisterEmbeddedHost(embeddedHostId);
  }, [embedded, embeddedHostId, registerEmbeddedHost, unregisterEmbeddedHost]);

  const close = (action?: PromptAction) => {
    dismiss();
    action?.onPress?.();
  };

  const cancel = useCallback(() => {
    if (!request?.cancelable) return;
    const cancelAction = request.actions.find(
      (action) => action.style === 'cancel',
    );
    dismiss();
    cancelAction?.onPress?.();
    request.onDismiss?.();
  }, [dismiss, request]);

  const closeAgent = useAgentUiTarget(
    active && request?.cancelable ? AgentUiIds.prompt.close : undefined,
    { label: 'Close', onPress: cancel },
  );

  useEffect(() => {
    if (!active || !request) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!request.cancelable) return true;
        cancel();
        return true;
      },
    );
    return () => subscription.remove();
  }, [active, cancel, request]);

  if (!active || !request) return null;

  const visibleActions = request.actions.filter(
    (action) => action.style !== 'cancel',
  );
  const promptBody = request.content ?? (request.message ? (
    <AppText
      selectable
      style={[styles.message, { color: theme.textSecondary }]}>
      {request.message}
    </AppText>
  ) : null);

  const content = (
    <Animated.View
      key={request.id}
      accessibilityViewIsModal
      entering={FadeIn.duration(motion.fade).reduceMotion(ReduceMotion.System)}
      pointerEvents="box-none"
      style={[styles.overlay, embedded ? styles.embeddedOverlay : undefined]}>
      <BlurView
        intensity={18}
        tint={theme.name === 'dark' ? 'dark' : 'light'}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        accessibilityLabel={
          request.cancelable ? 'Dismiss prompt' : undefined
        }
        disabled={!request.cancelable}
        onPress={cancel}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.overlayScrim },
        ]}
      />
      <Animated.View
        entering={FadeInDown.springify()
          .damping(springs.gentle.damping)
          .stiffness(springs.gentle.stiffness)
          .reduceMotion(ReduceMotion.System)}
        style={[
          styles.cardShell,
          {
            boxShadow:
              theme.name === 'dark'
                ? '0 18px 50px rgba(0, 0, 0, 0.48)'
                : '0 18px 50px rgba(54, 43, 33, 0.22)',
          },
        ]}>
        <GlassPlate
          style={[
            styles.card,
            {
              borderColor: theme.separator,
            },
          ]}>
          <View style={styles.cardContent}>
        {request.cancelable ? (
          <Pressable
            ref={closeAgent.ref}
            accessibilityLabel="Close"
            accessibilityRole="button"
            testID={AgentUiIds.prompt.close}
            onLayout={closeAgent.onLayout}
            hitSlop={8}
            onPress={cancel}
            style={({ pressed }) => [
              styles.closeButton,
              {
                opacity: pressed ? 0.58 : 1,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}>
            <GlassPlate airy style={styles.closeButtonPlate}>
              <Symbol name="close" size={16} color={theme.textSecondary} />
            </GlassPlate>
          </Pressable>
        ) : null}
        {request.icon !== null ? (
          <GlassIconWell size={46} borderRadius={radii.pill} style={styles.brandMark}>
            <Symbol name={request.icon ?? 'smart'} size={22} color={theme.accentPrimary} />
          </GlassIconWell>
        ) : null}
        <View style={styles.copy}>
          <AppText
            accessibilityRole="header"
            style={[styles.title, { color: theme.textPrimary }]}>
            {request.title}
          </AppText>
          {promptBody ? (
            request.scrollableMessage ? (
              <AgentTestId
                testID={AgentUiIds.prompt.messageScroll}
                label="Prompt message list"
                style={[
                  styles.messageScrollFrame,
                  { maxHeight: Math.max(140, Math.min(360, windowHeight * 0.38)) },
                ]}>
                <ScrollView
                  accessibilityLabel="Prompt message list"
                  bounces={false}
                  contentContainerStyle={styles.messageScrollContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator>
                  {promptBody}
                </ScrollView>
              </AgentTestId>
            ) : (
              promptBody
            )
          ) : null}
        </View>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.actions}
          showsVerticalScrollIndicator={false}>
          {visibleActions.map((action, index) => {
            const destructive = action.style === 'destructive';
            const primary = action.style === 'primary';
            const secondary = action.style === 'secondary';
            const foreground = primary
              ? theme.textOnAccent
              : destructive
                ? theme.danger
                : theme.textPrimary;
            const background = primary
              ? theme.accentPrimary
              : destructive
                ? theme.name === 'dark'
                  ? '#3A2020'
                  : '#F8E8E5'
                : secondary
                  ? theme.backgroundElevated
                  : theme.backgroundSunken;
            const borderColor = primary ? 'transparent' : theme.separator;
            const useGlass = !primary && !destructive;

            return (
              <PromptActionButton
                key={`${action.text}-${index}`}
                action={action}
                background={background}
                borderColor={borderColor}
                foreground={foreground}
                glass={useGlass}
                glassSunken={!secondary}
                icon={destructive ? 'delete' : undefined}
                onPress={() => close(action)}
                testID={action.testID ?? AgentUiIds.prompt.action(index)}
              />
            );
          })}
        </ScrollView>
          </View>
        </GlassPlate>
      </Animated.View>
    </Animated.View>
  );

  if (embedded) return content;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      supportedOrientations={request.supportedOrientations}
      onRequestClose={cancel}>
      {content}
    </Modal>
  );
}

function PromptActionButton({
  action,
  background,
  borderColor,
  foreground,
  glass = false,
  glassSunken = false,
  icon,
  onPress,
  testID,
}: {
  action: PromptAction;
  background: string;
  borderColor: string;
  foreground: string;
  glass?: boolean;
  glassSunken?: boolean;
  icon?: 'delete';
  onPress: () => void;
  testID: string;
}) {
  const title = fieldTitleCase(action.text);
  const agent = useAgentUiTarget(testID, {
    label: title,
    onPress,
  });

  const button = (
    <Pressable
      ref={agent.ref}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      testID={agent.testID}
      onLayout={agent.onLayout}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: glass ? 'transparent' : background,
          borderColor,
          opacity: action.disabled ? 0.38 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.992 : 1 }],
          zIndex: 1,
        },
      ]}>
      {icon && !action.hideIcon ? (
        <Symbol name={icon} size={17} color={foreground} />
      ) : null}
      <AppText
        variant="callout"
        allowFontScaling={false}
        numberOfLines={2}
        style={[styles.actionLabel, { color: foreground }]}>
        {title}
      </AppText>
    </Pressable>
  );

  if (!glass) return button;

  return (
    <GlassPlate
      airy={glassSunken}
      style={[styles.actionShell, { borderColor }]}>
      {button}
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.xl,
  },
  embeddedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 4,
  },
  cardShell: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '88%',
  },
  card: {
    width: '100%',
    maxHeight: '100%',
    borderWidth: borders.hairline,
    borderRadius: 28,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardContent: {
    position: 'relative',
    maxHeight: '100%',
    gap: spacing.lg,
    padding: spacing.xl,
    zIndex: 1,
  },
  closeButton: {
    position: 'absolute',
    zIndex: 2,
    top: spacing.md,
    right: spacing.md,
  },
  closeButtonPlate: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  brandMark: {
    alignSelf: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...appTextStyle('title'),
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    ...appTextStyle('body'),
    textAlign: 'center',
    lineHeight: 22,
  },
  messageScrollFrame: {
    flexShrink: 1,
    minHeight: 120,
    width: '100%',
  },
  messageScrollContent: {
    paddingHorizontal: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    width: '100%',
  },
  action: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: borders.hairline,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  actionLabel: {
    ...appTextStyle('callout'),
    flex: 0,
    textAlign: 'center',
  },
  actionShell: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});
