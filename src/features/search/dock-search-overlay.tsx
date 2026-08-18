import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';

import {
  AppText,
  Button,
  GlassPlate,
  Symbol,
} from '@/components/primitives';
import { popoverEntering, popoverExiting, radii, type AppIconName } from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import { sendDockMessage } from '@/features/search/dock-search-actions';
import {
  DOCK_SEARCH_COMPACT_MAX_HEIGHT,
  DOCK_SEARCH_LAYOUT,
  dockSearchOverlayBottom,
  dockSearchResultsGap,
  dockSearchResultsPadding,
} from '@/features/search/dock-search-layout';
import { setCompanionNavigateHandler } from '@/features/search/ensure-companion';
import { useAppSearch } from '@/features/search/use-app-search';
import { useDockSearch } from '@/features/search/dock-search-store';
import { useVoiceSession } from '@/features/search/use-voice-session';
import { useHeldOverlay } from '@/hooks/use-held-overlay';
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
  const collapse = useDockSearch((state) => state.collapse);
  const clearTranscript = useDockSearch((state) => state.clearTranscript);
  const micGeneration = useDockSearch((state) => state.micGeneration);
  const held = useHeldOverlay(expanded);
  const groups = useAppSearch(query);
  const tabBarHeight = useUI((state) => state.tabBarHeight);
  const modalSheetOpen = useUI((state) => state.modalSheetCount > 0);
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

  if (!held) return null;

  const expandLayout = DOCK_SEARCH_LAYOUT === 'expand';
  const fillScreen = expandLayout && showResults;
  const bottom = dockSearchOverlayBottom(
    tabBarHeight,
    layout.bottomNavBarBaseHeight,
    dockSearchResultsGap(spacing.sm),
  );

  const transcriptTurns = transcript.map((turn) => (
    <View key={turn.id} style={{ paddingVertical: spacing.xxs }}>
      <AppText variant="caption" color="secondary" titleCase={false}>
        {turn.role === 'user' ? 'You' : 'onTrack'}
      </AppText>
      <AppText variant="callout" titleCase={false}>
        {turn.text}
      </AppText>
    </View>
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
        <>
          <View
            style={[
              styles.chatHeader,
              { minHeight: layout.minTapTarget },
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
          <AgentTestId testID={AgentUiIds.tabs.searchTranscript}>
            {fillScreen ? (
              transcriptTurns
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: s(180) }}
              >
                {transcriptTurns}
              </ScrollView>
            )}
          </AgentTestId>
        </>
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close Search"
        onPress={() => {
          void voice.cancel();
          collapse();
        }}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlayScrim }]}
      />
      {showPlate ? (
        <Animated.View
          entering={popoverEntering()}
          exiting={popoverExiting()}
          pointerEvents="box-none"
          style={[
            styles.column,
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
                padding: fillScreen
                  ? dockSearchResultsPadding(spacing.lg)
                  : spacing.sm,
                gap: spacing.sm,
              },
            ]}
          >
            {fillScreen ? (
              <AgentTestId testID={AgentUiIds.tabs.searchResults} style={styles.scroller}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  style={styles.scroller}
                  contentContainerStyle={{ gap: spacing.sm }}
                >
                  {plateBody}
                </ScrollView>
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
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
