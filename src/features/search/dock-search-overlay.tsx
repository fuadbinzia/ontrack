import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { GestureDetector } from 'react-native-gesture-handler';

import { AppText } from '@/components/primitives/app-text';
import { Button } from '@/components/primitives/button';
import { GlassPlate } from '@/components/primitives/glass-plate';
import { SheetGrabber } from '@/components/primitives/sheet-grabber';
import { Symbol } from '@/components/primitives/symbol';
import { useSheetDismissPan } from '@/components/primitives/use-sheet-dismiss-pan';
import type { AppIconName } from '@/design-system/icons';
import { easings, motion } from '@/design-system/motion';
import { popoverEntering } from '@/design-system/presence';
import { radii } from '@/design-system/radii';
import { useAuthSession } from '@/features/auth/auth-provider';
import { sendDockMessage } from '@/features/search/dock-search-actions';
import {
  DOCK_SEARCH_BACKDROP_BLUR_INTENSITY,
  DOCK_SEARCH_COMPACT_MAX_HEIGHT,
  DOCK_SEARCH_LAYOUT,
  dockSearchBackdropGradientColors,
  dockSearchOverlayBottom,
  dockSearchResultsGap,
  dockSearchResultsPadding,
} from '@/features/search/dock-search-layout';
import { setCompanionNavigateHandler } from '@/features/search/ensure-companion';
import { useAppSearch } from '@/features/search/use-app-search';
import { useDockSearch, type DockTranscriptTurn } from '@/features/search/dock-search-store';
import { useVoiceSession } from '@/features/search/use-voice-session';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { useUI } from '@/store/ui';
import { useAgentUiTarget, AgentTestId, AgentUiIds } from '@/utils/agent-ui';

function DockSearchResultRow({
  id,
  title,
  subtitle,
  icon,
  onPress,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon: AppIconName;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { spacing, s, layout } = useResponsive();
  const testID = AgentUiIds.tabs.searchResult(id);
  const agent = useAgentUiTarget(testID, { label: title, onPress });
  return (
    <Pressable
      ref={agent.ref}
      testID={testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[styles.row, { minHeight: layout.minTapTarget, gap: spacing.sm }]}
    >
      <Symbol name={icon} size={s(18)} color={theme.accentPrimary} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="callout" titleCase={false}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

function DockSearchTranscriptTurn({ turn }: { turn: DockTranscriptTurn }) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const isUser = turn.role === 'user';
  return (
    <View
      style={[
        styles.turnRow,
        isUser ? styles.turnRowUser : styles.turnRowAssistant,
        {
          gap: spacing.xs,
          paddingVertical: spacing.xxs,
          ...(isUser ? null : { paddingTop: spacing.sm }),
        },
      ]}
    >
      {isUser ? null : (
        <View style={[styles.markSlot, { marginTop: -s(6) }]}>
          <Image
            source={require('../../../assets/images/favicon.png')}
            contentFit="cover"
            cachePolicy="memory"
            transition={0}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: s(26),
              height: s(26),
              borderRadius: s(13),
              overflow: 'hidden',
            }}
          />
        </View>
      )}
      <GlassPlate
        airy
        intensity={48}
        tintColor={isUser ? theme.accentPrimary : undefined}
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <AppText
          variant="callout"
          titleCase={false}
          color={isUser ? 'onAccent' : 'primary'}
        >
          {turn.text}
        </AppText>
      </GlassPlate>
    </View>
  );
}

