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
  completePlaidLink,
  createPlaidLinkToken,
  disconnectPlaidItem,
  FinanceServiceError,
  openPlaidHostedLink,
  syncPlaidItem,
  type PlaidLinkPurpose,
} from '@/services/finance';
import { useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { todayKey } from '@/utils/date';
import { parseFiniteNumber } from '@/utils/parse';

import { applyPlaidExchangeResult, applyPlaidSyncResult } from './apply-plaid-link';
import { createFinanceAccount, personalEntityId } from './create';
import { FinanceSubpageHeader } from './finance-subpage-header';
import {
  FINANCE_ACCOUNT_KIND_LABEL,
  FINANCE_ACCOUNT_KINDS,
  type FinanceAccount,
  type FinanceAccountKind,
} from './types';

function plaidLinkResultMessage(
  result: Extract<Awaited<ReturnType<typeof completePlaidLink>>, { ok: true }>,
): string {
  if (result.syncStatus === 'pending') {
    return 'The connection is ready. Plaid is still preparing the first data sync.';
  }
  if (result.syncStatus === 'error') {
    return `The connection is ready, but the first sync needs another try. ${result.syncError ?? ''}`.trim();
  }
  return result.purpose === 'investments'
    ? 'Holdings and balances were imported from Plaid.'
    : 'Recent spending was imported from Plaid.';
}

export function FinanceAccountsScreen() {
  const { spacing: gap } = useResponsive();
  const accounts = useFinance((s) => s.accounts);
  const holdings = useFinance((s) => s.holdings);
  const entities = useFinance((s) => s.entities);
  const baseCurrency = useFinance((s) => s.baseCurrency);
  const referenceSavingsApr = useFinance((s) => s.referenceSavingsApr);
  const saveAccount = useFinance((s) => s.saveAccount);
  const removeAccount = useFinance((s) => s.removeAccount);
  const removePlaidItem = useFinance((s) => s.removePlaidItem);
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

  const finishLink = async (linkToken: string) => {
    const exchanged = await completePlaidLink(linkToken);
    if (!exchanged.ok || !personalId) {
      appPrompt.alert(
        'Link failed',
        exchanged.ok ? 'No personal entity found.' : exchanged.error,
      );
      return;
    }
    applyPlaidExchangeResult(exchanged, personalId, baseCurrency);
    appPrompt.alert(
      exchanged.purpose === 'investments' ? 'Investments linked' : 'Accounts linked',
      plaidLinkResultMessage(exchanged),
    );
  };

  const startLink = async (purpose: PlaidLinkPurpose) => {
    setLinking(true);
    try {
      const tokenResult = await createPlaidLinkToken(purpose);
      if (!tokenResult.ok) {
        appPrompt.alert(
          purpose === 'investments' ? 'Investment linking unavailable' : 'Bank linking unavailable',
          tokenResult.configured
            ? tokenResult.error
            : 'Plaid is not configured for this build. Add accounts manually, or set PLAID_CLIENT_ID / PLAID_SECRET on the API host.',
        );
        return;
      }
      await openPlaidHostedLink(tokenResult);
      await finishLink(tokenResult.linkToken);
    } catch (linkError) {
      if (linkError instanceof FinanceServiceError && linkError.code === 'CANCELLED') return;
      appPrompt.alert(
        'Link failed',
        linkError instanceof Error ? linkError.message : 'Plaid Link did not finish.',
      );
    } finally {
      setLinking(false);
    }
  };

  const syncAccount = async (account: FinanceAccount) => {
    if (!account.plaidItemId || !personalId) return;
    setSyncingId(account.plaidItemId);
    try {
      const synced = await syncPlaidItem(account.plaidItemId);
      if (!synced.ok) {
        appPrompt.alert('Sync failed', synced.error);
        return;
      }
      applyPlaidSyncResult(account.plaidItemId, synced, personalId, baseCurrency);
      const count = synced.purpose === 'investments'
        ? synced.holdings.length
        : synced.transactions.length;
      appPrompt.alert(
        synced.syncStatus === 'pending' ? 'Sync pending' : 'Synced',
        synced.syncStatus === 'pending'
          ? 'Plaid is still preparing this connection. Try Sync again shortly.'
          : `Reconciled ${count} ${synced.purpose === 'investments' ? 'holdings' : 'spending updates'}.`,
      );
    } finally {
      setSyncingId(undefined);
    }
  };

  const disconnect = async (account: FinanceAccount) => {
    if (!account.plaidItemId) {
      removeAccount(account.id);
      return;
    }
    try {
      await disconnectPlaidItem(account.plaidItemId);
      removePlaidItem(account.plaidItemId);
    } catch (disconnectError) {
      appPrompt.alert(
        'Disconnect failed',
        disconnectError instanceof Error
          ? disconnectError.message
          : 'Plaid access could not be revoked.',
      );
    }
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
                      {account.linkStatus !== 'manual' && account.plaidItemId ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={syncingId === account.plaidItemId}
                          onPress={() => void syncAccount(account)}
                          testID={AgentUiIds.finance.accounts.sync(account.id)}>
                          {syncingId === account.plaidItemId ? 'Syncing…' : 'Sync'}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          if (account.plaidItemId) {
                            confirmDestructiveAction({
                              title: 'Disconnect this institution?',
                              message: 'This revokes Plaid access and removes every account, imported transaction, and holding from this connection.',
                              actionLabel: 'Disconnect',
                              confirmTestID: AgentUiIds.finance.accounts.confirmDisconnect(account.plaidItemId),
                              onConfirm: () => void disconnect(account),
                            });
                            return;
                          }
                          confirmDestructiveAction({
                            title: 'Delete this account?',
                            actionLabel: 'Delete',
                            confirmTestID: AgentUiIds.finance.accounts.confirmDisconnect(account.id),
                            onConfirm: () => void disconnect(account),
                          });
                        }}
                        testID={AgentUiIds.finance.accounts.disconnect(account.id)}>
                        {account.plaidItemId ? 'Disconnect' : 'Delete'}
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

    </Screen>
  );
}
