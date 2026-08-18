import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  fieldTitleCase,
  GlassIconWell,
  IconButton,
  Screen,
  SectionHeader,
  StatusBadge,
  Symbol,
} from '@/components/primitives';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useFinance } from '@/store/finance';
import { usePreferences } from '@/store/preferences';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatDateKey } from '@/utils/date';

import { createFinanceBill, personalEntityId } from './create';
import { FinanceSubpageHeader } from './finance-subpage-header';
import { FinanceRecurringClassificationSheet } from './finance-recurring-classification-sheet';
import {
  FinanceRecurringExpenseFormSheet,
  type ManualFinanceRecurringExpense,
} from './finance-subscription-form-sheet';
import { refreshFinanceSubscriptions } from './refresh-finance-subscriptions';
import { openRecurringExpenseDeleteConfirmation } from './recurring-expense-delete';
import {
  editRecurringExpense,
  monthlyRecurringAmount,
} from './subscriptions';
import {
  type FinanceBillKind,
  type FinanceRecurringBill,
  type FinanceSubscriptionCandidate,
} from './types';

export function FinanceBillsAndSubscriptionsScreen() {
  const router = useRouter();
  const { spacing: gap, s } = useResponsive();
  const accounts = useFinance((state) => state.accounts);
  const entities = useFinance((state) => state.entities);
  const baseCurrency = useFinance((state) => state.baseCurrency);
  const bills = useFinance((state) => state.bills);
  const candidates = useFinance((state) => state.subscriptionCandidates);
  const detectionStatus = useFinance(
    (state) => state.subscriptionDetectionStatus,
  );
  const saveBill = useFinance((state) => state.saveBill);
  const confirmCandidate = useFinance(
    (state) => state.confirmSubscriptionCandidate,
  );
  const dismissCandidate = useFinance(
    (state) => state.dismissSubscriptionCandidate,
  );
  const removeSubscription = useFinance((state) => state.removeSubscription);
  const removeBill = useFinance((state) => state.removeBill);
  const [showForm, setShowForm] = useState(false);
  const [expenseToCategorize, setExpenseToCategorize] =
    useState<FinanceRecurringBill>();
  const [candidateToConfirm, setCandidateToConfirm] =
    useState<FinanceSubscriptionCandidate>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<{
    message: string;
    error: boolean;
  }>();

  const linkedAccounts = accounts.filter((account) => account.provider);
  const recurringExpenses = [...bills].sort((a, b) =>
    a.nextDue.localeCompare(b.nextDue),
  );
  const pending = candidates.filter((candidate) => candidate.active);
  const activeCount = recurringExpenses.filter(
    (expense) => expense.active,
  ).length;
  const personalId = personalEntityId(entities);

  const saveManual = (expense: ManualFinanceRecurringExpense) => {
    saveBill(
      createFinanceBill({
        ...expense,
        currency: baseCurrency,
      }),
    );
    return undefined;
  };

  const refresh = async () => {
    if (refreshing) return;
    if (!linkedAccounts.length) {
      router.push('/(tabs)/finance/accounts');
      return;
    }
    if (!personalId) {
      setRefreshFeedback({
        message: 'Add a personal Finance profile first, then we can refresh subscriptions.',
        error: true,
      });
      return;
    }
    setRefreshing(true);
    setRefreshFeedback(undefined);
    try {
      const result = await refreshFinanceSubscriptions(
        personalId,
        baseCurrency,
      );
      const noun = result.connectionCount === 1 ? 'connection' : 'connections';
      if (result.errors.length) {
        setRefreshFeedback({
          message: result.syncedCount
            ? `Updated ${result.syncedCount} of ${result.connectionCount} ${noun}. ${result.errors[0]}`
            : result.errors[0],
          error: true,
        });
      } else {
        const transactionNoun =
          result.transactionCount === 1 ? 'transaction' : 'transactions';
        const suggestionNoun =
          result.candidateCount === 1 ? 'suggestion' : 'suggestions';
        setRefreshFeedback({
          message: `Checked ${result.connectionCount} ${noun} and ${result.transactionCount} ${transactionNoun}. Found ${result.candidateCount} ${suggestionNoun}.`,
          error: false,
        });
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen refresh={false}>
      <AgentTestId
        testID={AgentUiIds.finance.recurring.screen}
        label="Bills And Subscriptions"
      >
        <View style={{ gap: gap.md }}>
          <FinanceSubpageHeader
            title="Bills & Subscriptions"
            subtitle={`${activeCount} Active · ${formatMoney(monthlyRecurringAmount(recurringExpenses), baseCurrency)} / Month`}
            trailing={
              <IconButton
                icon="add"
                accessibilityLabel="Add Bill Or Subscription"
                onPress={() => setShowForm(true)}
                testID={AgentUiIds.finance.recurring.add}
              />
            }
          />

          <View style={[styles.sectionHeading, { gap: gap.sm }]}>
            <View style={styles.sectionHeadingCopy}>
              <SectionHeader
                title="Review"
                detail={
                  pending.length
                    ? `${pending.length} Pending`
                    : 'Recurring Detection'
                }
                flush
              />
            </View>
            <IconButton
              icon="sync"
              accessibilityLabel={
                refreshing
                  ? 'Refreshing Recurring Expenses'
                  : 'Refresh Recurring Expenses'
              }
              onPress={() => void refresh()}
              loading={refreshing}
              testID={AgentUiIds.finance.subscriptions.refresh}
            />
          </View>
          {pending.length && !refreshFeedback ? (
            <AppText variant="caption" color="secondary" fit>
              {pending.length} to review
            </AppText>
          ) : null}
          {refreshFeedback ? (
            <View style={[styles.refreshFeedback, { gap: gap.sm }]}>
              <View style={styles.refreshFeedbackMessage}>
                {refreshFeedback.error ? (
                  <ErrorMessage
                    message={refreshFeedback.message}
                    testID={AgentUiIds.finance.subscriptions.refreshStatus}
                  />
                ) : (
                  <AppText
                    variant="caption"
                    color="secondary"
                    testID={AgentUiIds.finance.subscriptions.refreshStatus}
                  >
                    {refreshFeedback.message}
                  </AppText>
                )}
              </View>
              <IconButton
                icon="close"
                size={Math.max(44, s(40))}
                accessibilityLabel="Dismiss Refresh Result"
                onPress={() => setRefreshFeedback(undefined)}
                testID={AgentUiIds.finance.subscriptions.dismissRefreshStatus}
              />
            </View>
          ) : null}
          {pending.length ? (
            pending.map((candidate) => (
              <DetectedRecurringExpense
                key={candidate.id}
                candidate={candidate}
                accountName={
                  accounts.find((account) => account.id === candidate.accountId)
                    ?.name
                }
                onConfirm={() => setCandidateToConfirm(candidate)}
                onDismiss={() => dismissCandidate(candidate.id)}
              />
            ))
          ) : (
            <DetectionStatusCard
              linkedAccountCount={linkedAccounts.length}
              status={detectionStatus}
            />
          )}

          <SectionHeader
            title="Upcoming"
            detail={`${recurringExpenses.length} ${recurringExpenses.length === 1 ? 'Expense' : 'Expenses'}`}
            flush
          />
          {recurringExpenses.length ? (
            recurringExpenses.map((expense) => (
              <TrackedRecurringExpense
                key={expense.id}
                expense={expense}
                contextName={
                  expense.accountId
                    ? accounts.find(
                        (account) => account.id === expense.accountId,
                      )?.name
                    : entities.find((entity) => entity.id === expense.entityId)
                        ?.name
                }
                onCategorize={() => setExpenseToCategorize(expense)}
              />
            ))
          ) : (
            <EmptyState
              icon="finance"
              title="No Recurring Expenses"
              message="Add a bill or subscription, or confirm a detected charge."
            />
          )}
        </View>
      </AgentTestId>
      <FinanceRecurringExpenseFormSheet
        visible={showForm}
        entities={entities}
        defaultEntityId={personalId}
        onClose={() => setShowForm(false)}
        onSave={saveManual}
      />
      <FinanceRecurringClassificationSheet
        expense={
          candidateToConfirm
            ? { ...candidateToConfirm, kind: candidateToConfirm.suggestedKind }
            : expenseToCategorize
        }
        onClose={() => {
          setCandidateToConfirm(undefined);
          setExpenseToCategorize(undefined);
        }}
        onSave={(changes) => {
          if (candidateToConfirm) {
            confirmCandidate(candidateToConfirm.id, changes.kind);
            return;
          }
          if (!expenseToCategorize) return;
          saveBill(editRecurringExpense(expenseToCategorize, changes));
        }}
        onRemove={expenseToCategorize
          ? () => openRecurringExpenseDeleteConfirmation(expenseToCategorize, {
              closeEditor: () => setExpenseToCategorize(undefined),
              removeSubscription,
              removeBill,
            })
          : undefined}
        removeTestID={expenseToCategorize
          ? expenseToCategorize.kind === 'subscription'
            ? AgentUiIds.finance.subscriptions.remove(expenseToCategorize.id)
            : AgentUiIds.finance.bills.remove(expenseToCategorize.id)
          : undefined}
      />
    </Screen>
  );
}

function DetectedRecurringExpense({
  candidate,
  accountName,
  onConfirm,
  onDismiss,
}: {
  candidate: FinanceSubscriptionCandidate;
  accountName?: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const { spacing: gap } = useResponsive();
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  return (
    <Card
      style={{ padding: gap.md }}
      testID={AgentUiIds.finance.subscriptions.candidate(candidate.id)}
    >
      <View style={{ gap: gap.sm }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: gap.sm }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
            <AppText variant="callout" fit numberOfLines={1}>
              {candidate.name}
            </AppText>
            <AppText variant="caption" color="secondary" fit>
              {formatMoney(candidate.amount, candidate.currency)} ·{' '}
              {fieldTitleCase(candidate.cadence)} · Next{' '}
              {formatDateKey(candidate.nextDue, dateDisplayFormat)}
            </AppText>
            {accountName ? (
              <AppText variant="caption" color="secondary" fit>
                {accountName}
              </AppText>
            ) : null}
          </View>
          <StatusBadge label={recurringKindLabel(candidate.suggestedKind)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gap.sm }}>
          <Button
            size="sm"
            onPress={onConfirm}
            testID={AgentUiIds.finance.subscriptions.confirm(candidate.id)}
          >
            {`Add As ${recurringKindLabel(candidate.suggestedKind)}`}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={onDismiss}
            testID={AgentUiIds.finance.subscriptions.dismiss(candidate.id)}
          >
            Dismiss
          </Button>
        </View>
      </View>
    </Card>
  );
}

function TrackedRecurringExpense({
  expense,
  contextName,
  onCategorize,
}: {
  expense: FinanceRecurringBill;
  contextName?: string;
  onCategorize: () => void;
}) {
  const { spacing: gap, s } = useResponsive();
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const isSubscription = expense.kind === 'subscription';
  return (
    <Card
      style={{ padding: gap.md }}
      testID={
        isSubscription
          ? AgentUiIds.finance.subscriptions.row(expense.id)
          : AgentUiIds.finance.bills.row(expense.id)
      }
    >
      <View style={{ gap: gap.sm }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: gap.sm }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
            <AppText variant="callout" fit numberOfLines={1}>
              {expense.name}
            </AppText>
            <AppText variant="caption" color="secondary" fit numberOfLines={1}>
              {contextName ? `${contextName} · ` : ''}
              {recurringKindLabel(expense.kind)}
            </AppText>
          </View>
          <IconButton
            icon="edit"
            size={s(40)}
            accessibilityLabel={`Edit ${recurringKindLabel(expense.kind)}`}
            onPress={onCategorize}
            testID={AgentUiIds.finance.recurring.categorize(expense.id)}
          />
        </View>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', gap: gap.md }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
            <AppText variant="heading" fit numberOfLines={1}>
              {formatMoney(expense.amount, expense.currency)}
            </AppText>
            <AppText variant="caption" color="secondary" fit titleCase>
              {expense.cadence}
              {expense.aprPercent != null
                ? ` · ${expense.aprPercent}% APR`
                : ''}
            </AppText>
          </View>
          <View style={{ alignItems: 'flex-end', gap: gap.xs }}>
            <AppText variant="overline" color="secondary" fit>
              {isSubscription ? 'Next Charge' : 'Next Due'}
            </AppText>
            <AppText variant="callout" fit>
              {formatDateKey(expense.nextDue, dateDisplayFormat)}
            </AppText>
          </View>
        </View>
      </View>
    </Card>
  );
}

function recurringKindLabel(kind: FinanceBillKind): string {
  const labels: Record<FinanceBillKind, string> = {
    bill: 'Bill',
    subscription: 'Subscription',
    loan: 'Loan',
    insurance: 'Insurance',
    tax: 'Tax',
    other: 'Bill',
  };
  return labels[kind];
}

function DetectionStatusCard({
  linkedAccountCount,
  status,
}: {
  linkedAccountCount: number;
  status: 'idle' | 'pending' | 'ready' | 'fallback' | 'error';
}) {
  const { spacing, s } = useResponsive();
  const theme = useTheme();
  if (linkedAccountCount && status !== 'pending' && status !== 'error') {
    return null;
  }

  const copy = !linkedAccountCount
    ? {
        title: 'Link Financial Data',
        message: 'Connect a bank or card to find recurring expenses.',
        icon: 'finance' as const,
      }
    : status === 'pending'
      ? {
          title: 'Detection Is Preparing',
          message: 'Plaid is preparing more transaction history.',
          icon: 'sync' as const,
        }
      : {
          title: 'Refresh Needed',
          message: 'Recurring detection could not finish. Try again.',
          icon: 'warning' as const,
        };
  return (
    <Card variant="sunken" style={{ padding: spacing.md }}>
      <View style={[styles.detectionStatus, { gap: spacing.md }]}>
        <GlassIconWell size={s(42)} borderRadius={s(13)}>
          <Symbol name={copy.icon} size="md" color={theme.accentPrimary} />
        </GlassIconWell>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
          <AppText variant="callout" fit numberOfLines={1}>
            {copy.title}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={2}>
            {copy.message}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  detectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshFeedbackMessage: {
    flex: 1,
    minWidth: 0,
  },
});

/** Compatibility export for the existing subscriptions route. */
export const FinanceSubscriptionsScreen = FinanceBillsAndSubscriptionsScreen;
