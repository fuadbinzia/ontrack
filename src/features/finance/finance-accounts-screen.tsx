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
  createTellerLinkSession,
  createPlaidLinkToken,
  disconnectPlaidItem,
  disconnectTellerEnrollment,
  FinanceServiceError,
  finishTellerLink,
  openPlaidHostedLink,
  openTellerConnect,
  syncPlaidItem,
  syncTellerEnrollment,
} from '@/services/finance';
import { useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { todayKey } from '@/utils/date';
import { formatCount } from '@/utils/grammar';
import { parseFiniteNumber } from '@/utils/parse';

import { applyPlaidExchangeResult, applyPlaidSyncResult } from './apply-plaid-link';
import { applyTellerSyncResult } from './apply-teller-link';
import { createFinanceAccount, personalEntityId } from './create';
import { FinanceSubpageHeader } from './finance-subpage-header';
import {
  FINANCE_ACCOUNT_KIND_LABEL,
  FINANCE_ACCOUNT_KINDS,
  isFinanceInvestmentKind,
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
  const removeConnection = useFinance((s) => s.removeConnection);
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
  const [retiringPlaidBanks, setRetiringPlaidBanks] = useState(false);
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

  const startPlaidInvestmentLink = async () => {
    setLinking(true);
    try {
      const tokenResult = await createPlaidLinkToken('investments');
      if (!tokenResult.ok) {
        appPrompt.alert(
          'Investment linking unavailable',
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

  const startTellerBankLink = async () => {
    setLinking(true);
    try {
      const session = await createTellerLinkSession();
      if (!session.ok) {
        appPrompt.alert(
          'Bank linking unavailable',
          session.configured
            ? session.error
            : 'Teller is not configured for this build. Add accounts manually, or configure Teller on the API host.',
        );
        return;
      }
      await openTellerConnect(session);
      const synced = await finishTellerLink(session.sessionId);
      if (!synced.ok || !personalId) {
        appPrompt.alert('Link failed', synced.ok ? 'No personal entity found.' : synced.error);
        return;
      }
      applyTellerSyncResult(synced, personalId, baseCurrency);
      appPrompt.alert(
        'Bank linked',
        `Imported ${formatCount(synced.transactions.length, 'spending update')} with Teller.`,
      );
    } catch (linkError) {
      if (linkError instanceof FinanceServiceError && linkError.code === 'CANCELLED') return;
      appPrompt.alert(
        'Link failed',
        linkError instanceof Error ? linkError.message : 'Teller Connect did not finish.',
      );
    } finally {
      setLinking(false);
    }
  };

  const syncAccount = async (account: FinanceAccount) => {
    const provider = account.provider ?? (account.plaidItemId ? 'plaid' : undefined);
    const connectionId = account.connectionId ?? account.plaidItemId;
    if (!provider || !connectionId || !personalId) return;
    setSyncingId(connectionId);
    try {
      if (provider === 'teller') {
        const synced = await syncTellerEnrollment(connectionId);
        if (!synced.ok) {
          appPrompt.alert('Sync failed', synced.error);
          return;
        }
        applyTellerSyncResult(synced, personalId, baseCurrency);
        appPrompt.alert(
          'Synced',
          `Reconciled ${formatCount(synced.transactions.length, 'spending update')}.`,
        );
        return;
      }
      const synced = await syncPlaidItem(connectionId);
      if (!synced.ok) {
        appPrompt.alert('Sync failed', synced.error);
        return;
      }
      applyPlaidSyncResult(connectionId, synced, personalId, baseCurrency);
      const count = synced.purpose === 'investments'
        ? synced.holdings.length
        : synced.transactions.length;
      appPrompt.alert(
        synced.syncStatus === 'pending' ? 'Sync pending' : 'Synced',
        synced.syncStatus === 'pending'
          ? 'Plaid is still preparing this connection. Try Sync again shortly.'
          : `Reconciled ${formatCount(count, synced.purpose === 'investments' ? 'holding' : 'spending update')}.`,
      );
    } finally {
      setSyncingId(undefined);
    }
  };

  const disconnect = async (account: FinanceAccount) => {
    const provider = account.provider ?? (account.plaidItemId ? 'plaid' : undefined);
    const connectionId = account.connectionId ?? account.plaidItemId;
    if (!provider || !connectionId) {
      removeAccount(account.id);
      return;
    }
    try {
      if (provider === 'teller') {
        await disconnectTellerEnrollment(connectionId);
        removeConnection('teller', connectionId);
      } else {
        await disconnectPlaidItem(connectionId);
        removePlaidItem(connectionId);
      }
    } catch (disconnectError) {
      appPrompt.alert(
        'Disconnect failed',
        disconnectError instanceof Error
          ? disconnectError.message
          : `${provider === 'teller' ? 'Teller' : 'Plaid'} access could not be revoked.`,
      );
    }
  };

  const legacyPlaidBanks = accounts.filter((account) => {
    const provider = account.provider ?? (account.plaidItemId ? 'plaid' : undefined);
    return provider === 'plaid' && !isFinanceInvestmentKind(account.kind);
  });

  const retirePlaidBanks = async () => {
    setRetiringPlaidBanks(true);
    const connectionIds = [...new Set(legacyPlaidBanks.flatMap((account) => {
      const connectionId = account.connectionId ?? account.plaidItemId;
      return connectionId ? [connectionId] : [];
    }))];
    try {
      for (const connectionId of connectionIds) {
        await disconnectPlaidItem(connectionId);
        removePlaidItem(connectionId);
      }
      appPrompt.alert('Plaid banks removed', 'Reconnect your bank accounts with Teller.');
    } catch (retireError) {
      appPrompt.alert(
        'Migration incomplete',
        retireError instanceof Error
          ? retireError.message
          : 'A Plaid bank connection could not be revoked. Nothing unconfirmed was removed.',
      );
    } finally {
      setRetiringPlaidBanks(false);
    }
  };

  return (
    <Screen refresh={false}>
      <AgentTestId testID={AgentUiIds.finance.accounts.screen} label="Accounts">
        <View style={{ gap: gap.md }}>
          <FinanceSubpageHeader
            title="Cards & Accounts"
            subtitle="Track APR and balances with Teller, and investment holdings with Plaid."
          />

          {legacyPlaidBanks.length ? (
            <Card testID={AgentUiIds.finance.accounts.plaidMigration}>
              <View style={{ gap: gap.sm }}>
                <AppText variant="callout" fit>Move bank connections to Teller</AppText>
                <AppText variant="caption" color="secondary">
                  Plaid is now reserved for investments. Remove its bank data, then reconnect through Teller.
                </AppText>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={retiringPlaidBanks}
                  onPress={() => confirmDestructiveAction({
                    title: 'Remove Plaid bank connections?',
                    message: 'This revokes Plaid bank access and removes its imported accounts and spending. Investment connections stay linked.',
                    actionLabel: 'Remove bank links',
                    confirmTestID: AgentUiIds.finance.accounts.confirmPlaidMigration,
                    onConfirm: () => void retirePlaidBanks(),
                  })}
                  testID={AgentUiIds.finance.accounts.retirePlaidBanks}>
                  {retiringPlaidBanks ? 'Removing…' : 'Remove Plaid bank links'}
                </Button>
              </View>
            </Card>
          ) : null}

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
              onPress={() => void startTellerBankLink()}
              testID={AgentUiIds.finance.accounts.linkBank}>
              {linking ? 'Linking…' : 'Link bank with Teller'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={linking}
              onPress={() => void startPlaidInvestmentLink()}
              testID={AgentUiIds.finance.accounts.linkInvestments}>
              {linking ? 'Linking…' : 'Link investments with Plaid'}
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
                      {holdingCount ? ` · ${formatCount(holdingCount, 'holding')}` : ''}
                      {(account.institutionName ?? account.plaidInstitutionName)
                        ? ` · ${account.institutionName ?? account.plaidInstitutionName}`
                        : ''}
                      {account.provider ? ` · ${account.provider === 'teller' ? 'Teller' : 'Plaid'}` : ''}
                    </AppText>
                    <View style={{ flexDirection: 'row', gap: gap.sm, flexWrap: 'wrap' }}>
                      {account.linkStatus !== 'manual' && (account.connectionId || account.plaidItemId) ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={syncingId === (account.connectionId ?? account.plaidItemId)}
                          onPress={() => void syncAccount(account)}
                          testID={AgentUiIds.finance.accounts.sync(account.id)}>
                          {syncingId === (account.connectionId ?? account.plaidItemId) ? 'Syncing…' : 'Sync'}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          const connectionId = account.connectionId ?? account.plaidItemId;
                          if (connectionId) {
                            confirmDestructiveAction({
                              title: 'Disconnect this institution?',
                              message: `This revokes ${account.provider === 'teller' ? 'Teller' : 'Plaid'} access and removes every imported record from this connection.`,
                              actionLabel: 'Disconnect',
                              confirmTestID: AgentUiIds.finance.accounts.confirmDisconnect(connectionId),
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
                        {(account.connectionId || account.plaidItemId) ? 'Disconnect' : 'Delete'}
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
              message="Add an account manually, link banks with Teller, or link investments with Plaid."
            />
          )}
        </View>
      </AgentTestId>

    </Screen>
  );
}
