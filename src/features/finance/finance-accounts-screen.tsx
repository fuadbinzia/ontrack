import { useState } from 'react';
import { View } from 'react-native';

import {
  appPrompt,
  AppText,
  Button,
  Card,
  EmptyState,
  Input,
  Screen,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import {
  createPlaidLinkToken,
  deletePlaidAccessToken,
  exchangePlaidPublicToken,
  loadPlaidAccessToken,
  syncPlaidTransactions,
  type PlaidLinkPurpose,
} from '@/services/finance';
import { createFinanceTransaction, useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { todayKey } from '@/utils/date';
import { parseFiniteNumber } from '@/utils/parse';

import { applyPlaidExchangeResult } from './apply-plaid-link';
import { createFinanceAccount, createFinanceHolding, personalEntityId } from './create';
import { FinancePlaidLinkSheet } from './finance-plaid-link-sheet';
import { FinanceSubpageHeader } from './finance-subpage-header';
import {
  FINANCE_ACCOUNT_KIND_LABEL,
  FINANCE_ACCOUNT_KINDS,
  isFinanceInvestmentKind,
  type FinanceAccount,
  type FinanceAccountKind,
} from './types';

export function FinanceAccountsScreen() {
  const { spacing: gap } = useResponsive();
  const accounts = useFinance((s) => s.accounts);
  const holdings = useFinance((s) => s.holdings);
  const entities = useFinance((s) => s.entities);
  const baseCurrency = useFinance((s) => s.baseCurrency);
  const referenceSavingsApr = useFinance((s) => s.referenceSavingsApr);
  const saveAccount = useFinance((s) => s.saveAccount);
  const removeAccount = useFinance((s) => s.removeAccount);
  const upsertPlaidTransactions = useFinance((s) => s.upsertPlaidTransactions);
  const upsertHoldings = useFinance((s) => s.upsertHoldings);
  const setReferenceSavingsApr = useFinance((s) => s.setReferenceSavingsApr);
  const personalId = personalEntityId(entities);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FinanceAccountKind>('card');
  const [last4, setLast4] = useState('');
  const [apr, setApr] = useState('');
  const [balanceText, setBalanceText] = useState('');
  const [savingsAprText, setSavingsAprText] = useState(
    referenceSavingsApr != null ? String(referenceSavingsApr) : '',
  );
  const [linking, setLinking] = useState(false);
  const [syncingId, setSyncingId] = useState<string>();
  const [linkToken, setLinkToken] = useState<string>();
  const [linkPurpose, setLinkPurpose] = useState<PlaidLinkPurpose>('transactions');
  const [linkOpen, setLinkOpen] = useState(false);
  const [error, setError] = useState<string>();

  const saveManual = () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const aprValue = parseFiniteNumber(apr);
    const balanceValue = parseFiniteNumber(balanceText);
    saveAccount(
      createFinanceAccount({
        name: name.trim(),
        kind,
        last4: last4.replace(/\D/g, '').slice(-4) || undefined,
        aprPercent: aprValue,
        balance: balanceValue,
        balanceAsOf: balanceValue !== undefined ? todayKey() : undefined,
        currency: baseCurrency,
        linkStatus: 'manual',
      }),
    );
    setShowForm(false);
    setName('');
    setLast4('');
    setApr('');
    setBalanceText('');
    setError(undefined);
  };

  const finishPublicToken = async (
    publicToken: string,
    purpose: PlaidLinkPurpose,
  ) => {
    const exchanged = await exchangePlaidPublicToken(publicToken, purpose);
    if (!exchanged.ok || !personalId) {
      appPrompt.alert(
        'Link failed',
        exchanged.ok ? 'No personal entity found.' : exchanged.error,
      );
      return;
    }
    await applyPlaidExchangeResult(exchanged, personalId, baseCurrency);
    appPrompt.alert(
      purpose === 'investments' ? 'Investments linked' : 'Accounts linked',
      purpose === 'investments'
        ? 'Holdings and balances were imported from Plaid.'
        : 'Recent transactions were imported from Plaid.',
    );
  };

  const startLink = async (purpose: PlaidLinkPurpose) => {
    setLinking(true);
    try {
      const tokenResult = await createPlaidLinkToken(purpose);
      if (!tokenResult.ok) {
        const sandbox = process.env.EXPO_PUBLIC_PLAID_SANDBOX_PUBLIC_TOKEN?.trim();
        if (sandbox) {
          await finishPublicToken(sandbox, purpose);
          return;
        }
        appPrompt.alert(
          purpose === 'investments' ? 'Investment linking unavailable' : 'Bank linking unavailable',
          tokenResult.configured
            ? tokenResult.error
            : 'Plaid is not configured for this build. Add accounts manually, or set PLAID_CLIENT_ID / PLAID_SECRET on the API host.',
        );
        return;
      }
      setLinkPurpose(purpose);
      setLinkToken(tokenResult.linkToken);
      setLinkOpen(true);
    } finally {
      setLinking(false);
    }
  };

  const syncAccount = async (account: FinanceAccount) => {
    if (!account.plaidItemId || !personalId) return;
    setSyncingId(account.id);
    const purpose: PlaidLinkPurpose = isFinanceInvestmentKind(account.kind)
      ? 'investments'
      : 'transactions';
    try {
      const token = await loadPlaidAccessToken(account.plaidItemId);
      if (!token) {
        appPrompt.alert(
          'Re-link required',
          'No stored Plaid token for this account. Link again to refresh.',
        );
        return;
      }
      const synced = await syncPlaidTransactions(token, 30, purpose);
      if (!synced.ok) {
        appPrompt.alert('Sync failed', synced.error);
        return;
      }
      if (purpose === 'investments') {
        const row = synced.accounts.find((a) => a.accountId === account.plaidAccountId);
        if (typeof row?.balance === 'number') {
          saveAccount({
            ...account,
            balance: row.balance,
            balanceAsOf: todayKey(),
          });
        }
        upsertHoldings(
          synced.holdings
            .filter((h) => !h.accountId || h.accountId === account.plaidAccountId)
            .map((h) =>
              createFinanceHolding({
                accountId: account.id,
                symbol: h.symbol,
                name: h.name,
                quantity: h.quantity,
                value: h.value,
                currency: h.currency || baseCurrency,
                asOf: h.asOf,
                externalId: h.externalId,
              }),
            ),
        );
        appPrompt.alert('Synced', `Imported ${synced.holdings.length} holdings.`);
        return;
      }
      upsertPlaidTransactions(
        synced.transactions.map((t) =>
          createFinanceTransaction({
            amount: t.amount,
            currency: baseCurrency,
            date: t.date,
            merchant: t.merchant,
            categoryId: 'other',
            entityId: personalId,
            accountId: account.id,
            source: 'plaid',
            externalId: t.externalId,
          }),
        ),
      );
      appPrompt.alert('Synced', `Imported ${synced.transactions.length} recent transactions.`);
    } finally {
      setSyncingId(undefined);
    }
  };

  const disconnect = async (account: FinanceAccount) => {
    if (account.plaidItemId) {
      await deletePlaidAccessToken(account.plaidItemId);
    }
    removeAccount(account.id);
  };

  return (
    <Screen refresh={false}>
      <AgentTestId testID={AgentUiIds.finance.accounts.screen} label="Accounts">
        <View style={{ gap: gap.md }}>
          <FinanceSubpageHeader
            title="Cards & Accounts"
            subtitle="Track APR, balances, and investments. Link banks or brokerages with Plaid when configured."
          />

          <Card>
            <Input
              label="Cash / HYSA reference APR %"
              value={savingsAprText}
              onChangeText={setSavingsAprText}
              keyboardType="decimal-pad"
              testID={AgentUiIds.finance.accounts.savingsApr}
            />
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                const n = parseFiniteNumber(savingsAprText);
                setReferenceSavingsApr(Number.isFinite(n) ? n : undefined);
              }}
              style={{ marginTop: gap.sm }}>
              Save rate context
            </Button>
          </Card>

          <View style={{ flexDirection: 'row', gap: gap.sm, flexWrap: 'wrap' }}>
            <Button
              size="sm"
              onPress={() => setShowForm((v) => !v)}
              testID={AgentUiIds.finance.accounts.addManual}>
              Add manual
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={linking}
              onPress={() => void startLink('transactions')}
              testID={AgentUiIds.finance.accounts.linkBank}>
              {linking ? 'Linking…' : 'Link bank'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={linking}
              onPress={() => void startLink('investments')}
              testID={AgentUiIds.finance.accounts.linkInvestments}>
              {linking ? 'Linking…' : 'Link investments'}
            </Button>
          </View>

          {showForm ? (
            <Card>
              <View style={{ gap: gap.md }}>
                <Input
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  testID={AgentUiIds.finance.accounts.name}
                />
                <Input
                  label="Last 4"
                  value={last4}
                  onChangeText={setLast4}
                  keyboardType="number-pad"
                  testID={AgentUiIds.finance.accounts.last4}
                />
                <Input
                  label="APR %"
                  value={apr}
                  onChangeText={setApr}
                  keyboardType="decimal-pad"
                  testID={AgentUiIds.finance.accounts.apr}
                />
                <Input
                  label="Balance"
                  value={balanceText}
                  onChangeText={setBalanceText}
                  keyboardType="decimal-pad"
                  testID={AgentUiIds.finance.accounts.balance}
                />
                <ChipRow
                  options={FINANCE_ACCOUNT_KINDS.map((k) => ({
                    value: k,
                    label: FINANCE_ACCOUNT_KIND_LABEL[k],
                  }))}
                  selected={kind}
                  onSelect={setKind}
                />
                {error ? (
                  <AppText variant="caption" color="danger">
                    {error}
                  </AppText>
                ) : null}
                <Button onPress={saveManual} testID={AgentUiIds.finance.accounts.save}>
                  Save account
                </Button>
              </View>
            </Card>
          ) : null}

          {accounts.length ? (
            accounts.map((account) => {
              const holdingCount = holdings.filter((h) => h.accountId === account.id).length;
              return (
                <Card key={account.id} testID={AgentUiIds.finance.accounts.row(account.id)}>
                  <View style={{ gap: gap.sm }}>
                    <AppText variant="callout" fit>
                      {account.name}
                      {account.last4 ? ` ····${account.last4}` : ''}
                    </AppText>
                    <AppText variant="caption" color="secondary" fit>
                      {FINANCE_ACCOUNT_KIND_LABEL[account.kind]} · {account.linkStatus}
                      {account.aprPercent != null ? ` · ${account.aprPercent}% APR` : ''}
                      {account.balance != null
                        ? ` · ${formatMoney(account.balance, account.currency)}`
                        : ''}
                      {holdingCount ? ` · ${holdingCount} holdings` : ''}
                      {account.plaidInstitutionName
                        ? ` · ${account.plaidInstitutionName}`
                        : ''}
                    </AppText>
                    <View style={{ flexDirection: 'row', gap: gap.sm, flexWrap: 'wrap' }}>
                      {account.linkStatus === 'linked' && account.plaidItemId ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={syncingId === account.id}
                          onPress={() => void syncAccount(account)}
                          testID={AgentUiIds.finance.accounts.sync(account.id)}>
                          {syncingId === account.id ? 'Syncing…' : 'Sync'}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => void disconnect(account)}>
                        {account.linkStatus === 'linked' ? 'Disconnect' : 'Delete'}
                      </Button>
                    </View>
                  </View>
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon="finance"
              title="No accounts"
              message="Add a card or investment manually, or link a bank or brokerage when Plaid is configured."
            />
          )}
        </View>
      </AgentTestId>

      <FinancePlaidLinkSheet
        visible={linkOpen}
        linkToken={linkToken}
        onClose={() => {
          setLinkOpen(false);
          setLinkToken(undefined);
        }}
        onSuccess={(publicToken) => {
          void finishPublicToken(publicToken, linkPurpose);
        }}
      />
    </Screen>
  );
}
