import { useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  DateField,
  Dropdown,
  EmptyState,
  Input,
  Screen,
  SectionHeader,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import { useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { todayKey } from '@/utils/date';
import { parseFiniteNumber, parsePositiveNumber } from '@/utils/parse';

import { createFinanceBill, personalEntityId } from './create';
import { FinanceSubpageHeader } from './finance-subpage-header';
import {
  FINANCE_BILL_CADENCES,
  FINANCE_BILL_KINDS,
  type FinanceBillCadence,
  type FinanceBillKind,
} from './types';

export function FinanceBillsScreen() {
  const { spacing: gap } = useResponsive();
  const bills = useFinance((s) => s.bills);
  const entities = useFinance((s) => s.entities);
  const baseCurrency = useFinance((s) => s.baseCurrency);
  const saveBill = useFinance((s) => s.saveBill);
  const removeBill = useFinance((s) => s.removeBill);
  const markBillPaid = useFinance((s) => s.markBillPaid);
  const personalId = personalEntityId(entities);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<FinanceBillKind>('subscription');
  const [cadence, setCadence] = useState<FinanceBillCadence>('monthly');
  const [nextDue, setNextDue] = useState(todayKey());
  const [entityId, setEntityId] = useState(personalId);
  const [apr, setApr] = useState('');
  const [error, setError] = useState<string>();

  const save = () => {
    const value = parsePositiveNumber(amount);
    if (!name.trim() || value === undefined || !entityId) {
      setError('Name, amount, and entity are required.');
      return;
    }
    saveBill(
      createFinanceBill({
        name: name.trim(),
        amount: value,
        currency: baseCurrency,
        cadence,
        nextDue,
        entityId,
        kind,
        aprPercent: parseFiniteNumber(apr),
      }),
    );
    setShowForm(false);
    setName('');
    setAmount('');
    setApr('');
    setError(undefined);
  };

  return (
    <Screen refresh={false}>
      <AgentTestId testID={AgentUiIds.finance.bills.screen} label="Bills">
        <View style={{ gap: gap.md }}>
          <FinanceSubpageHeader
            title="Bills & Subscriptions"
            subtitle="Property tax, insurance, car payments, streaming, and other recurring costs."
            trailing={
              <Button
                size="sm"
                onPress={() => setShowForm((v) => !v)}
                testID={AgentUiIds.finance.bills.add}>
                Add
              </Button>
            }
          />

          {showForm ? (
            <Card>
              <View style={{ gap: gap.md }}>
                <Input
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  testID={AgentUiIds.finance.bills.name}
                />
                <Input
                  label="Amount"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  testID={AgentUiIds.finance.bills.amount}
                />
                <Input
                  label="APR % (optional)"
                  value={apr}
                  onChangeText={setApr}
                  keyboardType="decimal-pad"
                />
                <DateField label="Next due" value={nextDue} onChange={setNextDue} />
                <AppText variant="overline" color="secondary" fit>
                  Kind
                </AppText>
                <ChipRow
                  options={FINANCE_BILL_KINDS.map((k) => ({ value: k, label: k }))}
                  selected={kind}
                  onSelect={setKind}
                  scrollable
                  testIDForOption={(k) => AgentUiIds.finance.bills.kind(k)}
                />
                <Dropdown
                  label="Cadence"
                  value={cadence}
                  options={FINANCE_BILL_CADENCES.map((c) => ({ value: c, label: c }))}
                  onChange={setCadence}
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
                {error ? (
                  <AppText variant="caption" color="danger">
                    {error}
                  </AppText>
                ) : null}
                <Button onPress={save} testID={AgentUiIds.finance.bills.save}>
                  Save bill
                </Button>
              </View>
            </Card>
          ) : null}

          <SectionHeader title="Active" flush />
          {bills.filter((b) => b.active).length ? (
            bills
              .filter((b) => b.active)
              .sort((a, b) => a.nextDue.localeCompare(b.nextDue))
              .map((bill) => (
                <Card key={bill.id} testID={AgentUiIds.finance.bills.row(bill.id)}>
                  <View style={{ gap: gap.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: gap.sm }}>
                      <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
                        <AppText variant="callout" fit numberOfLines={1}>
                          {bill.name}
                        </AppText>
                        <AppText variant="caption" color="secondary" fit>
                          {formatMoney(bill.amount, bill.currency)} · {bill.kind} ·{' '}
                          {bill.cadence} · due {bill.nextDue}
                          {bill.aprPercent != null ? ` · ${bill.aprPercent}% APR` : ''}
                        </AppText>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: gap.sm }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => markBillPaid(bill.id)}
                        testID={AgentUiIds.finance.bills.markPaid(bill.id)}
                      >
                        Mark paid
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => removeBill(bill.id)}
                      >
                        Delete
                      </Button>
                    </View>
                  </View>
                </Card>
              ))
          ) : (
            <EmptyState
              icon="finance"
              title="No recurring bills"
              message="Add subscriptions, property tax, insurance, or car payments."
            />
          )}
        </View>
      </AgentTestId>
    </Screen>
  );
}
