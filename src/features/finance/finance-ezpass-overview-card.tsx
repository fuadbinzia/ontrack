import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  GlassIconWell,
  SectionHeader,
  Symbol,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { radii } from '@/design-system';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

import { FinanceEzPassMonthChart } from './finance-ezpass-month-chart';
import type {
  EzPassDriverFilter,
  EzPassFinanceSummary,
  EzPassFriendFilterOption,
  EzPassMonthlyPoint,
} from './ezpass-model';

export function FinanceEzPassOverviewCard({
  summary,
  currency,
  points,
  selectedMonthKey,
  driverOptions,
  selectedDriver,
  driverHint,
  onSelectMonth,
  onSelectDriver,
}: {
  summary: EzPassFinanceSummary;
  currency: string;
  points: EzPassMonthlyPoint[];
  selectedMonthKey: string;
  driverOptions: EzPassFriendFilterOption[];
  selectedDriver: EzPassDriverFilter;
  driverHint: string;
  onSelectMonth: (key: string) => void;
  onSelectDriver: (value: EzPassDriverFilter) => void;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const selectedDriverLabel =
    driverOptions.find((option) => option.value === selectedDriver)?.label ?? 'All';

  return (
    <Card testID={AgentUiIds.finance.ezpass.summary}>
      <View style={{ gap: spacing.lg }}>
        <View style={[styles.hero, { gap: spacing.md }]}>
          <View style={[styles.heroCopy, { gap: spacing.xs }]}>
            <AppText variant="overline" color="accent" fit>
              Road Spend
            </AppText>
            <AppText variant="display" fit>
              {formatMoney(summary.spendTotal, currency)}
            </AppText>
            <AppText variant="caption" color="secondary" fit titleCase>
              {formatMoney(summary.monthSpend, currency)} This Month ·{' '}
              {summary.activities.length} Shown{' '}
              {summary.activities.length === 1 ? 'Activity' : 'Activities'}
            </AppText>
          </View>
          <GlassIconWell
            variant="airy"
            size={s(54)}
            borderRadius={Math.max(radii.md, s(16))}
          >
            <Symbol name="route" size="lg" color={theme.accentPrimary} />
          </GlassIconWell>
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Driver View" detail={selectedDriverLabel} flush />
          <ChipRow
            options={driverOptions}
            selected={selectedDriver}
            onSelect={onSelectDriver}
            scrollable
            testIDForOption={(value) => AgentUiIds.finance.ezpass.driverFilter(value)}
          />
          <AppText variant="caption" color="tertiary">
            {driverHint}
          </AppText>
        </View>

        <FinanceEzPassMonthChart
          points={points}
          selectedKey={selectedMonthKey}
          currency={currency}
          onSelect={onSelectMonth}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
});
