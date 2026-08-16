import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassPlate, Screen, Symbol } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useJournal } from '@/store/journal';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { todayKey } from '@/utils/date';
import { useWarmHrefs } from '@/utils/warm-navigation';
import { haptics } from '@/utils/haptics';

import {
  journalLandingFontFamily,
  useJournalLandingAtmosphere,
} from './journal-landing-atmosphere';
import { JournalLandingEmpty } from './journal-landing-empty';
import { JournalLandingPages } from './journal-landing-pages';
import { journalPageHref, writtenJournalPages } from './model';

export function JournalHub() {
  const router = useRouter();
  const { s, spacing, layout } = useResponsive();
  const { dark, ink, muted } = useJournalLandingAtmosphere();
  const rawPages = useJournal((state) => state.pages);
  const pages = useMemo(() => writtenJournalPages(rawPages), [rawPages]);
  const today = todayKey();
  useWarmHrefs([journalPageHref(today)]);
  const hasPages = pages.length > 0;
  const hasToday = pages.some((page) => page.dateKey === today);
  const titleSize = Math.max(42, s(46));
  const taglineSize = Math.max(13, s(13));
  const addVisual = Math.max(44, s(48));
  const addHit = Math.max(layout.minTapTarget, addVisual);

  const openToday = () => {
    haptics.tap();
    router.push(journalPageHref(today));
  };

  return (
    <View style={styles.fill}>
      <Screen
        style={styles.transparentScreen}
        refresh={false}
        contentStyle={styles.content}>
        <AgentTestId testID={AgentUiIds.journal.hub}>
          <View
            style={[
              styles.header,
              {
                paddingTop: Math.max(4, spacing.xs),
                paddingBottom: spacing.sm,
              },
            ]}>
            <View style={styles.titleRow}>
              <AppText
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: ink,
                  fontFamily: journalLandingFontFamily,
                  fontSize: titleSize,
                  lineHeight: Math.round(titleSize * 1.12),
                  fontWeight: '400',
                }}>
                Journal
              </AppText>
              {hasPages && !hasToday ? (
                <AgentTestId
                  testID={AgentUiIds.journal.openToday}
                  label="Write Today"
                  onPress={openToday}
                  style={{ width: addHit, height: addHit }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Write Today"
                    onPress={openToday}
                    hitSlop={4}
                    style={({ pressed }) => [
                      styles.addButton,
                      {
                        width: addVisual,
                        height: addVisual,
                        borderRadius: addVisual / 2,
                        opacity: pressed ? 0.84 : 1,
                      },
                    ]}>
                    <GlassPlate
                      intensity={dark ? 44 : 56}
                      style={{
                        width: addVisual,
                        height: addVisual,
                        borderRadius: addVisual / 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Symbol
                        name="add"
                        size={Math.max(18, s(20))}
                        color={dark ? ink : '#000000'}
                      />
                    </GlassPlate>
                  </Pressable>
                </AgentTestId>
              ) : null}
            </View>
            <AppText
              numberOfLines={1}
              style={{
                marginTop: Math.max(6, s(6)),
                color: muted,
                fontFamily: journalLandingFontFamily,
                fontSize: taglineSize,
                lineHeight: Math.round(taglineSize * 1.28),
              }}>
              Write What Stays.
            </AppText>
          </View>
        </AgentTestId>

        {hasPages ? (
          <JournalLandingPages
            pages={pages}
            today={today}
            onOpen={(dateKey) => router.push(journalPageHref(dateKey))}
          />
        ) : (
          <JournalLandingEmpty onStart={openToday} />
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  transparentScreen: {
    backgroundColor: 'transparent',
  },
  content: {
    paddingTop: 0,
    gap: 0,
    flexGrow: 1,
  },
  header: {
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
