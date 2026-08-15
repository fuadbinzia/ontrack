import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Dropdown,
  fieldTitleCase,
  FormSection,
  Input,
  SheetScaffold,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import {
  FINANCE_BILL_KINDS,
  type FinanceBillKind,
  type FinanceRecurringBill,
} from './types';

type RecurringExpenseType = 'bill' | 'subscription';
type BillCategory = Exclude<FinanceBillKind, 'subscription'>;
export type FinanceRecurringClassificationExpense = Pick<
  FinanceRecurringBill,
  'id' | 'name' | 'amount' | 'currency' | 'cadence' | 'kind'
>;

export type FinanceRecurringExpenseChanges = Pick<
  FinanceRecurringBill,
  'name' | 'kind'
>;

const EXPENSE_TYPES: { value: RecurringExpenseType; label: string }[] = [
  { value: 'bill', label: 'Bill' },
  { value: 'subscription', label: 'Subscription' },
];

const BILL_CATEGORIES = FINANCE_BILL_KINDS.filter(
  (kind): kind is BillCategory => kind !== 'subscription',
);

export function FinanceRecurringClassificationSheet({
  expense,
  onClose,
  onSave,
  onRemove,
  removeTestID,
}: {
  expense?: FinanceRecurringClassificationExpense;
  onClose: () => void;
  onSave: (changes: FinanceRecurringExpenseChanges) => void;
  onRemove?: () => void;
  removeTestID?: string;
}) {
  const { spacing } = useResponsive();
  const theme = useTheme();
  const [expenseType, setExpenseType] = useState<RecurringExpenseType>('bill');
  const [billKind, setBillKind] = useState<BillCategory>('bill');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!expense) return;
    const kind = expense.kind;
    const isSubscription = kind === 'subscription';
    setName(expense.name);
    setExpenseType(isSubscription ? 'subscription' : 'bill');
    if (isSubscription) {
      setBillKind('bill');
    } else {
      setBillKind(kind);
    }
  }, [expense]);

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave({
      name: trimmedName,
      kind: expenseType === 'subscription' ? 'subscription' : billKind,
    });
    onClose();
  };

  const editingSavedExpense = Boolean(onRemove);

  return (
    <SheetScaffold
      visible={Boolean(expense)}
      eyebrow="Recurring Expense"
      title={editingSavedExpense ? 'Edit Recurring Expense' : 'Categorize Expense'}
      subtitle={expense
        ? editingSavedExpense
          ? `${formatMoney(expense.amount, expense.currency)} · ${fieldTitleCase(expense.cadence)}`
          : `${expense.name} · ${formatMoney(expense.amount, expense.currency)} · ${fieldTitleCase(expense.cadence)}`
        : undefined}
      onClose={onClose}
      closeAccessibilityLabel={editingSavedExpense ? 'Close Edit Recurring Expense' : 'Close Categorize Expense'}
      closeTestID={AgentUiIds.finance.recurring.categorizeClose}
      backdropTestID={AgentUiIds.finance.recurring.categorizeBackdrop}
      fitContent
      footer={(
        <View style={{ gap: spacing.sm }}>
          <Button
            icon="check"
            onPress={save}
            disabled={!name.trim()}
            testID={AgentUiIds.finance.recurring.categorizeSave}>
            {editingSavedExpense ? 'Save Changes' : `Save As ${expenseType}`}
          </Button>
          {onRemove && removeTestID ? (
            <Button
              variant="danger"
              icon="delete"
              onPress={onRemove}
              testID={removeTestID}>
              {`Delete ${expenseType === 'subscription' ? 'Subscription' : 'Bill'}`}
            </Button>
          ) : null}
        </View>
      )}>
      <AgentTestId
        testID={AgentUiIds.finance.recurring.categorizeSheet}
        label="Categorize Recurring Expense">
        <View style={{ gap: spacing.md }}>
          {editingSavedExpense ? (
            <FormSection title="Details">
              <Input
                stackedLabel="Name"
                icon="receipt"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="done"
                testID={AgentUiIds.finance.recurring.categorizeName}
              />
            </FormSection>
          ) : null}
          <FormSection
            title="Track As"
            description="Bills are obligations. Subscriptions are recurring services or memberships.">
            <ChipRow
              options={EXPENSE_TYPES}
              selected={expenseType}
              onSelect={setExpenseType}
              testIDForOption={(type) => AgentUiIds.finance.recurring.categorizeType(type)}
            />
            {expenseType === 'bill' ? (
              <Dropdown
                label="Bill Category"
                icon="receipt"
                labelColor={theme.textSecondary}
                value={billKind}
                options={BILL_CATEGORIES.map((kind) => ({ value: kind, label: kind }))}
                onChange={setBillKind}
                testID={AgentUiIds.finance.recurring.categorizeBillKind}
              />
            ) : null}
          </FormSection>
        </View>
      </AgentTestId>
    </SheetScaffold>
  );
}
