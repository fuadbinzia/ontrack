import fs from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Finance recurring expenses UI contract', () => {
  const screen = source(
    'src/features/finance/finance-subscriptions-screen.tsx',
  );
  const formSheet = source(
    'src/features/finance/finance-subscription-form-sheet.tsx',
  );
  const classificationSheet = source(
    'src/features/finance/finance-recurring-classification-sheet.tsx',
  );
  const deleteHandoff = source(
    'src/features/finance/recurring-expense-delete.ts',
  );
  const sheetScaffold = source(
    'src/components/primitives/sheet-scaffold.tsx',
  );
  const billsEntry = source('src/features/finance/finance-bills-screen.tsx');
  const subscriptionsRoute = source('src/app/(tabs)/finance/subscriptions.tsx');
  const flows = source('src/utils/agent-ui/flows-addons.ts');
  const hub = source('src/features/finance/finance-screen.tsx');

  it('combines bills and subscriptions into one glass hub card and destination', () => {
    expect(hub).toContain('testID={AgentUiIds.finance.openRecurring}');
    expect(hub).toContain('<PanelTitle>Bills & Subscriptions</PanelTitle>');
    expect(hub).toContain("router.push('/(tabs)/finance/bills')");
    expect(hub).toContain('monthlyRecurringAmount(activeRecurring)');
    expect(hub).not.toContain("section('bills')");
    expect(hub).not.toContain("section('subscriptions')");
    expect(hub).not.toContain("router.push('/(tabs)/finance/subscriptions')");
    expect(hub).not.toContain('actionLabel="Manage"');
    expect(screen).not.toContain('surface="solid"');
  });

  it('shows both saved types without a card-level paid action', () => {
    expect(screen).toContain('title="Bills & Subscriptions"');
    expect(screen).toContain('title="Upcoming"');
    expect(screen).toContain('const recurringExpenses = [...bills]');
    expect(screen).not.toContain("bill.kind !== 'subscription'");
    expect(screen).toContain("expense.kind === 'subscription'");
    expect(screen).not.toContain('markBillPaid');
    expect(screen).not.toContain('Mark Paid');
    expect(screen).not.toContain('finance.bills.markPaid');
    expect(deleteHandoff).toContain('actions.removeSubscription(expense.id)');
    expect(deleteHandoff).toContain('actions.removeBill(expense.id)');
    expect(screen).toContain("{isSubscription ? 'Next Charge' : 'Next Due'}");
    expect(screen).toContain(
      'formatDateKey(expense.nextDue, dateDisplayFormat)',
    );
    expect(screen).toContain('formatMoney(expense.amount, expense.currency)');
    expect(screen).not.toContain(
      "{isSubscription ? 'next' : 'due'} {expense.nextDue}",
    );
  });

  it('lets users choose Bill or Subscription in a polished glass bottom sheet', () => {
    expect(screen).toContain('<FinanceRecurringExpenseFormSheet');
    expect(screen).toContain('accessibilityLabel="Add Bill Or Subscription"');
    expect(screen).not.toContain('{showForm ? (');
    expect(formSheet).toContain('<SheetScaffold');
    expect(formSheet).toContain('title="Add Recurring Expense"');
    expect(formSheet).toContain("{ value: 'bill', label: 'Bill' }");
    expect(formSheet).toContain(
      "{ value: 'subscription', label: 'Subscription' }",
    );
    expect(formSheet).toContain('AgentUiIds.finance.recurring.type(type)');
    expect(formSheet).toContain(
      "expenseType === 'subscription' ? 'subscription' : billKind",
    );
    expect(formSheet).toContain("expenseType === 'bill' || value !== 'once'");
    expect(formSheet).toContain('label="Bill Category"');
    expect(formSheet).toContain("billKind === 'loan'");
    expect(formSheet).not.toContain('surface="solid"');
  });

  it('keeps detected bill and subscription review on the combined page', () => {
    expect(screen).toContain('title="Review"');
    expect(screen).toContain('confirmSubscriptionCandidate');
    expect(screen).toContain('dismissSubscriptionCandidate');
    expect(screen).toContain('refreshFinanceSubscriptions');
    expect(screen).toContain('result.transactionCount');
    expect(screen).toContain('result.candidateCount');
    expect(screen).toContain('icon="sync"');
    expect(screen).toContain('loading={refreshing}');
    expect(screen).toContain('icon="close"');
    expect(screen).toContain('setRefreshFeedback(undefined)');
    expect(screen).toContain(
      'AgentUiIds.finance.subscriptions.dismissRefreshStatus',
    );
    expect(screen).toContain('accessibilityLabel="Dismiss Refresh Result"');
    expect(screen).toContain('Detection Is Preparing');
    expect(screen).toContain('<DetectionStatusCard');
    expect(screen).not.toContain('No New Matches');
    expect(screen).toContain('<Card variant="sunken"');
    expect(screen).toContain('recurringKindLabel(candidate.suggestedKind)');
    expect(screen).toContain(
      'Add As ${recurringKindLabel(candidate.suggestedKind)}',
    );
    expect(screen).toContain(
      'onConfirm={() => setCandidateToConfirm(candidate)}',
    );
    expect(screen).toContain('kind: candidateToConfirm.suggestedKind');
    expect(screen).toContain(
      'confirmCandidate(candidateToConfirm.id, changes.kind)',
    );
  });

  it('makes the displayed type actionable and persists categorization changes', () => {
    expect(screen).toContain(
      'onCategorize={() => setExpenseToCategorize(expense)}',
    );
    expect(screen).toContain(
      'AgentUiIds.finance.recurring.categorize(expense.id)',
    );
    expect(screen).not.toContain('<ActionChip');
    expect(screen).toContain(
      'accessibilityLabel={`Edit ${recurringKindLabel(expense.kind)}`}',
    );
    expect(screen).toContain('icon="edit"');
    expect(screen).not.toContain('icon="delete"');
    expect(screen).not.toContain('trailing="chevron-right"');
    expect(screen).toContain('<FinanceRecurringClassificationSheet');
    expect(screen).toContain(
      'saveBill(editRecurringExpense(expenseToCategorize, changes))',
    );
    expect(classificationSheet).toContain("'Edit Recurring Expense'");
    expect(classificationSheet).toContain('stackedLabel="Name"');
    expect(classificationSheet).toContain(
      'AgentUiIds.finance.recurring.categorizeName',
    );
    expect(classificationSheet).toContain("{ value: 'bill', label: 'Bill' }");
    expect(classificationSheet).toContain(
      "{ value: 'subscription', label: 'Subscription' }",
    );
    expect(classificationSheet).toContain(
      'AgentUiIds.finance.recurring.categorizeType(type)',
    );
    expect(classificationSheet).toContain(
      'AgentUiIds.finance.recurring.categorizeSave',
    );
    expect(classificationSheet).toContain('title="Track As"');
    expect(classificationSheet).toContain(
      'formatMoney(expense.amount, expense.currency)',
    );
    expect(classificationSheet).toContain('fieldTitleCase(expense.cadence)');
    expect(classificationSheet).toContain('labelColor={theme.textSecondary}');
    expect(classificationSheet).toContain('`Save As ${expenseType}`');
    expect(classificationSheet).toContain("'Save Changes'");
    expect(classificationSheet).toContain('variant="danger"');
    expect(classificationSheet).toContain('`Delete ${expenseType');
    expect(classificationSheet).not.toContain('<DangerZone');
    expect(classificationSheet).not.toContain('<DestructiveSection');
    expect(classificationSheet.indexOf("'Save Changes'")).toBeLessThan(
      classificationSheet.indexOf('`Delete ${expenseType'),
    );
    expect(classificationSheet).toContain('removeTestID');
    expect(screen).toContain('openRecurringExpenseDeleteConfirmation');
    expect(screen).not.toContain('confirmDestructiveAction({');
    expect(screen).toContain(
      'closeEditor: () => setExpenseToCategorize(undefined)',
    );
    expect(screen).not.toContain('reopenEditor: setExpenseToCategorize');
    expect(deleteHandoff).not.toContain('deferAfterPageTransition');
    expect(deleteHandoff).not.toContain('actions.closeEditor();\n  confirm');
    expect(classificationSheet).toContain('<SheetScaffold');
    expect(sheetScaffold).toContain('<AppPromptHost embedded />');
    expect(deleteHandoff).toMatch(
      /onConfirm: \(\) => \{[\s\S]*?actions\.remove(?:Subscription|Bill)\(expense\.id\);[\s\S]*?actions\.closeEditor\(\);/,
    );
    expect(deleteHandoff).toContain("? 'Delete Subscription?'");
    expect(deleteHandoff).toContain("actionLabel: 'Delete'");
    expect(classificationSheet).not.toContain('Save As {expenseType}');
    expect(classificationSheet).not.toContain('surface="solid"');
  });

  it('keeps recurring item identity and amount visible in compact action cards', () => {
    expect(screen).toContain('style={{ flex: 1, minWidth: 0, gap: gap.xs }}');
    expect(screen).toContain('{expense.name}');
    expect(screen).toContain('formatMoney(expense.amount, expense.currency)');
    expect(screen).toContain(
      'formatDateKey(expense.nextDue, dateDisplayFormat)',
    );
    expect(screen).toContain("{contextName ? `${contextName} · ` : ''}");
    expect(screen).toContain('{recurringKindLabel(expense.kind)}');
    expect(screen).toContain('<View style={{ gap: gap.sm }}>');
    expect(screen).not.toContain('onRemove={onRemove}');
  });

  it('keeps both legacy routes on the same combined management surface', () => {
    expect(billsEntry).toContain(
      'FinanceBillsAndSubscriptionsScreen as FinanceBillsScreen',
    );
    expect(subscriptionsRoute).toContain('FinanceBillsAndSubscriptionsScreen');
    expect(flows).toContain("{ op: 'goto', to: 'finance/bills' }");
    expect(flows).toContain("id: 'ontrack.finance.recurring.type.bill'");
    expect(flows).toContain(
      "id: 'ontrack.finance.recurring.type.subscription'",
    );
    expect(flows).toContain(
      "{ op: 'tap', id: 'ontrack.finance.recurring.form.close' }",
    );
  });
});
