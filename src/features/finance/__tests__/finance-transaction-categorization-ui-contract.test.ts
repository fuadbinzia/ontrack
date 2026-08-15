import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Finance transaction categorization UI contract', () => {
  const screen = source('src/features/finance/finance-transactions-screen.tsx');
  const hub = source('src/features/finance/finance-screen.tsx');
  const sheet = source('src/features/finance/finance-transaction-category-sheet.tsx');
  const sharedSelector = source('src/components/shared/category-creator-selector.tsx');

  it('opens a glass category sheet from a transaction without showing its provider', () => {
    expect(screen).toContain('onPress={() => setSelectedTransaction(txn)}');
    expect(screen).toContain('<FinanceTransactionCategorySheet');
    expect(screen).not.toContain("{txn.source}");
    expect(sheet).toContain('<SheetScaffold');
    expect(sheet).toContain('title="Categorize Transaction"');
  });

  it('keeps the header focused on a single icon-only add action', () => {
    expect(screen).toContain('<IconButton');
    expect(screen).toContain('icon="add"');
    expect(screen).toContain('accessibilityLabel="Add Expense"');
    expect(screen).not.toContain('transactions.importEzPass');
    expect(screen).not.toContain('>\n                  E-ZPass\n');
  });

  it('filters by multiple categories and exposes several useful sort choices', () => {
    expect(screen).toContain('<Dropdown\n                multiple');
    expect(screen).toContain('label="Categories"');
    expect(screen).toContain('placeholder="All Categories"');
    expect(screen).toContain('label="Sort By"');
    expect(screen).toContain('FINANCE_TRANSACTION_SORT_OPTIONS.map');
    expect(screen).toContain('filterAndSortFinanceTransactions(');
  });

  it('presents search, controls, and ledger rows as one polished hierarchy', () => {
    expect(screen).toContain('subtitle="Your card activity, organized."');
    expect(screen).toContain('fieldBorderRadius={radii.xl}');
    expect(screen).toContain('labelColor={theme.textTertiary}');
    expect(screen).toContain('<AppText variant="overline" color="tertiary" fit>');
    expect(screen).toContain('testID={AgentUiIds.finance.transactions.activitySection}');
    expect(screen).not.toContain('<GlassIconWell');
    expect(screen).not.toContain('transactionCategoryIcon');
    expect(screen).toContain('style={{ color: theme.accentPrimary }}');
    expect(screen).toContain('airy');
  });

  it('breaks the ledger into labeled date groups without repeating dates in rows', () => {
    expect(screen).toContain('groupFinanceTransactionsByDate(sorted, sortBy)');
    expect(screen).toContain('dateGroups.map((group) =>');
    expect(screen).toContain('financeTransactionDateLabel(group.date, dateDisplayFormat)');
    expect(screen).toContain('AgentUiIds.finance.transactions.dateGroup(group.date)');
    expect(screen).not.toContain('formatDateKey(txn.date, dateDisplayFormat)');
  });

  it('does not show a redundant add action in the main Finance header', () => {
    expect(hub).not.toContain('AgentUiIds.finance.addExpense');
    expect(hub).not.toContain("router.push('/(tabs)/finance/expense')");
  });

  it('reuses the checklist category creator and selector', () => {
    expect(sheet).toContain('<CategoryCreatorSelector');
    expect(sheet).toContain('onCreateCategory={createCategory}');
    expect(sharedSelector).toContain('placeholder="Search or create category"');
    expect(sharedSelector).toContain('filterCategoryCreatorOptions(categories, value, draft)');
    expect(sharedSelector).toContain('accessibilityLabel="Create category"');
  });

  it('saves the selected category as a merchant-wide rule', () => {
    expect(screen).toContain(
      'categorizeMerchantTransactions(selectedTransaction.merchant, categoryId)',
    );
    expect(sheet).toContain(
      'This category will also apply to transactions with the same merchant.',
    );
    expect(sheet).toContain('testID={AgentUiIds.finance.transactions.categorySave}');
  });
});
