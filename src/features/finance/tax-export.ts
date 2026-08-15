import { financeCategoryById, taxBucketLabel } from './categories';
import {
  generalFinanceTransactions,
  groupTransactionsByTaxBucket,
  isSpendingTransaction,
} from './model';
import type {
  FinanceDocument,
  FinanceEntity,
  FinanceTaxYear,
  FinanceTransaction,
} from './types';

export interface FinanceTaxExportPackage {
  year: number;
  summaryText: string;
  csv: string;
  documentUris: { name: string; uri: string }[];
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildTaxExportPackage(input: {
  taxYear: FinanceTaxYear;
  entities: FinanceEntity[];
  transactions: FinanceTransaction[];
  documents: FinanceDocument[];
}): FinanceTaxExportPackage {
  const entityIds = new Set(
    input.taxYear.entityIds.length
      ? input.taxYear.entityIds
      : input.entities.map((e) => e.id),
  );
  const scoped = generalFinanceTransactions(input.transactions).filter(
    (t) =>
      entityIds.has(t.entityId) &&
      t.date.startsWith(String(input.taxYear.year)) &&
      isSpendingTransaction(t),
  );
  const entityName = (id: string) =>
    input.entities.find((e) => e.id === id)?.name ?? id;

  const header = [
    'date',
    'merchant',
    'amount',
    'currency',
    'category',
    'tax_bucket',
    'entity',
    'notes',
  ];
  const rows = scoped.map((t) => {
    const cat = financeCategoryById(t.categoryId);
    return [
      t.date,
      t.merchant,
      String(t.amount),
      t.currency,
      cat.label,
      taxBucketLabel(cat.taxBucket),
      entityName(t.entityId),
      t.notes ?? '',
    ]
      .map(csvEscape)
      .join(',');
  });
  const csv = [header.join(','), ...rows].join('\n');

  const buckets = groupTransactionsByTaxBucket(scoped);
  const total = scoped.reduce((sum, t) => sum + t.amount, 0);
  const summaryLines = [
    `onTrack tax prep export — ${input.taxYear.year}`,
    '',
    'This package prepares categorized expenses for filing elsewhere.',
    'onTrack does not e-file returns.',
    '',
    `Transactions: ${scoped.length}`,
    `Total categorized spend: ${total.toFixed(2)}`,
    '',
    'By tax bucket:',
    ...buckets.map((b) => `- ${b.label}: ${b.amount.toFixed(2)} (${b.count})`),
    '',
    'Entities in scope:',
    ...input.entities
      .filter((e) => entityIds.has(e.id))
      .map((e) => `- ${e.name} (${e.kind})`),
  ];

  const docs = input.documents
    .filter((d) => d.taxYearId === input.taxYear.id)
    .map((d) => ({ name: d.name, uri: d.uri }));

  return {
    year: input.taxYear.year,
    summaryText: summaryLines.join('\n'),
    csv,
    documentUris: docs,
  };
}
