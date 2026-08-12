import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  appPrompt,
  AppText,
  Button,
  Card,
  EmptyState,
  PanelTitle,
  Screen,
  SettingsToggleRow,
  fieldTitleCase,
} from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { useResponsive } from '@/hooks/use-responsive';
import { useFinance } from '@/store/finance';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import { createFinanceDocument, createFinanceTaxYear } from './create';
import { FinanceSubpageHeader } from './finance-subpage-header';
import { FinanceTaxHandoffSheet } from './finance-tax-handoff-sheet';
import {
  groupTransactionsByTaxBucket,
  taxChecklistKeys,
  taxChecklistLabel,
  taxYearReadiness,
} from './model';
import { pickAndPersistFinanceDocument } from './persist-finance-document';
import { shareTaxExportPackage } from './share-tax-package';
import { buildTaxExportPackage } from './tax-export';
import {
  FINANCE_DOCUMENT_KINDS,
  type FinanceDocumentKind,
  type FinanceTaxChecklistKey,
} from './types';

export function FinanceTaxScreen() {
  const { spacing: gap } = useResponsive();
  const taxYears = useFinance((s) => s.taxYears);
  const entities = useFinance((s) => s.entities);
  const transactions = useFinance((s) => s.transactions);
  const documents = useFinance((s) => s.documents);
  const saveTaxYear = useFinance((s) => s.saveTaxYear);
  const saveDocument = useFinance((s) => s.saveDocument);
  const removeDocument = useFinance((s) => s.removeDocument);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [docKind, setDocKind] = useState<FinanceDocumentKind>('w2');
  const [uploading, setUploading] = useState(false);

  const year = new Date().getFullYear();
  const taxYear = useMemo(
    () => taxYears.find((t) => t.year === year),
    [taxYears, year],
  );

  const yearDocs = useMemo(
    () => (taxYear ? documents.filter((d) => d.taxYearId === taxYear.id) : []),
    [documents, taxYear],
  );

  const ensureYear = () => {
    if (taxYear) return taxYear;
    const created = createFinanceTaxYear({
      year,
      entityIds: entities.map((e) => e.id),
    });
    saveTaxYear(created);
    return created;
  };

  const toggleChecklist = (key: FinanceTaxChecklistKey, value: boolean) => {
    if (!taxYear) return;
    saveTaxYear({
      ...taxYear,
      checklist: { ...taxYear.checklist, [key]: value },
    });
  };

  const toggleEntity = (entityId: string) => {
    const current = taxYear ?? ensureYear();
    const nextIds = current.entityIds.includes(entityId)
      ? current.entityIds.filter((id) => id !== entityId)
      : [...current.entityIds, entityId];
    saveTaxYear({
      ...current,
      entityIds: nextIds,
      checklist: {
        ...current.checklist,
        entities_scoped: nextIds.length > 0,
      },
    });
  };

  const uploadDoc = async () => {
    const current = taxYear ?? ensureYear();
    setUploading(true);
    try {
      const picked = await pickAndPersistFinanceDocument();
      if (!picked.ok) {
        if (!picked.cancelled && picked.error) {
          appPrompt.alert('Upload failed', picked.error);
        }
        return;
      }
      const doc = createFinanceDocument({
        taxYearId: current.id,
        kind: docKind,
        name: picked.name,
        uri: picked.uri,
      });
      saveDocument(doc);
      const incomeKinds: FinanceDocumentKind[] = ['w2', '1099', 'k1'];
      saveTaxYear({
        ...current,
        documentIds: [...current.documentIds, doc.id],
        checklist: {
          ...current.checklist,
          income_docs:
            current.checklist.income_docs || incomeKinds.includes(docKind),
          property_docs:
            current.checklist.property_docs || docKind === 'property',
        },
      });
    } finally {
      setUploading(false);
    }
  };

  const exportPackage = async () => {
    if (!taxYear) return;
    const pack = buildTaxExportPackage({
      taxYear,
      entities,
      transactions,
      documents,
    });
    try {
      await shareTaxExportPackage(pack);
      saveTaxYear({
        ...taxYear,
        checklist: { ...taxYear.checklist, export_ready: true },
      });
    } catch (error) {
      appPrompt.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Could not share package.',
      );
    }
  };

  const scopedTx = useMemo(() => {
    if (!taxYear) return [];
    const ids = new Set(
      taxYear.entityIds.length ? taxYear.entityIds : entities.map((e) => e.id),
    );
    return transactions.filter(
      (t) => ids.has(t.entityId) && t.date.startsWith(String(taxYear.year)),
    );
  }, [taxYear, entities, transactions]);

  const buckets = groupTransactionsByTaxBucket(scopedTx);

  return (
    <Screen refresh={false}>
      <AgentTestId testID={AgentUiIds.finance.tax.screen} label="Tax prep">
        <View style={{ gap: gap.md }}>
          <FinanceSubpageHeader
            title="Tax Prep"
            subtitle="Categorize expenses, collect docs, export a package, then file elsewhere (IRS, TurboTax, FreeTaxUSA, April, CPA, or other)."
          />

          {!taxYear ? (
            <EmptyState
              icon="finance"
              title={`Start ${year}`}
              message="Create this tax year to track checklist progress and exports."
              actionLabel="Create tax year"
              onAction={() => ensureYear()}
              actionTestID={AgentUiIds.finance.tax.ensureYear}
            />
          ) : (
            <>
              <Card>
                <AppText variant="callout" fit>
                  {taxYear.year} · {Math.round(taxYearReadiness(taxYear) * 100)}% ready
                </AppText>
                <AppText variant="caption" color="secondary">
                  {scopedTx.length} categorized expenses in scope
                </AppText>
              </Card>

              <Card>
                <PanelTitle>Entities in scope</PanelTitle>
                <View style={{ gap: gap.sm, marginTop: gap.sm }}>
                  {entities.map((entity) => (
                    <SettingsToggleRow
                      key={entity.id}
                      label={entity.name}
                      detail={entity.kind}
                      value={taxYear.entityIds.includes(entity.id)}
                      onValueChange={() => toggleEntity(entity.id)}
                      testID={AgentUiIds.finance.tax.entity(entity.id)}
                    />
                  ))}
                </View>
              </Card>

              <Card>
                <PanelTitle>Document vault</PanelTitle>
                <AppText variant="caption" color="secondary">
                  Upload W-2 / 1099 / K-1 / property docs for this year.
                </AppText>
                <View style={{ marginTop: gap.sm }}>
                  <ChipRow
                    options={FINANCE_DOCUMENT_KINDS.map((k) => ({ value: k, label: k }))}
                    selected={docKind}
                    onSelect={setDocKind}
                    scrollable
                  />
                </View>
                <Button
                  size="sm"
                  style={{ marginTop: gap.sm }}
                  disabled={uploading}
                  onPress={() => void uploadDoc()}
                  testID={AgentUiIds.finance.tax.uploadDoc}>
                  {uploading ? 'Uploading…' : 'Upload document'}
                </Button>
                <View style={{ gap: gap.xs, marginTop: gap.md }}>
                  {yearDocs.length ? (
                    yearDocs.map((doc) => (
                      <View
                        key={doc.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: gap.sm,
                        }}>
                        <AppText
                          variant="caption"
                          fit
                          style={{ flex: 1, minWidth: 0 }}>
                          {doc.kind} · {doc.name}
                        </AppText>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => removeDocument(doc.id)}>
                          Remove
                        </Button>
                      </View>
                    ))
                  ) : (
                    <AppText variant="caption" color="secondary">
                      No documents yet.
                    </AppText>
                  )}
                </View>
              </Card>

              <Card>
                <View style={{ gap: gap.sm }}>
                  {taxChecklistKeys().map((key) => (
                    <SettingsToggleRow
                      key={key}
                      label={taxChecklistLabel(key)}
                      detail={taxYear.checklist[key] ? 'Done' : 'Pending'}
                      value={!!taxYear.checklist[key]}
                      onValueChange={(value) => toggleChecklist(key, value)}
                      testID={AgentUiIds.finance.tax.checklist(key)}
                    />
                  ))}
                </View>
              </Card>

              {buckets.length ? (
                <Card>
                  <PanelTitle>By tax bucket</PanelTitle>
                  <View style={{ gap: gap.xs, marginTop: gap.sm }}>
                    {buckets.slice(0, 8).map((row) => (
                      <View
                        key={row.bucket}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}>
                        <AppText
                          variant="caption"
                          color="secondary"
                          fit
                          style={{ flex: 1, minWidth: 0 }}>
                          {fieldTitleCase(row.label)}
                        </AppText>
                        <AppText variant="caption" fit>
                          {row.amount.toFixed(2)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              <Button
                onPress={() => void exportPackage()}
                testID={AgentUiIds.finance.tax.export}>
                Export package
              </Button>
              <Button
                variant="secondary"
                onPress={() => setHandoffOpen(true)}
                testID={AgentUiIds.finance.tax.fileElsewhere}>
                File elsewhere
              </Button>
            </>
          )}
        </View>
      </AgentTestId>

      <FinanceTaxHandoffSheet
        visible={handoffOpen}
        taxYear={taxYear}
        onClose={() => setHandoffOpen(false)}
      />
    </Screen>
  );
}
