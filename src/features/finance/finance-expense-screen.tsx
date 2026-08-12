import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  DateField,
  Dropdown,
  Input,
  Screen,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { useResponsive } from '@/hooks/use-responsive';
import { createFinanceTransaction, useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { todayKey } from '@/utils/date';
import { parsePositiveNumber } from '@/utils/parse';

import { FINANCE_CATEGORIES } from './categories';
import { personalEntityId } from './create';
import { FinanceSubpageHeader } from './finance-subpage-header';

export function FinanceExpenseScreen() {
  const router = useRouter();
  const { spacing: gap } = useResponsive();
  const entities = useFinance((s) => s.entities);
  const accounts = useFinance((s) => s.accounts);
  const baseCurrency = useFinance((s) => s.baseCurrency);
  const saveTransaction = useFinance((s) => s.saveTransaction);
  const personalId = personalEntityId(entities);

  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [categoryId, setCategoryId] = useState('other');
  const [entityId, setEntityId] = useState(personalId);
  const [accountId, setAccountId] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();

  const save = () => {
    const value = parsePositiveNumber(amount);
    if (!merchant.trim()) {
      setError('Add a merchant or label.');
      return;
    }
    if (value === undefined) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!entityId) {
      setError('Pick an entity.');
      return;
    }
    saveTransaction(
      createFinanceTransaction({
        amount: value,
        currency: baseCurrency,
        date,
        merchant: merchant.trim(),
        categoryId,
        entityId,
        accountId,
        notes: notes.trim() || undefined,
        source: 'manual',
      }),
    );
    router.back();
  };

  return (
    <Screen refresh={false}>
      <AgentTestId testID={AgentUiIds.finance.expense.form} label="Expense form">
        <View style={{ gap: gap.md }}>
          <FinanceSubpageHeader title="Add Expense" />
          <Input
            label="Merchant"
            value={merchant}
            onChangeText={setMerchant}
            testID={AgentUiIds.finance.expense.merchant}
          />
          <Input
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            testID={AgentUiIds.finance.expense.amount}
          />
          <DateField
            label="Date"
            value={date}
            onChange={setDate}
            testID={AgentUiIds.finance.expense.date}
          />
          <AppText variant="overline" color="secondary" fit>
            Category
          </AppText>
          <ChipRow
            options={FINANCE_CATEGORIES.map((c) => ({
              value: c.id,
              label: c.label,
            }))}
            selected={categoryId}
            onSelect={setCategoryId}
            scrollable
            testIDForOption={(id) => AgentUiIds.finance.expense.category(id)}
          />
          <Dropdown
            label="Entity"
            value={entityId}
            options={entities.map((e) => ({
              value: e.id,
              label: `${e.name} (${e.kind})`,
            }))}
            onChange={setEntityId}
          />
          {accounts.length ? (
            <Dropdown
              label="Account"
              value={accountId ?? ''}
              options={[
                { value: '', label: 'None' },
                ...accounts.map((a) => ({
                  value: a.id,
                  label: a.last4 ? `${a.name} ····${a.last4}` : a.name,
                })),
              ]}
              onChange={(value) => setAccountId(value || undefined)}
            />
          ) : null}
          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            testID={AgentUiIds.finance.expense.notes}
          />
          {error ? (
            <AppText variant="caption" color="danger">
              {error}
            </AppText>
          ) : null}
          <Button onPress={save} testID={AgentUiIds.finance.expense.save}>
            Save expense
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.back()}
            testID={AgentUiIds.finance.expense.cancel}
          >
            Cancel
          </Button>
        </View>
      </AgentTestId>
    </Screen>
  );
}
