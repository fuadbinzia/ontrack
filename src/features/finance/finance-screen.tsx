import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  EmptyState,
  PanelTitle,
  Screen,
  SectionHeader,
  Symbol,
  fieldTitleCase,
} from '@/components/primitives';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import { FinanceCreditSheet } from './finance-credit-sheet';
import { FinanceProgressBar } from './finance-progress-bar';
import {
  bucketProgress,
  bucketSavedAmount,
  categoryBreakdown,
  monthlySpendSeries,
  sumAmounts,
  sumAssetBalances,
  taxYearReadiness,
  transactionsInMonth,
  upcomingBills,
} from './model';
import {
  FINANCE_CREDIT_BUREAU_LABEL,
  FINANCE_CREDIT_MODEL_LABEL,
} from './types';
import { useFinanceCoachInsights } from './use-finance-coach';

export function FinanceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { spacing: gap, s } = useResponsive();
  const transactions = useFinance((s) => s.transactions);
  const bills = useFinance((s) => s.bills);
  const buckets = useFinance((s) => s.buckets);
  const accounts = useFinance((s) => s.accounts);
  const entities = useFinance((s) => s.entities);
  const taxYears = useFinance((s) => s.taxYears);
  const creditScore = useFinance((s) => s.creditScore);
  const baseCurrency = useFinance((s) => s.baseCurrency);
  const markBillPaid = useFinance((s) => s.markBillPaid);
  const { insights, source, disclaimer } = useFinanceCoachInsights();
  const [creditOpen, setCreditOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const monthTx = useMemo(
    () => transactionsInMonth(transactions, now.getFullYear(), now.getMonth()),
    [transactions, now],
  );
  const monthTotal = sumAmounts(monthTx);
  const breakdown = categoryBreakdown(monthTx).slice(0, 4);
  const series = monthlySpendSeries(transactions, 4, now);
  const dueBills = upcomingBills(bills, 30, now).slice(0, 4);
  const assetsTotal = sumAssetBalances(accounts);
  const currentTax = useMemo(() => {
    const year = now.getFullYear();
    return taxYears.find((t) => t.year === year) ?? taxYears[0];
  }, [taxYears, now]);

  return (
    <Screen contentStyle={styles.content}>
      <AgentTestId testID={AgentUiIds.finance.screen} label="Finance">
      <View style={{ gap: gap.lg }}>
        <View style={[styles.rowBetween, { gap: gap.sm }]}>
          <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
            <AppText variant="title" fit>
              Finance
            </AppText>
            <AppText variant="caption" color="secondary">
              Spending, bills, buckets, and tax prep — file elsewhere when ready.
            </AppText>
          </View>
          <Button
            size="sm"
            onPress={() => router.push('/(tabs)/finance/expense')}
            testID={AgentUiIds.finance.addExpense}
          >
            Add
          </Button>
        </View>

        <Card testID={AgentUiIds.finance.section('month')}>
          <SectionHeader title="This month" flush />
          <AppText variant="heading" fit>
            {formatMoney(monthTotal, baseCurrency)}
          </AppText>
          <View style={[styles.trendRow, { gap: gap.sm, marginTop: gap.sm }]}>
            {series.map((point) => {
              const max = Math.max(...series.map((p) => p.amount), 1);
              const height = Math.max(s(8), Math.round((point.amount / max) * s(36)));
              return (
                <View key={point.key} style={{ alignItems: 'center', gap: gap.xs, flex: 1 }}>
                  <View
                    style={{
                      width: '70%',
                      height,
                      borderRadius: s(6),
                      backgroundColor: theme.accentPrimary,
                      opacity: 0.75,
                    }}
                  />
                  <AppText variant="caption" color="secondary" fit>
                    {point.label}
                  </AppText>
                </View>
              );
            })}
          </View>
          {breakdown.length ? (
            <View style={{ marginTop: gap.md, gap: gap.xs }}>
              {breakdown.map((row) => (
                <View key={row.categoryId} style={styles.rowBetween}>
                  <AppText variant="callout" color="secondary" fit style={{ flex: 1, minWidth: 0 }}>
                    {fieldTitleCase(row.label)}
                  </AppText>
                  <AppText variant="callout" fit>
                    {formatMoney(row.amount, baseCurrency)}
                  </AppText>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="finance"
              title="No spend logged"
              message="Add an expense to see trends."
            />
          )}
          <Button
            variant="secondary"
            onPress={() => router.push('/(tabs)/finance/transactions')}
            testID={AgentUiIds.finance.openTransactions}
            style={{ marginTop: gap.md }}
          >
            All transactions
          </Button>
        </Card>

        <Card
          testID={AgentUiIds.finance.section('assets')}
          onPress={() => router.push('/(tabs)/finance/accounts')}
          accessibilityLabel="Assets">
          <SectionHeader title="Assets" flush />
          <AppText variant="heading" fit>
            {formatMoney(assetsTotal, baseCurrency)}
          </AppText>
          <AppText variant="caption" color="secondary">
            Bank, cash, and investment balances you’ve added.
          </AppText>
        </Card>

        <Card testID={AgentUiIds.finance.credit.card}>
          <SectionHeader
            title="Credit score"
            actionLabel="Edit"
            onAction={() => setCreditOpen(true)}
            actionTestID={AgentUiIds.finance.credit.edit}
            flush
          />
          {creditScore?.current ? (
            <View style={{ gap: gap.xs }}>
              <AppText variant="heading" fit>
                {creditScore.current.score}
              </AppText>
              <AppText variant="caption" color="secondary">
                {FINANCE_CREDIT_BUREAU_LABEL[creditScore.current.bureau]} ·{' '}
                {FINANCE_CREDIT_MODEL_LABEL[creditScore.current.model]} · as of{' '}
                {creditScore.current.asOf}
              </AppText>
            </View>
          ) : (
            <EmptyState
              icon="finance"
              title="No score yet"
              message="Enter the score from Credit Karma, Chase, or another free checker."
            />
          )}
        </Card>

        <Card testID={AgentUiIds.finance.section('coach')}>
          <SectionHeader title="Money coach" flush />
          <AppText variant="caption" color="secondary">
            {disclaimer}
            {source === 'ai' ? ' · AI-polished' : ''}
          </AppText>
          <View style={{ gap: gap.sm, marginTop: gap.sm }}>
            {insights.map((insight) => (
              <View
                key={insight.id}
                testID={AgentUiIds.finance.coachCard(insight.id)}
                style={{ gap: gap.xs }}>
                <PanelTitle>{insight.title}</PanelTitle>
                <AppText variant="caption" color="secondary">
                  {insight.body}
                </AppText>
              </View>
            ))}
          </View>
        </Card>

        <Card testID={AgentUiIds.finance.section('bills')}>
          <SectionHeader
            title="Bills due"
            actionLabel="Manage"
            onAction={() => router.push('/(tabs)/finance/bills')}
            actionTestID={AgentUiIds.finance.openBills}
            flush
          />
          {dueBills.length ? (
            <View style={{ gap: gap.sm }}>
              {dueBills.map((bill) => (
                <View key={bill.id} style={styles.rowBetween}>
                  <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
                    <AppText variant="callout" fit numberOfLines={1}>
                      {bill.name}
                    </AppText>
                    <AppText variant="caption" color="secondary" fit>
                      {bill.nextDue} · {bill.kind}
                    </AppText>
                  </View>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => markBillPaid(bill.id)}
                    testID={AgentUiIds.finance.markBillPaid(bill.id)}
                  >
                        Paid
                      </Button>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="finance"
              title="No bills due soon"
              message="Track subscriptions, property tax, insurance, and car payments."
            />
          )}
        </Card>

        <Card testID={AgentUiIds.finance.section('buckets')}>
          <SectionHeader
            title="Buckets"
            actionLabel="Open"
            onAction={() => router.push('/(tabs)/finance/buckets')}
            actionTestID={AgentUiIds.finance.openBuckets}
            flush
          />
          {buckets.length ? (
            <View style={{ gap: gap.md }}>
              {buckets.slice(0, 3).map((bucket) => {
                const progress = bucketProgress(bucket);
                return (
                  <View key={bucket.id} style={{ gap: gap.xs }}>
                    <View style={styles.rowBetween}>
                      <AppText variant="callout" fit style={{ flex: 1, minWidth: 0 }}>
                        {bucket.name}
                      </AppText>
                      <AppText variant="caption" color="secondary" fit>
                        {formatMoney(bucketSavedAmount(bucket), bucket.currency)} /{' '}
                        {formatMoney(bucket.goalAmount, bucket.currency)}
                      </AppText>
                    </View>
                    <FinanceProgressBar progress={progress} />
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon="finance"
              title="No buckets yet"
              message="Save toward travel or other large purchases."
            />
          )}
        </Card>

        <FinanceHubLink
          testID={AgentUiIds.finance.openEntities}
          label="Entities"
          detail={`${entities.length} · personal, businesses, properties`}
          onPress={() => router.push('/(tabs)/finance/entities')}
        />

        <FinanceHubLink
          testID={AgentUiIds.finance.openAccounts}
          label="Cards & accounts"
          detail={
            accounts.length
              ? `${accounts.length} linked or manual`
              : 'Add manually or link with Plaid'
          }
          onPress={() => router.push('/(tabs)/finance/accounts')}
        />

        <FinanceHubLink
          testID={AgentUiIds.finance.openTax}
          label="Tax prep"
          detail={
            currentTax
              ? `${currentTax.year} · ${Math.round(taxYearReadiness(currentTax) * 100)}% ready`
              : 'Organize docs and export when ready'
          }
          onPress={() => router.push('/(tabs)/finance/tax')}
        />
      </View>
      </AgentTestId>
      <FinanceCreditSheet visible={creditOpen} onClose={() => setCreditOpen(false)} />
    </Screen>
  );
}

function FinanceHubLink({
  testID,
  label,
  detail,
  onPress,
}: {
  testID: string;
  label: string;
  detail: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { spacing: gap, s } = useResponsive();
  return (
    <Card onPress={onPress} testID={testID} accessibilityLabel={label}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
          <PanelTitle>{label}</PanelTitle>
          <AppText variant="caption" color="secondary" fit>
            {detail}
          </AppText>
        </View>
        <Symbol name="chevron-right" size={s(18)} color={theme.textTertiary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 0,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
