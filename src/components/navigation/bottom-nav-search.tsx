import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  AppText,
  GlassPlate,
  IconButton,
  Input,
  Symbol,
} from '@/components/primitives';
import { glassMaterials, easings, motion, radii } from '@/design-system';
import { AuthBrandMark } from '@/features/auth/auth-brand-mark';
import { formatVoiceDuration } from '@/features/journal/model';
import { sendDockMessage } from '@/features/search/dock-search-actions';
import {
  DOCK_SEARCH_INPUT_MAX_LINES,
  DOCK_SEARCH_LAYOUT,
  dockSearchFieldHeightForLineCount,
  dockSearchWrappedLineCount,
} from '@/features/search/dock-search-layout';
import { useDockSearch } from '@/features/search/dock-search-store';
import { LISTEN_TICK_MS, listenElapsedMs } from '@/features/search/listen-elapsed';
import { useHeldOverlay } from '@/hooks/use-held-overlay';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget, AgentUiIds } from '@/utils/agent-ui';

const LONG_PRESS_MS = 400;

function DockSearchListenElapsed({ startedAt }: { startedAt: number | null }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), LISTEN_TICK_MS);
    return () => clearInterval(id);
  }, [startedAt]);
  return (
    <AppText variant="caption" color="secondary" style={styles.elapsed}>
      {formatVoiceDuration(listenElapsedMs(startedAt, nowMs))}
    </AppText>
  );
}

