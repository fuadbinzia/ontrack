import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  Dropdown,
  EmptyState,
  IconButton,
  Input,
  Screen,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useFinance } from '@/store/finance';
import { usePreferences } from '@/store/preferences';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import { financeCategoryById } from './categories';
import { searchFinanceTransactions } from './finance-transaction-search';
import {
  filterAndSortFinanceTransactions,
  FINANCE_TRANSACTION_SORT_OPTIONS,
  financeTransactionDateLabel,
  financeTransactionCountLabel,
  groupFinanceTransactionsByDate,
  type FinanceTransactionSort,
} from './finance-transaction-list';
import { FinanceSubpageHeader } from './finance-subpage-header';
import { FinanceTransactionCategorySheet } from './finance-transaction-category-sheet';
import { generalFinanceTransactions } from './model';
import type { FinanceTransaction } from './types';

export function FinanceTransactionsScreen() {
  const router = useRouter();
  const { spacing: gap } = useResponsive();
  const theme = useTheme();
  const transactions = useFinance((s) => s.transactions);
  const categorizeMerchantTransactions = useFinance(
    (s) => s.categorizeMerchantTransactions,
  );
  const dateDisplayFormat = usePreferences((s) => s.dateDisplayFormat);
  const [query, setQuery] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<FinanceTransactionSort>('newest');
  const [selectedTransaction, setSelectedTransaction] = useState<FinanceTransaction>();
  const ledgerTransactions = useMemo(
    () => generalFinanceTransactions(transactions),
    [transactions],
  );
  const availableCategoryIds = useMemo(
    () => [...new Set(ledgerTransactions.map((transaction) => transaction.categoryId))],
    [ledgerTransactions],
  );
  const categoryFilterOptions = useMemo(
    () => availableCategoryIds
      .map((categoryId) => ({
        value: categoryId,
        label: financeCategoryById(categoryId).label,
        testID: AgentUiIds.finance.transactions.categoryFilterOption(categoryId),
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    [availableCategoryIds],
  );
  const sorted = useMemo(
    () => filterAndSortFinanceTransactions(
      searchFinanceTransactions(
        ledgerTransactions,
        query,
        dateDisplayFormat,
      ),
      selectedCategoryIds,
      sortBy,
    ),
    [dateDisplayFormat, ledgerTransactions, query, selectedCategoryIds, sortBy],
  );
  const dateGroups = useMemo(
    () => groupFinanceTransactionsByDate(sorted, sortBy),
    [sortBy, sorted],
  );
  const hasQuery = query.trim().length > 0;
  const hasCategoryFilter = selectedCategoryIds.length > 0;

  return (
    <Screen>
      <AgentTestId testID={AgentUiIds.finance.transactions.screen} label="Transactions">
        <View style={{ gap: gap.md }}>
          <FinanceSubpageHeader
            title="Transactions"
            subtitle="Your card activity, organized."
            trailing={
              <IconButton
                icon="add"
                accessibilityLabel="Add Expense"
                onPress={() => router.push('/(tabs)/finance/expense')}
                testID={AgentUiIds.finance.transactions.add}
              />
            }
          />
          <Input
            icon="search"
            placeholder="Search Transactions"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search Transactions"
            fieldBorderRadius={radii.xl}
            testID={AgentUiIds.finance.transactions.search}
          />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: gap.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Dropdown
                multiple
                label="Categories"
                icon="filter"
                iconColor={theme.accentPrimary}
                labelColor={theme.textTertiary}
                value={selectedCategoryIds}
                options={categoryFilterOptions}
                onChange={setSelectedCategoryIds}
                placeholder="All Categories"
                searchable
                searchPlaceholder="Search Categories"
                testID={AgentUiIds.finance.transactions.categoryFilter}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Dropdown
                label="Sort By"
                icon="sort"
                iconColor={theme.accentPrimary}
                labelColor={theme.textTertiary}
                value={sortBy}
                options={FINANCE_TRANSACTION_SORT_OPTIONS.map((option) => ({
                  ...option,
                  testID: AgentUiIds.finance.transactions.sortOption(option.value),
                }))}
                onChange={setSortBy}
                testID={AgentUiIds.finance.transactions.sort}
              />
            </View>
          </View>
          <AgentTestId
            testID={AgentUiIds.finance.transactions.activitySection}
            label="Transaction Activity">
            <View style={styles.ledgerHeading}>
              <AppText variant="overline" color="tertiary" fit>
                Activity
              </AppText>
              <AppText variant="caption" color="tertiary" fit>
                {financeTransactionCountLabel(sorted.length, ledgerTransactions.length)}
              </AppText>
            </View>
          </AgentTestId>
          {sorted.length ? (
            <View style={{ gap: gap.sm }}>
              {dateGroups.map((group) => (
                <View key={group.date} style={{ gap: gap.sm }}>
                  <AgentTestId
                    testID={AgentUiIds.finance.transactions.dateGroup(group.date)}
                    label={`Transactions for ${group.date}`}>
                    <View style={styles.dateHeading}>
                      <AppText variant="callout" fit numberOfLines={1}>
                        {financeTransactionDateLabel(group.date, dateDisplayFormat)}
                      </AppText>
                      <AppText variant="caption" color="tertiary" fit numberOfLines={1}>
                        {financeTransactionCountLabel(
                          group.transactions.length,
                          group.transactions.length,
                        )}
                      </AppText>
                    </View>
                  </AgentTestId>
                  {group.transactions.map((txn) => (
                    <Card
                      key={txn.id}
                      airy
                      style={{ padding: gap.md }}
                      onPress={() => setSelectedTransaction(txn)}
                      accessibilityLabel={`Categorize ${txn.merchant}`}
                      testID={AgentUiIds.finance.transactions.row(txn.id)}>
                      <View style={[styles.transactionLine, { gap: gap.sm }]}>
                        <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
                          <AppText variant="callout" fit numberOfLines={1}>
                            {txn.merchant}
                          </AppText>
                          <AppText
                            variant="caption"
                            fit
                            numberOfLines={1}
                            style={{ color: theme.accentPrimary }}>
                            {financeCategoryById(txn.categoryId).label}
                            {txn.activity && txn.activity !== 'expense'
                              ? ` · ${txn.activity}`
                              : ''}
                          </AppText>
                        </View>
                        <AppText variant="callout" fit numberOfLines={1}>
                          {formatMoney(txn.amount, txn.currency)}
                        </AppText>
                      </View>
                    </Card>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="finance"
              title={hasQuery || hasCategoryFilter ? 'No Matching Transactions' : 'No Transactions'}
              message={hasQuery || hasCategoryFilter
                ? 'Try another merchant, category, date, or amount.'
                : 'Add expenses or link a card to see spend here.'}
              actionLabel={hasQuery || hasCategoryFilter ? undefined : 'Add Expense'}
              onAction={hasQuery || hasCategoryFilter
                ? undefined
                : () => router.push('/(tabs)/finance/expense')}
              actionTestID={hasQuery || hasCategoryFilter
                ? undefined
                : AgentUiIds.finance.transactions.add}
            />
          )}
        </View>
        <FinanceTransactionCategorySheet
          transaction={selectedTransaction}
          availableCategoryIds={availableCategoryIds}
          onClose={() => setSelectedTransaction(undefined)}
          onSave={(categoryId) => {
            if (!selectedTransaction) return;
            categorizeMerchantTransactions(selectedTransaction.merchant, categoryId);
          }}
        />
      </AgentTestId>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ledgerHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transactionLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
