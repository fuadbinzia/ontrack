import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassIconWell, Symbol } from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export type OverviewRow = {
  routeName: string;
  label: string;
  icon: AppIconName;
  headline: string;
  detail: string;
  href: Href;
};

export function OverviewSummaryRow({
  row,
  isLast,
}: {
  row: OverviewRow;
  isLast: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const { spacing, s, layout } = useResponsive();
  const open = () => router.navigate(row.href);

  return (
    <AgentTestId
      testID={AgentUiIds.overview.row(row.routeName)}
      label={`Open ${row.label}`}
      onPress={open}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.label}. ${row.headline}. ${row.detail}`}
        onPress={open}
        style={({ pressed }) => [
          styles.row,
          {
            minHeight: layout.minTapTarget + spacing.md,
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.68 : 1,
            borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: theme.separator,
          },
        ]}>
        <GlassIconWell size={s(42)} borderRadius={radii.md}>
          <Symbol name={row.icon} size={s(19)} color={theme.accentPrimary} />
        </GlassIconWell>
        <View style={[styles.copy, { gap: spacing.xxs }]}>
          <AppText variant="overline" color="accent" fit style={styles.label}>
            {row.label}
          </AppText>
          <AppText variant="subheading" fit style={styles.headline}>
            {row.headline}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={2}>
            {row.detail}
          </AppText>
        </View>
        <View style={[styles.chevron, { minWidth: s(24) }]}>
          <Symbol
            name="chevron-right"
            size={s(13)}
            color={theme.textTertiary}
          />
        </View>
      </Pressable>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  chevron: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  headline: {
    minWidth: 0,
  },
});
