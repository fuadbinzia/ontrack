import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Dropdown, ErrorMessage, SheetScaffold } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import {
  importFinanceRewardsCsv,
  previewFinanceRewardsCsv,
  type FinanceRewardsCsvMapping,
  type FinanceRewardsCsvPreview,
} from './rewards-csv';
import type { FinanceAccount, FinanceTransaction } from './types';

export function FinanceRewardsCsvSheet({
  visible,
  accounts,
  entityId,
  transactions,
  onClose,
  onImport,
}: {
  visible: boolean;
  accounts: FinanceAccount[];
  entityId: string;
  transactions: FinanceTransaction[];
  onClose: () => void;
  onImport: (transactions: FinanceTransaction[], message: string) => void;
}) {
  const { spacing } = useResponsive();
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<FinanceRewardsCsvPreview>();
  const [accountId, setAccountId] = useState('');
  const [mapping, setMapping] = useState<FinanceRewardsCsvMapping>({
    date: '', merchant: '', amount: '', category: undefined,
  });
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!visible) return;
    setFileName('');
    setPreview(undefined);
    setAccountId(accounts.find((account) => account.kind === 'card')?.id ?? '');
    setMapping({ date: '', merchant: '', amount: '', category: undefined });
    setError(undefined);
  }, [accounts, visible]);

  const options = useMemo(
    () => (preview?.headers ?? []).map((header) => ({ value: header, label: header })),
    [preview],
  );

  const chooseFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'application/csv', 'text/plain'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 5 * 1024 * 1024) {
      setError('Choose a CSV smaller than 5 MB.');
      return;
    }
    try {
      const next = previewFinanceRewardsCsv(await new File(asset.uri).text());
      if (!next.headers.length || !next.rows.length) throw new Error('No transaction rows found.');
      const find = (pattern: RegExp) => next.headers.find((header) => pattern.test(header)) ?? '';
      setFileName(asset.name || 'Statement.csv');
      setPreview(next);
      setMapping({
        date: find(/date/i),
        merchant: find(/merchant|description|name/i),
        amount: find(/amount|debit|charge/i),
        category: find(/category/i) || undefined,
      });
      setError(undefined);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Could not read this CSV.');
    }
  };

  const commit = () => {
    if (!preview || !accountId || !entityId || !mapping.date || !mapping.merchant || !mapping.amount) {
      setError('Choose a card and map the date, merchant, and amount columns.');
      return;
    }
    const result = importFinanceRewardsCsv({
      preview,
      mapping,
      accountId,
      entityId,
      existingTransactions: transactions,
    });
    if (!result.transactions.length) {
      setError(result.duplicateRows
        ? 'Every valid row is already in your ledger.'
        : 'No valid transaction rows were found.');
      return;
    }
    onImport(
      result.transactions,
      `Imported ${result.transactions.length}; skipped ${result.skippedRows}; duplicates ${result.duplicateRows}.`,
    );
  };

  return (
    <SheetScaffold
      visible={visible}
      eyebrow="Local Import"
      title="Import Statement CSV"
      subtitle="The statement is parsed on this device and never uploaded."
      onClose={onClose}
      closeTestID={AgentUiIds.finance.rewards.csvClose}
      backdropTestID={AgentUiIds.finance.rewards.csvBackdrop}
      footer={(
        <Button
          disabled={!preview}
          onPress={commit}
          testID={AgentUiIds.finance.rewards.csvImport}>
          Import Transactions
        </Button>
      )}>
      <AgentTestId testID={AgentUiIds.finance.rewards.csvSheet} label="Statement CSV Import">
        <View style={{ gap: spacing.md }}>
          <Button
            icon="upload"
            variant="secondary"
            onPress={() => void chooseFile()}
            testID={AgentUiIds.finance.rewards.csvChoose}>
            {fileName || 'Choose CSV'}
          </Button>
          {preview ? (
            <>
              <AppText variant="caption" color="secondary">
                Previewed {preview.rows.length} rows. Choose the matching columns.
              </AppText>
              <Dropdown
                label="Card Account"
                icon="finance"
                value={accountId}
                options={accounts.filter((account) => account.kind === 'card').map((account) => ({
                  value: account.id,
                  label: account.last4 ? `${account.name} ····${account.last4}` : account.name,
                }))}
                onChange={setAccountId}
                testID={AgentUiIds.finance.rewards.csvAccount}
              />
              <Dropdown
                label="Date Column"
                value={mapping.date}
                options={options}
                onChange={(date) => setMapping((current) => ({ ...current, date }))}
                testID={AgentUiIds.finance.rewards.csvDate}
              />
              <Dropdown
                label="Merchant Column"
                value={mapping.merchant}
                options={options}
                onChange={(merchant) => setMapping((current) => ({ ...current, merchant }))}
                testID={AgentUiIds.finance.rewards.csvMerchant}
              />
              <Dropdown
                label="Amount Column"
                value={mapping.amount}
                options={options}
                onChange={(amount) => setMapping((current) => ({ ...current, amount }))}
                testID={AgentUiIds.finance.rewards.csvAmount}
              />
              <Dropdown
                label="Category Column (Optional)"
                value={mapping.category ?? ''}
                options={[{ value: '', label: 'None' }, ...options]}
                onChange={(category) => setMapping((current) => ({
                  ...current,
                  category: category || undefined,
                }))}
                testID={AgentUiIds.finance.rewards.csvCategory}
              />
            </>
          ) : null}
          {error ? <ErrorMessage message={error} variant="caption" /> : null}
        </View>
      </AgentTestId>
    </SheetScaffold>
  );
}
