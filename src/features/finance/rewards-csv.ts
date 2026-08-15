import { createFinanceTransaction } from './create';
import type { FinanceTransaction } from './types';

export interface FinanceRewardsCsvMapping {
  date: string;
  merchant: string;
  amount: string;
  category?: string;
}

export interface FinanceRewardsCsvPreview {
  headers: string[];
  rows: Record<string, string>[];
}

export interface FinanceRewardsCsvImportResult {
  transactions: FinanceTransaction[];
  skippedRows: number;
  duplicateRows: number;
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n') {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function previewFinanceRewardsCsv(text: string): FinanceRewardsCsvPreview {
  const [headerRow = [], ...dataRows] = parseRows(text);
  const headers = headerRow.map((header, index) => header || `Column ${index + 1}`);
  return {
    headers,
    rows: dataRows.slice(0, 250).map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])),
    ),
  };
}

function dateKey(value: string): string | undefined {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return trimmed;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(trimmed);
  if (!us) return undefined;
  const year = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
  const month = Number(us[1]);
  const day = Number(us[2]);
  const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${candidate}T00:00:00Z`);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day
    ? candidate
    : undefined;
}

function amountValue(value: string): number | undefined {
  const normalized = value.replace(/[$,\s]/g, '').replace(/^\((.+)\)$/, '-$1');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount !== 0 ? amount : undefined;
}

function hash(value: string): string {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return (output >>> 0).toString(36);
}

export function importFinanceRewardsCsv(input: {
  preview: FinanceRewardsCsvPreview;
  mapping: FinanceRewardsCsvMapping;
  accountId: string;
  entityId: string;
  existingTransactions: FinanceTransaction[];
}): FinanceRewardsCsvImportResult {
  const existing = new Set(
    input.existingTransactions.flatMap((transaction) =>
      transaction.externalId?.startsWith('rewards-csv:') ? [transaction.externalId] : [],
    ),
  );
  const transactions: FinanceTransaction[] = [];
  let skippedRows = 0;
  let duplicateRows = 0;
  for (const row of input.preview.rows) {
    const date = dateKey(row[input.mapping.date] ?? '');
    const merchant = (row[input.mapping.merchant] ?? '').trim();
    const rawAmount = amountValue(row[input.mapping.amount] ?? '');
    if (!date || !merchant || rawAmount === undefined) {
      skippedRows += 1;
      continue;
    }
    const activity = rawAmount < 0 ? 'refund' : 'expense';
    const amount = Math.abs(rawAmount);
    const categoryHint = input.mapping.category
      ? (row[input.mapping.category] ?? '').trim()
      : undefined;
    const externalId = `rewards-csv:${hash([
      input.accountId,
      date,
      merchant.toLowerCase(),
      amount.toFixed(2),
      activity,
    ].join('|'))}`;
    if (existing.has(externalId)) {
      duplicateRows += 1;
      continue;
    }
    existing.add(externalId);
    transactions.push(createFinanceTransaction({
      amount,
      currency: 'USD',
      date,
      merchant,
      categoryId: 'other',
      entityId: input.entityId,
      accountId: input.accountId,
      source: 'import',
      activity,
      externalId,
      sourceCategory: categoryHint,
    }));
  }
  return { transactions, skippedRows, duplicateRows };
}

