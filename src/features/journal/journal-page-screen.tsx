import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bottomNavBottomPad } from '@/components/navigation/bottom-nav-inset';
import { TAB_META } from '@/components/navigation/bottom-nav-tab-meta';
import {
  HeaderBackButton,
  IconButton,
  Screen,
  ScreenHeader,
} from '@/components/primitives';
import { useDockedKeyboardInset } from '@/hooks/use-docked-keyboard-inset';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAddons } from '@/store/addons';
import { useJournal } from '@/store/journal';
import { useUI } from '@/store/ui';
import { AgentUiIds } from '@/utils/agent-ui';
import { formatDateKeyMedium, formatWeekday, todayKey } from '@/utils/date';

import { JournalBlockList } from './journal-block-list';
import { JournalEarlierList } from './journal-earlier-list';
import {
  JournalAddMenu,
  JournalComposer,
  useJournalComposer,
} from './journal-composer';
import { JournalSectionLinkSheet } from './journal-section-link-sheet';
import {
  canShiftJournalDate,
  earlierJournalPages,
  journalEditDismissFor,
  journalPageHref,
  journalSectionLinks,
  pageForDate,
  shiftJournalDate,
} from './model';

export function JournalPageScreen({
  dateKey,
  showEarlier = false,
}: {
  dateKey: string;
  showEarlier?: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { spacing, layout } = useResponsive();
  const enabledAddons = useAddons((state) => state.enabled);
  const pages = useJournal((state) => state.pages);
  const ensurePage = useJournal((state) => state.ensurePage);
  const removeBlock = useJournal((state) => state.removeBlock);
  const updateText = useJournal((state) => state.updateText);
  const undoText = useJournal((state) => state.undoText);
  const redoText = useJournal((state) => state.redoText);
  const textHistory = useJournal((state) => state.textHistory[dateKey]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const composer = useJournalComposer(dateKey, () => setLinkOpen(true));
  const dismissEdit = useCallback((reason: 'tap-out' | 'composer-focus' = 'tap-out') => {
    const next = journalEditDismissFor(reason);
    if (next.hideKeyboard) Keyboard.dismiss();
    setEditingBlockId(null);
  }, []);
  const today = todayKey();
  const isToday = dateKey === today;
  const measuredTabBarHeight = useUI((state) => state.tabBarHeight);
  const navTabBarHeight = useBottomTabBarHeight();
  const { keyboardInset, keyboardOpen } = useDockedKeyboardInset({
    androidMode: 'resize',
  });
  const tabBarHeight = Math.max(
    measuredTabBarHeight,
    navTabBarHeight,
    layout.bottomNavBarBaseHeight + bottomNavBottomPad(insets.bottom, spacing.sm),
  );
  const composerDockGap = spacing.sm;
  const dockBottom = keyboardOpen
    ? keyboardInset
    : tabBarHeight + composerDockGap;

  useEffect(() => {
    ensurePage(dateKey);
  }, [dateKey, ensurePage]);

  const page = pageForDate(pages, dateKey);
  const earlier = useMemo(
    () => (showEarlier ? earlierJournalPages(pages, today) : []),
    [pages, showEarlier, today],
  );
  const links = useMemo(() => journalSectionLinks(enabledAddons), [enabledAddons]);

  const openSection = (section: string) => {
    const meta = TAB_META[section];
    if (!meta) return;
    router.push(meta.href);
  };

  const openJournalDate = (nextKey: string) => {
    const href = journalPageHref(nextKey, today);
    if (href === '/(tabs)/journal') {
      if (!showEarlier) router.replace(href);
      return;
    }
    if (showEarlier) {
      router.push(href);
      return;
    }
    router.replace(href);
  };

  const goAdjacent = (delta: -1 | 1) => {
    if (!canShiftJournalDate(dateKey, delta, today)) return;
    openJournalDate(shiftJournalDate(dateKey, delta, today));
  };

  return (
    <Screen
      scroll={false}
      refresh={false}
      bottomInset={false}
      contentStyle={styles.page}>
      <Pressable onPress={() => dismissEdit('tap-out')}>
        <ScreenHeader
          title="Journal"
          titleMeta={formatDateKeyMedium(dateKey)}
          eyebrow={isToday ? 'Today' : formatWeekday(dateKey)}
          leading={
            showEarlier ? undefined : (
              <HeaderBackButton
                compact
                accessibilityLabel="Back to Journal"
                fallback="/(tabs)/journal"
                testID={AgentUiIds.journal.back}
              />
            )
          }
          titleTrailing={
            <View style={[styles.headerActions, { gap: spacing.xs }]}>
              <IconButton
                icon="chevron-left"
                accessibilityLabel="Previous Day"
                testID={AgentUiIds.journal.prevDay}
                onPress={() => goAdjacent(-1)}
              />
              <IconButton
                icon="chevron-right"
                accessibilityLabel="Next Day"
                testID={AgentUiIds.journal.nextDay}
                disabled={!canShiftJournalDate(dateKey, 1, today)}
                onPress={() => goAdjacent(1)}
              />
            </View>
          }
          trailing={
            <View style={[styles.headerActions, { gap: spacing.xs }]}>
              <IconButton
                icon="undo"
                accessibilityLabel="Undo"
                testID={AgentUiIds.journal.undo}
                disabled={!textHistory?.undo.length}
                onPress={() => {
                  dismissEdit('tap-out');
                  undoText(dateKey);
                }}
              />
              <IconButton
                icon="redo"
                accessibilityLabel="Redo"
                testID={AgentUiIds.journal.redo}
                disabled={!textHistory?.redo.length}
                onPress={() => {
                  dismissEdit('tap-out');
                  redoText(dateKey);
                }}
              />
              <IconButton
                icon={managing ? 'check' : 'edit'}
                accessibilityLabel={managing ? 'Done' : 'Edit Page'}
                testID={AgentUiIds.journal.editMode}
                color={managing ? theme.accentPrimary : undefined}
                onPress={() => setManaging((on) => !on)}
              />
              <JournalAddMenu session={composer} />
            </View>
          }
        />
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.canvas, { paddingTop: spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: spacing.md }}>
          <View testID={isToday ? AgentUiIds.journal.today : AgentUiIds.journal.screen}>
            <JournalBlockList
              blocks={page?.blocks ?? []}
              editingBlockId={editingBlockId}
              onEditingBlockIdChange={setEditingBlockId}
              onOpenLink={openSection}
              onRemove={(blockId) => removeBlock(dateKey, blockId)}
              onUpdateText={(blockId, text) => updateText(dateKey, blockId, text)}
              showDeletes={managing}
            />
          </View>
          {showEarlier ? (
            <JournalEarlierList
              pages={earlier}
              onOpen={(nextKey) => router.push(`/(tabs)/journal/${nextKey}`)}
            />
          ) : null}
        </View>
        <Pressable
          accessibilityLabel="Dismiss Editor"
          testID={AgentUiIds.journal.dismissEdit}
          onPress={() => dismissEdit('tap-out')}
          style={styles.dismissEdit}
        />
      </ScrollView>

      <View style={{ paddingBottom: dockBottom }}>
        <JournalComposer
          session={composer}
          onFieldFocus={() => dismissEdit('composer-focus')}
        />
      </View>

      <JournalSectionLinkSheet
        visible={linkOpen}
        links={links}
        onClose={() => setLinkOpen(false)}
        onSelect={(link) => {
          useJournal.getState().addLink(dateKey, link.section, link.label);
          setLinkOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingBottom: 0,
  },
  scroll: {
    flex: 1,
  },
  canvas: {
    flexGrow: 1,
  },
  dismissEdit: {
    flexGrow: 1,
    minHeight: 48,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
