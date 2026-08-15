import { useLocalSearchParams, useRouter } from 'expo-router';
import { clearSharedPayloads, getSharedPayloads } from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Dropdown,
  ErrorMessage,
  Screen,
  SettingsToggleRow,
  appPrompt,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { useResponsive } from '@/hooks/use-responsive';
import { requestEzPassAiParse } from '@/services/finance/ezpass';
import { useFinanceEzPassStatements } from '@/store/finance-ezpass-statements';
import { createFinanceTransaction, useFinance } from '@/store/finance';
import { usePreferences } from '@/store/preferences';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatDateKey } from '@/utils/date';

import { EZPASS_REPLENISHMENT_CATEGORY, FINANCE_CATEGORIES } from './categories';
import { personalEntityId } from './create';
import {
  ezPassAssetFromDocumentUrl,
  nextIncomingEzPassDocumentUri,
} from './ezpass-document-open';
import { displayEzPassMerchantName } from './ezpass-locations';
import { openEzPassNyAccount } from './ezpass-official-site';
import { ezPassAssetsFromSharedPayloads } from './ezpass-shared-statement';
import { ezPassImportSaveMode, formatEzPassActivityTime } from './ezpass-model';
import { persistEzPassStatementAssets } from './ezpass-statements';
import {
  ezPassAssetsAsDataUrls,
  parseEzPassAssets,
  pickEzPassDocument,
  pickEzPassScreenshots,
  type EzPassImportAsset,
} from './ezpass-import';
import {
  type EzPassActivityDraft,
} from './ezpass-parser';
import { deduplicateEzPassDraftsAgainstTransactions } from './ezpass-deduplication';
import { FinanceSubpageHeader } from './finance-subpage-header';
import { FinanceEzPassImportSourceCards } from './finance-ezpass-import-source-cards';

type ImportPhase = 'idle' | 'site' | 'reading' | 'review' | 'ai' | 'saving';