export function BottomNavSearch({
  railWidth,
  collapsedWidth,
  signedIn,
  aiEnabled,
}: {
  railWidth: number;
  collapsedWidth?: number;
  signedIn: boolean;
  aiEnabled: boolean;
}) {
  const onMic = useDockSearch((state) => state.requestMic);
  const onStop = useDockSearch((state) => state.requestStop);
  const listening = useDockSearch((state) => state.listening);
  const listenStartedAt = useDockSearch((state) => state.listenStartedAt);
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { spacing, layout, s, typography } = useResponsive();
  const expanded = useDockSearch((state) => state.expanded);
  const query = useDockSearch((state) => state.query);
  const expand = useDockSearch((state) => state.expand);
  const setQuery = useDockSearch((state) => state.setQuery);
  const setFieldHeight = useDockSearch((state) => state.setFieldHeight);
  const held = useHeldOverlay(expanded, motion.chrome);
  const well = collapsedWidth ?? Math.max(layout.minTapTarget, s(44));
  const inputBaseHeight = Math.max(layout.minTapTarget, s(44));
  const expandLayout = DOCK_SEARCH_LAYOUT === 'expand';
  const oneLineHeight = typography.body.lineHeight;
  const [lineCount, setLineCount] = useState(1);
  const [trailingWidth, setTrailingWidth] = useState(0);
  const progress = useSharedValue(expanded ? 1 : 0);
  const listenOnExpand = useDockSearch((state) => state.listenOnExpand);
  const [skipFocus, setSkipFocus] = useState(listenOnExpand);
  const [focusReady, setFocusReady] = useState(false);
  const wellAgent = useAgentUiTarget(AgentUiIds.tabs.search, {
    label: 'Ask AI',
    onPress: () => expand(),
  });
  const visibleLines = Math.min(lineCount, DOCK_SEARCH_INPUT_MAX_LINES);
  const grownHeight = dockSearchFieldHeightForLineCount(
    inputBaseHeight,
    oneLineHeight,
    visibleLines,
  );
  const fieldShellHeight = expandLayout && expanded ? grownHeight : well;
  const shellHeight = useSharedValue(fieldShellHeight);

  useEffect(() => {
    shellHeight.value = withTiming(fieldShellHeight, {
      duration: reduceMotion ? 0 : motion.chrome,
      easing: easings.standard,
    });
  }, [fieldShellHeight, reduceMotion, shellHeight]);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: reduceMotion ? 0 : motion.chrome,
      easing: easings.standard,
    });
  }, [expanded, progress, reduceMotion]);

  useEffect(() => {
    if (!expanded) {
      Keyboard.dismiss();
      setSkipFocus(false);
      setFocusReady(false);
      setLineCount(1);
      return;
    }
    const listen = useDockSearch.getState().listenOnExpand;
    if (listen) {
      setSkipFocus(true);
      onMic();
      useDockSearch.getState().clearListenOnExpand();
      return;
    }
    const timer = setTimeout(() => {
      setFocusReady(true);
    }, reduceMotion ? 0 : motion.chrome);
    return () => clearTimeout(timer);
  }, [expanded, onMic, reduceMotion]);

  useEffect(() => {
    if (expandLayout && expanded) {
      setFieldHeight(fieldShellHeight);
      return;
    }
    if (held) {
      setFieldHeight(inputBaseHeight);
    }
  }, [expandLayout, expanded, fieldShellHeight, held, inputBaseHeight, setFieldHeight]);

  const shellStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [well, railWidth]),
    height: interpolate(progress.value, [0, 1], [well, shellHeight.value]),
  }));
  const wellFade = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.45], [1, 0]),
  }));
  const fieldFade = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.35, 1], [0, 1]),
  }));

  const send = () => {
    void sendDockMessage(query, { signedIn, aiEnabled });
  };

  const onChangeQuery = useCallback(
    (next: string) => {
      setQuery(next);
      if (!next.trim()) setLineCount(1);
    },
    [setQuery],
  );

  const onContentSizeChange = useCallback(
    (event: { nativeEvent: { contentSize: { height: number } } }) => {
      if (!expandLayout) return;
      const next = dockSearchWrappedLineCount(
        event.nativeEvent.contentSize.height,
        oneLineHeight,
      );
      setLineCount((current) => (current === next ? current : next));
    },
    [expandLayout, oneLineHeight],
  );

  const plateRadius = radii.pill;
  const controlSize = Math.max(36, s(40));
  const trailingPad =
    trailingWidth > 0 ? trailingWidth + spacing.xs : controlSize * 3 + spacing.xs;
  const tabIconSize = s(20);
  const tabCaptionStyle = useMemo(
    () => ({
      fontSize: s(9.5),
      lineHeight: s(11),
      width: '100%' as const,
      minWidth: 0,
      flexShrink: 1,
    }),
    [s],
  );
  const fieldContainerStyle = useMemo(
    () => [styles.field, { height: fieldShellHeight }],
    [fieldShellHeight],
  );
  const fieldInputStyle = useMemo(
    () => ({
      minHeight: fieldShellHeight,
      height: fieldShellHeight,
      maxHeight: expandLayout
        ? Math.ceil(oneLineHeight) * DOCK_SEARCH_INPUT_MAX_LINES
        : well,
      paddingVertical: 0,
      textAlignVertical: 'center' as const,
      paddingRight: expandLayout ? trailingPad : undefined,
    }),
    [expandLayout, fieldShellHeight, oneLineHeight, trailingPad, well],
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.shell,
        { zIndex: 2 },
        shellStyle,
      ]}
    >
      <Animated.View
        pointerEvents={expanded ? 'none' : 'auto'}
        style={[styles.wellContainer, wellFade]}
      >
        <Pressable
          ref={wellAgent.ref}
          testID={AgentUiIds.tabs.search}
          onLayout={wellAgent.onLayout}
          accessibilityRole="button"
          accessibilityLabel="Ask AI"
          delayLongPress={LONG_PRESS_MS}
          onPress={() => expand()}
          onLongPress={() => expand({ listen: true })}
          style={({ pressed }) => [
            styles.tab,
            {
              width: well,
              minHeight: layout.minTapTarget,
              paddingVertical: spacing.xxs,
              paddingHorizontal: s(2),
            },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.iconSlot}>
            <AuthBrandMark
              size={s(20)}
              showContainer={false}
              orbitTilted={true}
              markColor={theme.textSecondary}
            />
          </View>
          <Animated.Text
            allowFontScaling
            maxFontSizeMultiplier={1.1}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.68}
            style={[
              typography.caption,
              tabCaptionStyle,
              styles.caption,
              { fontWeight: '400', color: theme.textSecondary },
            ]}
          >
            Ask AI
          </Animated.Text>
          <View style={{ height: s(6) }} />
        </Pressable>
      </Animated.View>
      {held ? (
        <Animated.View
          pointerEvents={expanded ? 'auto' : 'none'}
          style={[styles.fieldWrap, fieldFade]}
        >
          <GlassPlate
            style={[
              styles.plate,
              {
                borderRadius: plateRadius,
                borderColor:
                  theme.name === 'dark'
                    ? glassMaterials.border.darkStrong
                    : glassMaterials.border.light,
              },
            ]}
          >
            <Input
              value={query}
              onChangeText={onChangeQuery}
              placeholder="Ask onTrack or Search..."
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Search"
              returnKeyType="send"
              onSubmitEditing={send}
              blurOnSubmit
              autoFocus={expanded && focusReady && !skipFocus}
              fieldBackground="transparent"
              fieldBorderColor="transparent"
              fieldBorderRadius={plateRadius}
              icon="search"
              testID={AgentUiIds.tabs.searchField}
              containerStyle={fieldContainerStyle}
              multiline={expandLayout}
              scrollEnabled={expandLayout}
              onContentSizeChange={onContentSizeChange}
              style={fieldInputStyle}
              trailing={
                <View
                  style={[styles.trailing, { gap: spacing.xxs }]}
                  onLayout={(event) => {
                    const width = Math.ceil(event.nativeEvent.layout.width);
                    setTrailingWidth((current) => (current === width ? current : width));
                  }}
                >
                  {listening ? (
                    <>
                      <DockSearchListenElapsed startedAt={listenStartedAt} />
                      <IconButton
                        icon="stop"
                        accessibilityLabel="Stop"
                        testID={AgentUiIds.tabs.searchStop}
                        size={controlSize}
                        onPress={onStop}
                      />
                    </>
                  ) : (
                    <IconButton
                      icon="microphone"
                      accessibilityLabel="Speak"
                      testID={AgentUiIds.tabs.searchMic}
                      size={controlSize}
                      onPress={onMic}
                    />
                  )}
                  <IconButton
                    icon="send"
                    accessibilityLabel="Send"
                    testID={AgentUiIds.tabs.searchSend}
                    size={controlSize}
                    disabled={!query.trim()}
                    color={query.trim() ? theme.textOnAccent : theme.textSecondary}
                    background={query.trim() ? theme.accentPrimary : undefined}
                    appearance={query.trim() ? 'solid' : 'glass'}
                    onPress={send}
                  />
                </View>
              }
            />
          </GlassPlate>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  wellContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pressed: {
    opacity: 0.72,
  },
  iconSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    textAlign: 'center',
  },
  plate: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fieldWrap: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  field: {
    width: '100%',
    minWidth: 0,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  elapsed: {
    fontVariant: ['tabular-nums'],
  },
});
