import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import { journalLandingFontFamily } from './journal-landing-atmosphere';

export function JournalPageEmpty({ isToday }: { isToday: boolean }) {
  const theme = useTheme();
  const { s, spacing } = useResponsive();
  const titleSize = Math.max(26, s(28));

  return (
    <AgentTestId testID={AgentUiIds.journal.empty} style={styles.fill}>
      <View
        style={[
          styles.body,
          {
            paddingTop: spacing.xl,
            paddingBottom: spacing.xxl,
          },
        ]}>
        <AppText
          align="center"
          style={{
            fontFamily: journalLandingFontFamily,
            fontSize: titleSize,
            lineHeight: Math.round(titleSize * 1.28),
            fontWeight: '400',
            color: theme.textPrimary,
          }}>
          {isToday ? 'Today is waiting.' : 'This page is waiting.'}
        </AppText>
      </View>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  fill: {
    flexGrow: 1,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