export function FinanceEzPassImportScreen() {
  const router = useRouter();
  const { source, uri } = useLocalSearchParams<{ source?: string; uri?: string }>();
  const { spacing: gap } = useResponsive();
  const entities = useFinance((state) => state.entities);
  const transactions = useFinance((state) => state.transactions);
  const baseCurrency = useFinance((state) => state.baseCurrency);
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const saveTransactions = useFinance((state) => state.saveTransactions);
  const saveStatement = useFinanceEzPassStatements((state) => state.saveStatement);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [assets, setAssets] = useState<EzPassImportAsset[]>([]);
  const [drafts, setDrafts] = useState<EzPassActivityDraft[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [entityId, setEntityId] = useState(personalEntityId(entities));
  const [categoryId, setCategoryId] = useState('transport');
  const [skippedRows, setSkippedRows] = useState(0);
  const [error, setError] = useState<string>();
  const sharedImportStarted = useRef(false);
  const documentImportStarted = useRef<string | undefined>(undefined);
  const aiEligible = assets.length > 0 && assets.every((asset) => {
    const extension = asset.name.split('.').pop()?.toLowerCase();
    return asset.mimeType?.startsWith('image/') || asset.mimeType === 'application/pdf' ||
      ['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(extension ?? '');
  });

  const deduplicated = useMemo(
    () => deduplicateEzPassDraftsAgainstTransactions(drafts, transactions),
    [drafts, transactions],
  );
  const timeBackfills = useMemo(() => {
    const existingByExternalId = new Map(
      transactions.flatMap((transaction) => transaction.externalId
        ? [[transaction.externalId, transaction] as const]
        : []),
    );
    return drafts.flatMap((draft) => {
      const existing = existingByExternalId.get(draft.fingerprint);
      return existing && draft.activityTime && !existing.activityTime
        ? [{ ...existing, activityTime: draft.activityTime }]
        : [];
    });
  }, [drafts, transactions]);
  const saveMode = ezPassImportSaveMode({
    uniqueCount: deduplicated.unique.length,
    timeBackfillCount: timeBackfills.length,
    parsedCount: drafts.length,
    exactDuplicateCount: deduplicated.exactDuplicates,
  });

  const applyParsedActivities = useCallback((
    activities: EzPassActivityDraft[],
    nextSkippedRows: number,
  ) => {
    const next = deduplicateEzPassDraftsAgainstTransactions(activities, transactions);
    setDrafts(activities);
    setSkippedRows(nextSkippedRows);
    setSelected(new Set(
      next.unique
        .filter((draft) => !next.probableDuplicateKeys.has(draft.probableDuplicateKey))
        .map((draft) => draft.fingerprint),
    ));
  }, [transactions]);

  const startImport = useCallback(async (
    picker: () => Promise<EzPassImportAsset[] | undefined>,
  ) => {
    setError(undefined);
    try {
      const picked = await picker();
      if (!picked?.length) return;
      setPhase('reading');
      setAssets(picked);
      const parsed = await parseEzPassAssets(picked);
      applyParsedActivities(parsed.activities, parsed.skippedRows);
      setPhase('review');
      if (!parsed.activities.length) {
        setError('No E-ZPass activity was recognized. You can try the optional AI fallback.');
      }
    } catch (importError) {
      setPhase('idle');
      setError(importError instanceof Error ? importError.message : 'The E-ZPass file could not be read.');
    }
  }, [applyParsedActivities]);

  useEffect(() => {
    if (source !== 'share' || sharedImportStarted.current) return;
    sharedImportStarted.current = true;
    try {
      const sharedAssets = ezPassAssetsFromSharedPayloads(getSharedPayloads());
      clearSharedPayloads();
      if (!sharedAssets.length) {
        setError('The shared file is not a supported E-ZPass statement.');
        return;
      }
      void startImport(async () => sharedAssets);
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : 'The shared E-ZPass statement could not be opened.',
      );
    }
  }, [source, startImport]);

  useEffect(() => {
    const nextUri = nextIncomingEzPassDocumentUri(source, uri, documentImportStarted.current);
    if (!nextUri) return;
    documentImportStarted.current = nextUri;
    const asset = ezPassAssetFromDocumentUrl(nextUri);
    if (!asset) {
      setError('The opened document is not a supported E-ZPass statement.');
      return;
    }
    void startImport(async () => [asset]);
  }, [source, startImport, uri]);

  const getStatementFromEzPass = async () => {
    setPhase('site');
    setError(undefined);
    try {
      const shouldChooseDownloadedFile = await openEzPassNyAccount();
      setPhase('idle');
      if (!shouldChooseDownloadedFile) return;
      await startImport(pickEzPassDocument);
    } catch (siteError) {
      setPhase('idle');
      setError(
        siteError instanceof Error
          ? siteError.message
          : 'The official E-ZPass NY site could not be opened.',
      );
    }
  };

  const runAiFallback = () => {
    if (!assets.length) return;
    appPrompt.alert(
      'Send statement to AI?',
      'The selected E-ZPass document or screenshots may contain financial and location history. They will be sent once for extraction, not retained by onTrack, and the resulting rows must be reviewed before import.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use AI Once',
          onPress: () => {
            void (async () => {
              setPhase('ai');
              setError(undefined);
              try {
                const parsed = await requestEzPassAiParse(await ezPassAssetsAsDataUrls(assets));
                applyParsedActivities(parsed, 0);
                setPhase('review');
                if (!parsed.length) setError('AI did not find any E-ZPass account activity.');
              } catch (aiError) {
                setPhase('review');
                setError(aiError instanceof Error ? aiError.message : 'AI parsing failed.');
              }
            })();
          },
        },
      ],
      { scrollableMessage: true },
    );
  };

  const toggle = (fingerprint: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fingerprint)) next.delete(fingerprint);
      else next.add(fingerprint);
      return next;
    });
  };

  const save = async () => {
    const chosen = deduplicated.unique.filter((draft) => selected.has(draft.fingerprint));
    if (!chosen.length && !timeBackfills.length && saveMode !== 'file') {
      setError('Select at least one activity to import.');
      return;
    }
    if (chosen.length && !entityId) {
      setError('Choose an entity for the imported activity.');
      return;
    }
    setPhase('saving');
    setError(undefined);
    try {
      const persistedUris = await persistEzPassStatementAssets(assets);
      if (!persistedUris.length) throw new Error('The selected statement could not be saved.');
      const statementName = assets.length === 1
        ? assets[0].name
        : `${assets.length} E-ZPass screenshots`;
      saveStatement({ name: statementName, uris: persistedUris });
      const imported = chosen.map((draft) => createFinanceTransaction({
        amount: draft.amount,
        currency: baseCurrency,
        date: draft.date,
        merchant: draft.merchant,
        categoryId:
          draft.activity === 'transfer' ? EZPASS_REPLENISHMENT_CATEGORY.id : categoryId,
        entityId,
        notes: draft.notes,
        source: 'ezpass',
        activity: draft.activity,
        activityTime: draft.activityTime,
        externalId: draft.fingerprint,
      }));
      saveTransactions([...timeBackfills, ...imported]);
      const added = chosen.length
        ? `${chosen.length} ${chosen.length === 1 ? 'transaction was' : 'transactions were'} added to Finance.`
        : '';
      const updated = timeBackfills.length
        ? `${timeBackfills.length} existing ${timeBackfills.length === 1 ? 'transaction was' : 'transactions were'} updated with statement times.`
        : '';
      const activitySummary = [added, updated].filter(Boolean).join(' ');
      appPrompt.alert(
        saveMode === 'file' ? 'E-ZPass File Saved' : 'E-ZPass Activity Imported',
        `${activitySummary ? `${activitySummary} ` : ''}The source file was saved on this device.`,
        [
          {
            text: 'Done',
            onPress: () => router.replace('/(tabs)/finance/ezpass'),
          },
        ],
      );
    } catch (saveError) {
      setPhase('review');
      setError(saveError instanceof Error ? saveError.message : 'The statement could not be saved.');
    }
  };

  const busy = phase === 'site' || phase === 'reading' || phase === 'ai' || phase === 'saving';
  return (
    <Screen refresh={false}>
      <AgentTestId testID={AgentUiIds.finance.ezpass.screen} label="E-ZPass import">
        <View style={{ gap: gap.md }}>
          <FinanceSubpageHeader
            title="Import E-ZPass"
            subtitle="Bring your toll activity into Finance in two quick steps."
          />

          <FinanceEzPassImportSourceCards
            busy={busy}
            openingOfficialSite={phase === 'site'}
            onOpenOfficialSite={() => void getStatementFromEzPass()}
            onPickDocument={() => void startImport(pickEzPassDocument)}
            onPickScreenshots={() => void startImport(pickEzPassScreenshots)}
          />

          {assets.length ? (
            <Card>
              <View style={{ gap: gap.sm }}>
                <AppText variant="callout" fit>{assets.length === 1 ? assets[0].name : `${assets.length} screenshots`}</AppText>
                <AppText variant="caption" color="secondary">
                  {deduplicated.unique.length} ready · {deduplicated.exactDuplicates} exact duplicates skipped
                  {timeBackfills.length ? ` · ${timeBackfills.length} existing ${timeBackfills.length === 1 ? 'time' : 'times'} ready` : ''}
                  {skippedRows ? ` · ${skippedRows} unrecognized rows` : ''}
                </AppText>
                {aiEligible ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onPress={runAiFallback}
                    testID={AgentUiIds.finance.ezpass.ai}>
                    {phase === 'ai' ? 'Analyzing…' : 'Try AI fallback'}
                  </Button>
                ) : null}
              </View>
            </Card>
          ) : null}

          {saveMode ? (
            <>
              <Button
                disabled={busy}
                loading={phase === 'saving'}
                onPress={() => void save()}
                testID={AgentUiIds.finance.ezpass.confirm}>
                {saveMode === 'import'
                  ? 'Import selected'
                  : saveMode === 'times'
                    ? 'Update times'
                    : 'Save uploaded file'}
              </Button>

              {error ? <ErrorMessage message={error} /> : null}

              {deduplicated.unique.length ? (
                <Card>
                  <View style={{ gap: gap.md }}>
                    <Dropdown
                      label="Entity"
                      value={entityId}
                      options={entities.map((entity) => ({ value: entity.id, label: `${entity.name} (${entity.kind})` }))}
                      onChange={setEntityId}
                    />
                    <AppText variant="overline" color="secondary" fit>Category</AppText>
                    <ChipRow
                      options={FINANCE_CATEGORIES.map((category) => ({ value: category.id, label: category.label }))}
                      selected={categoryId}
                      onSelect={setCategoryId}
                      scrollable
                      testIDForOption={(id) => AgentUiIds.finance.ezpass.category(id)}
                    />
                  </View>
                </Card>
              ) : null}

              {deduplicated.unique.map((draft) => {
                const probable = deduplicated.probableDuplicateKeys.has(draft.probableDuplicateKey);
                return (
                  <Card key={draft.fingerprint}>
                    <SettingsToggleRow
                      label={displayEzPassMerchantName(draft.merchant)}
                      detail={`${formatDateKey(draft.date, dateDisplayFormat)}${draft.activityTime ? ` · ${formatEzPassActivityTime(draft.activityTime)}` : ''} · ${formatMoney(draft.amount, baseCurrency)} · ${draft.kind}${probable ? ' · possible duplicate' : ''}${draft.confidence === 'review' ? ' · review' : ''}`}
                      value={selected.has(draft.fingerprint)}
                      onValueChange={() => toggle(draft.fingerprint)}
                      testID={AgentUiIds.finance.ezpass.row(draft.fingerprint)}
                      grouped
                    />
                  </Card>
                );
              })}
            </>
          ) : null}

          {error && !saveMode ? (
            <ErrorMessage message={error} />
          ) : null}
        </View>
      </AgentTestId>
    </Screen>
  );
}
