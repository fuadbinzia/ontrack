import { Pressable, StyleSheet, View } from "react-native";

import { AppText, SectionHeader } from "@/components/primitives";
import { formatMoney } from "@/features/travel/expenses/format-money";
import { useResponsive } from "@/hooks/use-responsive";
import { useTheme } from "@/hooks/use-theme";
import { AgentTestId, AgentUiIds, useAgentUiTarget } from "@/utils/agent-ui";
import { haptics } from "@/utils/haptics";

import type { EzPassMonthlyPoint } from "./ezpass-model";

function EzPassMonthBar({
  point,
  maxAmount,
  selected,
  currency,
  onSelect,
}: {
  point: EzPassMonthlyPoint;
  maxAmount: number;
  selected: boolean;
  currency: string;
  onSelect: (key: string) => void;
}) {
  const theme = useTheme();
  const { spacing, layout, s } = useResponsive();
  const handlePress = () => {
    haptics.select();
    onSelect(point.key);
  };
  const agent = useAgentUiTarget(AgentUiIds.finance.ezpass.month(point.key), {
    label: `${point.fullLabel}, ${formatMoney(point.netTotal, currency)} net road spend`,
    onPress: handlePress,
  });
  const barHeight = Math.max(
    s(6),
    Math.round((Math.abs(point.netTotal) / maxAmount) * s(72)),
  );

  return (
    <Pressable
      ref={agent.ref}
      onLayout={agent.onLayout}
      testID={agent.testID}
      accessibilityRole="button"
      accessibilityLabel={`${point.fullLabel}, ${formatMoney(point.netTotal, currency)} net road spend`}
      accessibilityState={{ selected }}
      onPress={handlePress}
      style={[
        styles.month,
        { minHeight: layout.minTapTarget, gap: spacing.xs },
      ]}
    >
      <AppText
        variant="caption"
        color={selected ? "accent" : "tertiary"}
        fit
        numberOfLines={1}
        style={styles.barValue}
      >
        {formatMoney(point.netTotal, currency)}
      </AppText>
      <View
        style={{
          width: "62%",
          height: barHeight,
          minHeight: s(6),
          borderRadius: s(6),
          backgroundColor:
            point.netTotal < 0 ? theme.success : theme.accentPrimary,
          opacity: selected ? 1 : point.activityCount ? 0.5 : 0.2,
        }}
      />
      <AppText variant="caption" color={selected ? "accent" : "secondary"} fit>
        {point.label}
      </AppText>
    </Pressable>
  );
}

function EzPassTotalMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalMetric}>
      <AppText variant="overline" color="secondary" fit>
        {label}
      </AppText>
      <AppText variant="heading" fit>
        {value}
      </AppText>
    </View>
  );
}

export function FinanceEzPassMonthChart({
  points,
  selectedKey,
  currency,
  onSelect,
}: {
  points: EzPassMonthlyPoint[];
  selectedKey: string;
  currency: string;
  onSelect: (key: string) => void;
}) {
  const { spacing } = useResponsive();
  const selected =
    points.find((point) => point.key === selectedKey) ?? points.at(-1);
  const maxAmount = Math.max(
    ...points.map((point) => Math.abs(point.netTotal)),
    1,
  );
  if (!selected) return null;

  return (
    <AgentTestId
      testID={AgentUiIds.finance.ezpass.monthChart}
      label="E-ZPass monthly road spend"
    >
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Six-Month Trend"
          detail={selected.fullLabel}
          flush
        />
        <View style={[styles.chart, { gap: spacing.xs }]}>
          {points.map((point) => (
            <EzPassMonthBar
              key={point.key}
              point={point}
              maxAmount={maxAmount}
              selected={point.key === selected.key}
              currency={currency}
              onSelect={onSelect}
            />
          ))}
        </View>
        <AgentTestId
          testID={AgentUiIds.finance.ezpass.monthDetail}
          label={`${selected.fullLabel} E-ZPass totals`}
        >
          <View style={[styles.totalsGrid, { gap: spacing.md }]}>
            <View style={[styles.totalsRow, { gap: spacing.lg }]}>
              <EzPassTotalMetric
                label="Tolls"
                value={formatMoney(selected.tollTotal, currency)}
              />
              <EzPassTotalMetric
                label="Refunds"
                value={formatMoney(selected.refundTotal, currency)}
              />
            </View>
            <View style={[styles.totalsRow, { gap: spacing.lg }]}>
              <EzPassTotalMetric
                label="Net"
                value={formatMoney(selected.netTotal, currency)}
              />
              <EzPassTotalMetric
                label="Replenished"
                value={formatMoney(selected.replenishmentTotal, currency)}
              />
            </View>
          </View>
        </AgentTestId>
      </View>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  chart: {
    minHeight: 138,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  month: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  barValue: {
    textAlign: "center",
    width: "100%",
  },
  totalsGrid: {
    width: "100%",
  },
  totalsRow: {
    flexDirection: "row",
  },
  totalMetric: {
    flex: 1,
    minWidth: 0,
  },
});
