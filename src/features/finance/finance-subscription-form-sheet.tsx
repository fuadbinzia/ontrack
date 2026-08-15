import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  DateField,
  Dropdown,
  FormSection,
  Input,
  SheetScaffold,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { todayKey } from '@/utils/date';
import { parseFiniteNumber, parsePositiveNumber } from '@/utils/parse';

import {
  FINANCE_BILL_CADENCES,
  FINANCE_BILL_KINDS,
  type FinanceBillCadence,
  type FinanceBillKind,
  type FinanceEntity,
} from './types';

type RecurringExpenseType = 'bill' | 'subscription';
type BillCategory = Exclude<FinanceBillKind, 'subscription'>;

export type ManualFinanceRecurringExpense = {
  name: string;
  amount: number;
  cadence: FinanceBillCadence;
  nextDue: string;
  entityId: string;
  kind: FinanceBillKind;
  aprPercent?: number;
};

const EXPENSE_TYPES: { value: RecurringExpenseType; label: string }[] = [
  { value: 'bill', label: 'Bill' },
  { value: 'subscription', label: 'Subscription' },
];

const BILL_CATEGORIES = FINANCE_BILL_KINDS.filter(
  (kind): kind is BillCategory => kind !== 'subscription',
);

export function FinanceRecurringExpenseFormSheet({
  visible,
  entities,
  defaultEntityId,
  onClose,
  onSave,
}: {
  visible: boolean;
  entities: FinanceEntity[];
  defaultEntityId?: string;
  onClose: () => void;
  onSave: (expense: ManualFinanceRecurringExpense) => string | undefined;
}) {
  const { spacing } = useResponsive();
  const [expenseType, setExpenseType] = useState<RecurringExpenseType>('bill');
  const [billKind, setBillKind] = useState<BillCategory>('bill');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [apr, setApr] = useState('');
  const [cadence, setCadence] = useState<FinanceBillCadence>('monthly');
  const [nextDue, setNextDue] = useState(todayKey());
  const [entityId, setEntityId] = useState(defaultEntityId ?? entities[0]?.id ?? '');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!visible) return;
    setExpenseType('bill');
    setBillKind('bill');
    setName('');
    setAmount('');
    setApr('');
    setCadence('monthly');
    setNextDue(todayKey());
    setEntityId(defaultEntityId ?? entities[0]?.id ?? '');
    setError(undefined);
  }, [defaultEntityId, entities, visible]);

  const chooseType = (nextType: RecurringExpenseType) => {
    setExpenseType(nextType);
    if (nextType === 'subscription' && cadence === 'once') setCadence('monthly');
    setError(undefined);
  };

  const save = () => {
    const parsedAmount = parsePositiveNumber(amount);
    if (!name.trim() || parsedAmount === undefined || !entityId) {
      setError('Enter a name, positive amount, and entity.');
      return;
    }

    const saveError = onSave({
      name: name.trim(),
      amount: parsedAmount,
      cadence,
      nextDue,
      entityId,
      kind: expenseType === 'subscription' ? 'subscription' : billKind,
      aprPercent: billKind === 'loan' ? parseFiniteNumber(apr) : undefined,
    });
    if (saveError) {
      setError(saveError);
      return;
    }
    onClose();
  };

  const cadenceOptions = FINANCE_BILL_CADENCES
    .filter((value) => expenseType === 'bill' || value !== 'once')
    .map((value) => ({ value, label: value }));

  return (
    <SheetScaffold
      visible={visible}
      eyebrow="Manual Entry"
      title="Add Recurring Expense"
      subtitle="Choose whether this repeats as a bill or a subscription."
      onClose={onClose}
      closeAccessibilityLabel="Close Add Recurring Expense"
      closeTestID={AgentUiIds.finance.recurring.formClose}
      backdropTestID={AgentUiIds.finance.recurring.formBackdrop}
      scrollKey={`${expenseType}-${visible ? 'open' : 'closed'}`}
      footer={(
        <Button icon="add" onPress={save} testID={AgentUiIds.finance.recurring.save}>
          Save {expenseType}
        </Button>
      )}>
      <AgentTestId testID={AgentUiIds.finance.recurring.form} label="Recurring Expense Form">
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="overline" color="secondary" fit>
              Type
            </AppText>
            <ChipRow
              options={EXPENSE_TYPES}
              selected={expenseType}
              onSelect={chooseType}
              testIDForOption={(type) => AgentUiIds.finance.recurring.type(type)}
            />
          </View>

          <FormSection
            title={expenseType === 'subscription' ? 'Subscription Details' : 'Bill Details'}
            description={expenseType === 'subscription'
              ? 'Use the name shown on your statement so detected charges stay recognizable.'
              : 'Add the amount and due date you want to keep on track.'}
            error={error}>
            {expenseType === 'bill' ? (
              <Dropdown
                label="Bill Category"
                icon="receipt"
                value={billKind}
                options={BILL_CATEGORIES.map((value) => ({ value, label: value }))}
                onChange={setBillKind}
                testID={AgentUiIds.finance.recurring.billKind}
              />
            ) : null}
            <Input
              stackedLabel={expenseType === 'subscription' ? 'Subscription Name' : 'Bill Name'}
              icon="receipt"
              placeholder={expenseType === 'subscription' ? 'Music, storage, streaming…' : 'Insurance, rent, car payment…'}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              testID={AgentUiIds.finance.recurring.name}
            />
            <Input
              stackedLabel="Amount"
              icon="finance"
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              testID={AgentUiIds.finance.recurring.amount}
            />
            {expenseType === 'bill' && billKind === 'loan' ? (
              <Input
                stackedLabel="APR (Optional)"
                icon="finance"
                placeholder="0.00"
                value={apr}
                onChangeText={setApr}
                keyboardType="decimal-pad"
                testID={AgentUiIds.finance.recurring.apr}
              />
            ) : null}
            <Dropdown
              label="Cadence"
              icon="repeat"
              value={cadence}
              options={cadenceOptions}
              onChange={setCadence}
              testID={AgentUiIds.finance.recurring.cadence}
            />
            <DateField
              stackedLabel={expenseType === 'subscription' ? 'Next Charge' : 'Next Due'}
              value={nextDue}
              onChange={setNextDue}
              testID={AgentUiIds.finance.recurring.nextDue}
            />
            <Dropdown
              label="Entity"
              icon="building"
              value={entityId}
              options={entities.map((entity) => ({
                value: entity.id,
                label: `${entity.name} (${entity.kind})`,
              }))}
              onChange={setEntityId}
              testID={AgentUiIds.finance.recurring.entity}
            />
          </FormSection>
        </View>
      </AgentTestId>
    </SheetScaffold>
  );
}
