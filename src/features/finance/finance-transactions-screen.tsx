import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  EmptyState,
  Screen,
} from '@/components/primitives';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import { useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import { financeCategoryById } from './categories';
import { FinanceSubpageHeader } from './finance-subpage-header';

export function FinanceTransactionsScreen() {
  const router = useRouter();
  const { spacing: gap } = useResponsive();
  const transactions = useFinance((s) => s.transactions);
  const sorted = useMemo(
    () =>
      [...transactions].sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
      }),
    [transactions],
  );

  return (
    <Screen>
      <AgentTestId testID={AgentUiIds.finance.transactions.screen} label="Transactions">
        <View style={{ gap: gap.md }}>
          <FinanceSubpageHeader
            title="Transactions"
            trailing={
              <Button
                size="sm"
                onPress={() => router.push('/(tabs)/finance/expense')}
                testID={AgentUiIds.finance.transactions.add}>
                Add
              </Button>
            }
          />
          {sorted.length ? (
            sorted.map((txn) => (
              <Card key={txn.id} testID={AgentUiIds.finance.transactions.row(txn.id)}>
                <View style={{ flexDirection: 'row', gap: gap.sm, alignItems: 'center' }}>
                  <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
                    <AppText variant="callout" fit numberOfLines={1}>
                      {txn.merchant}
                    </AppText>
                    <AppText variant="caption" color="secondary" fit>
                      {txn.date} · {financeCategoryById(txn.categoryId).label} · {txn.source}
                    </AppText>
                  </View>
                  <AppText variant="callout" fit>
                    {formatMoney(txn.amount, txn.currency)}
                  </AppText>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              icon="finance"
              title="No transactions"
              message="Add expenses or link a card to see spend here."
              actionLabel="Add expense"
              onAction={() => router.push('/(tabs)/finance/expense')}
              actionTestID={AgentUiIds.finance.transactions.add}
            />
          )}
        </View>
      </AgentTestId>
    </Screen>
  );
}
