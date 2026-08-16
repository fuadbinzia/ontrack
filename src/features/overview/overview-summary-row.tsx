import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { TAB_META } from '@/components/navigation/bottom-nav-tab-meta';
import {
  peekCurrentTabName,
  startTabOpen,
} from '@/components/navigation/overview-return';
import { AppText, GlassIconWell, GlassPlate, Symbol } from '@/components/primitives';
import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export type OverviewRow = {
  routeName: string;
  label: string;
  headline: string;
  detail: string;
  href: Href;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'secondary';
  beforeNavigate?: () => void;
};

export function OverviewSummaryRow({ row }: { row: OverviewRow }) {
  const router = useRouter();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const { spacing, s, layout } = useResponsive();
  const toneColor = {
    accent: theme.accentPrimary,
    success: theme.success,
    warning: theme.warning,
    danger: theme.danger,
    secondary: theme.textSecondary,
  }[row.tone ?? 'accent'];
  const icon = TAB_META[row.routeName]?.icon;
  const open = () => {
    row.beforeNavigate?.();
    startTabOpen({
      from: peekCurrentTabName(),
      to: row.routeName,
      side: 'right',
      width,
      reduceMotion,
    });
    router.navigate(row.href);
  };

  return (
    <AgentTestId
      testID={AgentUiIds.overview.row(row.routeName)}
      label={`Open ${row.label}`}
      onPress={open}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.label}. ${row.headline}. ${row.detail}`}
        onPress={open}
        style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}
      >
        <GlassPlate
          airy
          style={[
            styles.card,
            {
              minHeight: layout.minTapTarget + spacing.md,
              gap: spacing.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
            },
          ]}
        >
          {icon ? (
            <GlassIconWell size={s(28)} borderRadius={radii.sm}>
              <Symbol name={icon} size={s(13)} color={toneColor} />
            </GlassIconWell>
          ) : null}
          <View style={[styles.copy, { gap: spacing.xxs }]}>
            <AppText
              variant="overline"
              fit
              style={[styles.label, { color: toneColor }]}
            >
              {row.label}
            </AppText>
            <AppText variant="subheading" fit style={styles.headline}>
              {row.headline}
            </AppText>
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {row.detail}
            </AppText>
          </View>
        </GlassPlate>
      </Pressable>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  headline: {
    minWidth: 0,
  },
});
