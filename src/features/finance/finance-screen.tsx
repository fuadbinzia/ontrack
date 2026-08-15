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
  StatusBadge,
  Symbol,
  fieldTitleCase,
} from '@/components/primitives';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useFinance } from '@/store/finance';
import { usePreferences } from '@/store/preferences';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatDateKey } from '@/utils/date';

import { FinanceCreditSheet } from './finance-credit-sheet';
import { FinanceProgressBar } from './finance-progress-bar';
import { monthlyRecurringAmount } from './subscriptions';
import {
  bucketProgress,
  bucketSavedAmount,
  categoryBreakdown,
  generalFinanceTransactions,
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
  const rewardProfiles = useFinance((s) => s.rewardProfiles);
  const entities = useFinance((s) => s.entities);
  const taxYears = useFinance((s) => s.taxYears);
  const creditScore = useFinance((s) => s.creditScore);
  const baseCurrency = useFinance((s) => s.baseCurrency);
  const dateDisplayFormat = usePreferences((s) => s.dateDisplayFormat);
  const { insights, source, disclaimer } = useFinanceCoachInsights();
  const [creditOpen, setCreditOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const ledgerTransactions = useMemo(
    () => generalFinanceTransactions(transactions),
    [transactions],
  );
  const monthTx = useMemo(
    () => transactionsInMonth(ledgerTransactions, now.getFullYear(), now.getMonth()),
    [ledgerTransactions, now],
  );
  const monthTotal = sumAmounts(monthTx);
  const breakdown = categoryBreakdown(monthTx).slice(0, 4);
  const series = monthlySpendSeries(ledgerTransactions, 4, now);
  const activeRecurring = bills.filter((bill) => bill.active);
  const activeSubscriptions = activeRecurring.filter((bill) => bill.kind === 'subscription');
  const activeBillCount = activeRecurring.length - activeSubscriptions.length;
  const upcomingRecurring = upcomingBills(bills, 30, now).slice(0, 4);
  const pendingSubscriptionCount = useFinance((s) => s.subscriptionCandidates.length);
  const assetsTotal = sumAssetBalances(accounts);
  const ezPassActivities = transactions.filter((transaction) => transaction.source === 'ezpass');
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
                {formatDateKey(creditScore.current.asOf, dateDisplayFormat)}
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

        <Card
          testID={AgentUiIds.finance.openRecurring}
          onPress={() => router.push('/(tabs)/finance/bills')}
          accessibilityLabel="Manage Bills And Subscriptions">
          <View style={[styles.rowBetween, { marginBottom: gap.sm }]}>
            <PanelTitle>Bills & Subscriptions</PanelTitle>
            <Symbol name="chevron-right" size={s(18)} color={theme.textTertiary} />
          </View>
          <View style={[styles.rowBetween, { marginBottom: gap.sm }]}>
            <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
              <AppText variant="heading" fit>
                {formatMoney(monthlyRecurringAmount(activeRecurring), baseCurrency)}/month
              </AppText>
              <AppText variant="caption" color="secondary" fit>
                {activeBillCount} {activeBillCount === 1 ? 'bill' : 'bills'} ·{' '}
                {activeSubscriptions.length} {activeSubscriptions.length === 1 ? 'subscription' : 'subscriptions'}
              </AppText>
            </View>
            {pendingSubscriptionCount ? (
              <StatusBadge
                label={`${pendingSubscriptionCount} to review`}
                tone="warning"
                testID={AgentUiIds.finance.section('recurringReview')}
              />
            ) : null}
          </View>
          {upcomingRecurring.length ? (
            <View style={{ gap: gap.sm }}>
              {upcomingRecurring.map((expense) => (
                <View key={expense.id} style={styles.rowBetween}>
                  <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
                    <AppText variant="callout" fit numberOfLines={1}>
                      {expense.name}
                    </AppText>
                    <AppText variant="caption" color="secondary" fit>
                      {expense.kind === 'subscription' ? 'Subscription' : 'Bill'} · {formatDateKey(expense.nextDue, dateDisplayFormat)}
                    </AppText>
                  </View>
                  <AppText variant="callout" fit>
                    {formatMoney(expense.amount, expense.currency)}
                  </AppText>
                </View>
              ))}
            </View>
          ) : activeRecurring.length ? (
            <AppText variant="caption" color="secondary">
              Nothing is due in the next 30 days.
            </AppText>
          ) : (
            <EmptyState
              icon="finance"
              title="No Recurring Expenses"
              message="Add a bill or subscription, or review charges detected from linked financial data."
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
          testID={AgentUiIds.finance.openRewards}
          label="Rewards Optimizer"
          detail={rewardProfiles.length
            ? `${rewardProfiles.length} card ${rewardProfiles.length === 1 ? 'profile' : 'profiles'} · compare return`
            : 'Find the best card for your spending'}
          onPress={() => router.push('/(tabs)/finance/rewards')}
        />

        <FinanceHubLink
          testID={AgentUiIds.finance.openEzPass}
          label="E-ZPass"
          detail={
            ezPassActivities.length
              ? `${ezPassActivities.length} imported ${ezPassActivities.length === 1 ? 'activity' : 'activities'}`
              : 'Upload toll transaction history'
          }
          onPress={() => router.push('/(tabs)/finance/ezpass')}
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
          <AppText variant="caption" color="secondary" fit titleCase>
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