export function DockSearchOverlay() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { spacing, s, layout } = useResponsive();
  const { isGuest } = useAuthSession();
  const aiEnabled = usePreferences((state) => state.aiEnabled);
  const expanded = useDockSearch((state) => state.expanded);
  const query = useDockSearch((state) => state.query);
  const transcript = useDockSearch((state) => state.transcript);
  const lastTurnId = transcript[transcript.length - 1]?.id;
  const transcriptScrollRef = useRef<ScrollView>(null);
  const collapse = useDockSearch((state) => state.collapse);
  const clearTranscript = useDockSearch((state) => state.clearTranscript);
  const micGeneration = useDockSearch((state) => state.micGeneration);
  const groups = useAppSearch(query);
  const tabBarHeight = useUI((state) => state.tabBarHeight);
  const modalSheetOpen = useUI((state) => state.modalSheetCount > 0);
  const { allowsBlur } = usePerformanceTier();
  const reduceMotion = useReducedMotion();
  const signedIn = !isGuest;

  const onUtterance = useCallback(
    (text: string) => sendDockMessage(text, { signedIn, aiEnabled }),
    [aiEnabled, signedIn],
  );
  const voice = useVoiceSession({
    enabled: expanded,
    onUtterance,
  });
  const { startListening } = voice;
  const micSeen = useRef(0);

  useEffect(() => {
    if (micGeneration === micSeen.current) return;
    micSeen.current = micGeneration;
    if (micGeneration > 0) void startListening();
  }, [micGeneration, startListening]);

  const closeResults = useCallback(() => {
    void voice.cancel();
    collapse();
  }, [collapse, voice]);

  useEffect(() => {
    setCompanionNavigateHandler((href: Href) => {
      router.push(href);
      collapse();
    });
    return () => setCompanionNavigateHandler(null);
  }, [collapse, router]);

  useEffect(() => {
    if (modalSheetOpen) collapse();
  }, [collapse, modalSheetOpen]);

  const scrollTranscriptToEnd = useCallback(() => {
    if (transcript.length === 0) return;
    transcriptScrollRef.current?.scrollToEnd({ animated: true });
  }, [transcript.length]);

  useEffect(() => {
    scrollTranscriptToEnd();
  }, [lastTurnId, scrollTranscriptToEnd]);

  const showResults =
    Boolean(query.trim()) && groups.some((group) => group.items.length > 0);
  // Listening chrome lives on the search field (Stop + wall-clock). Do not
  // mount an empty/stuck wave plate above the input.
  const voiceBusy = voice.phase === 'thinking' || voice.phase === 'speaking';
  const showPlate =
    transcript.length > 0 ||
    showResults ||
    voiceBusy ||
    Boolean(voice.lastError);

  const backdropAgent = useAgentUiTarget(AgentUiIds.tabs.searchBackdrop, {
    label: 'Close Search',
    onPress: closeResults,
  });
  const frosted = Platform.OS === 'ios' && allowsBlur;
  const [backdropTop, backdropMid, backdropBottom] =
    dockSearchBackdropGradientColors({
      dark: theme.name === 'dark',
      blurred: frosted,
    });

  const { headerGesture, sheetStyle, onSheetLayout, held } =
    useSheetDismissPan({
      visible: expanded,
      onClose: closeResults,
    });
  const backdropProgress = useSharedValue(expanded ? 1 : 0);

  useLayoutEffect(() => {
    backdropProgress.value = withTiming(expanded ? 1 : 0, {
      duration: reduceMotion ? 0 : motion.chrome,
      easing: easings.standard,
    });
  }, [backdropProgress, expanded, reduceMotion]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropProgress.value,
  }));

  if (!held) return null;

  const expandLayout = DOCK_SEARCH_LAYOUT === 'expand';
  const fillScreen = expandLayout && (showResults || transcript.length > 0);
  const bottom = dockSearchOverlayBottom(
    tabBarHeight,
    layout.bottomNavBarBaseHeight,
    dockSearchResultsGap(spacing.sm),
  );

  const transcriptTurns = transcript.map((turn) => (
    <DockSearchTranscriptTurn key={turn.id} turn={turn} />
  ));

  const plateBody = (
    <>
      {voice.phase === 'thinking' ? (
        <AppText variant="caption" color="secondary">
          Transcribing…
        </AppText>
      ) : null}
      {voice.phase === 'speaking' ? (
        <Pressable onPress={voice.bargeIn} style={{ minHeight: layout.minTapTarget }}>
          <AppText variant="caption" color="secondary">
            Speaking… Tap to interrupt
          </AppText>
        </Pressable>
      ) : null}
      {voice.lastError ? (
        <AppText variant="caption" color="danger">
          {voice.lastError}
        </AppText>
      ) : null}
      {transcript.length > 0 ? (
        <AgentTestId
          testID={AgentUiIds.tabs.searchTranscript}
          style={fillScreen ? styles.scroller : undefined}
        >
          <ScrollView
            ref={transcriptScrollRef}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollTranscriptToEnd}
            style={fillScreen ? styles.scroller : { maxHeight: s(180) }}
          >
            <View
              style={[
                styles.chatHeader,
                {
                  minHeight: layout.minTapTarget,
                  paddingBottom: spacing.sm,
                },
              ]}
            >
              <Button
                variant="ghost"
                size="sm"
                icon="delete"
                accessibilityLabel="Clear Conversation"
                testID={AgentUiIds.tabs.searchClearConversation}
                onPress={clearTranscript}
              >
                Clear Conversation
              </Button>
            </View>
            {transcriptTurns}
          </ScrollView>
        </AgentTestId>
      ) : null}
      {showResults
        ? groups.map((group) => (
            <View key={group.domain} style={{ gap: spacing.xxs }}>
              <AppText variant="overline">{group.label}</AppText>
              {group.items.map((item) => (
                <DockSearchResultRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  subtitle={item.subtitle}
                  icon={item.icon}
                  onPress={() => {
                    router.push(item.href);
                    collapse();
                  }}
                />
              ))}
            </View>
          ))
        : null}
    </>
  );

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, backdropStyle]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={allowsBlur ? DOCK_SEARCH_BACKDROP_BLUR_INTENSITY : 0}
            tint="dark"
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <LinearGradient
          pointerEvents="none"
          colors={[backdropTop, backdropMid, backdropBottom]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Pressable
        ref={backdropAgent.ref}
        testID={backdropAgent.testID}
        onLayout={backdropAgent.onLayout}
        accessibilityRole="button"
        accessibilityLabel="Close Search"
        onPress={closeResults}
        style={StyleSheet.absoluteFill}
      />
      {showPlate ? (
        <Animated.View
          onLayout={(event) => {
            onSheetLayout(Math.round(event.nativeEvent.layout.height));
          }}
          entering={popoverEntering()}
          pointerEvents="box-none"
          style={[
            styles.column,
            sheetStyle,
            {
              left: spacing.md,
              right: spacing.md,
              bottom,
              ...(fillScreen
                ? { top: insets.top }
                : { maxHeight: s(DOCK_SEARCH_COMPACT_MAX_HEIGHT) }),
            },
          ]}
        >
          <GlassPlate
            style={[
              fillScreen ? styles.plateExpand : styles.plateCompact,
              {
                borderRadius: radii.lg,
                paddingHorizontal: fillScreen
                  ? dockSearchResultsPadding(spacing.lg)
                  : spacing.sm,
                paddingBottom: fillScreen
                  ? dockSearchResultsPadding(spacing.lg)
                  : spacing.sm,
                paddingTop: fillScreen ? spacing.xs : spacing.sm,
                gap: spacing.sm,
              },
            ]}
          >
            {fillScreen ? (
              <GestureDetector gesture={headerGesture}>
                <View style={styles.grabberWrap}>
                  <SheetGrabber
                    testID={AgentUiIds.tabs.searchClose}
                    onPress={closeResults}
                    accessibilityLabel="Close Search"
                    interactive={false}
                  />
                </View>
              </GestureDetector>
            ) : null}
            {fillScreen ? (
              <AgentTestId testID={AgentUiIds.tabs.searchResults} style={styles.scroller}>
                {transcript.length > 0 ? (
                  <View style={[styles.scroller, { gap: spacing.sm }]}>
                    {plateBody}
                  </View>
                ) : (
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    style={styles.scroller}
                    contentContainerStyle={{ gap: spacing.sm }}
                  >
                    {plateBody}
                  </ScrollView>
                )}
              </AgentTestId>
            ) : (
              plateBody
            )}
          </GlassPlate>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    position: 'absolute',
  },
  plateExpand: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  plateCompact: {
    overflow: 'visible',
  },
  scroller: {
    flex: 1,
    minHeight: 0,
  },
  grabberWrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  chatHeader: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnRow: {
    flexDirection: 'row',
    maxWidth: '84%',
  },
  turnRowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  turnRowAssistant: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  markSlot: {
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  bubble: {
    flexShrink: 1,
    minWidth: 0,
    borderCurve: 'continuous',
  },
  userBubble: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.sm,
  },
  assistantBubble: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    borderBottomLeftRadius: radii.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
