import { isDateKey } from '@/utils/date';
import { newUuid } from '@/utils/id';
import {
  asFiniteNumber,
  asOneOf,
  asString,
  asTrimmedString,
} from '@/utils/parse';

import { createDefaultPersonalEntity } from './create';
import type {
  FinanceAccount,
  FinanceBucket,
  FinanceBucketContribution,
  FinanceCreditScore,
  FinanceCreditScoreEntry,
  FinanceDocument,
  FinanceEntity,
  FinanceHolding,
  FinanceRecurringBill,
  FinanceStateSnapshot,
  FinanceTaxYear,
  FinanceTransaction,
} from './types';
import {
  FINANCE_ACCOUNT_KINDS,
  FINANCE_ACCOUNT_LINK_STATUSES,
  FINANCE_CONNECTION_PROVIDERS,
  FINANCE_BILL_CADENCES,
  FINANCE_BILL_KINDS,
  FINANCE_CREDIT_BUREAUS,
  FINANCE_CREDIT_HISTORY_CAP,
  FINANCE_CREDIT_MODELS,
  FINANCE_DOCUMENT_KINDS,
  FINANCE_ENTITY_KINDS,
  FINANCE_TRANSACTION_SOURCES,
} from './types';

export { createDefaultPersonalEntity };

function asRecord(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

function isoNow(): string {
  return new Date().toISOString();
}

function idOrNew(value: unknown): string {
  return asString(value) || newUuid();
}

function currencyCode(value: unknown, fallback = 'USD'): string {
  return (asString(value) ?? fallback).toUpperCase().slice(0, 3) || fallback;
}

function timestamps(o: Record<string, unknown>, now = isoNow()) {
  return {
    createdAt: asString(o.createdAt) || now,
    updatedAt: asString(o.updatedAt) || now,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string')
    : [];
}

function mapDefined<T>(value: unknown, map: (raw: unknown) => T | undefined): T[] {
  return Array.isArray(value)
    ? value.map(map).filter((row): row is T => !!row)
    : [];
}

function cleanHttpsOrFileUri(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  const trimmed = uri.trim();
  if (
    trimmed.startsWith('file:') ||
    trimmed.startsWith('content:') ||
    trimmed.startsWith('https:')
  ) {
    return trimmed;
  }
  return undefined;
}

export function normalizeEntity(raw: unknown): FinanceEntity | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const kind = asOneOf(o.kind, FINANCE_ENTITY_KINDS);
  if (!kind) return undefined;
  return {
    id: idOrNew(o.id),
    kind,
    name: asTrimmedString(o.name) || 'Untitled',
    notes: asTrimmedString(o.notes),
    ...timestamps(o),
  };
}

export function normalizeAccount(raw: unknown): FinanceAccount | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const last4 = (asString(o.last4) ?? '').replace(/\D/g, '').slice(-4) || undefined;
  const balanceAsOf = asString(o.balanceAsOf);
  const legacyPlaidItemId = asTrimmedString(o.plaidItemId);
  const legacyPlaidInstitutionName = asTrimmedString(o.plaidInstitutionName);
  const legacyPlaidAccountId = asTrimmedString(o.plaidAccountId);
  return {
    id: idOrNew(o.id),
    name: asTrimmedString(o.name) || 'Account',
    kind: asOneOf(o.kind, FINANCE_ACCOUNT_KINDS) ?? 'other',
    last4,
    aprPercent: asFiniteNumber(o.aprPercent),
    balance: asFiniteNumber(o.balance),
    balanceAsOf: balanceAsOf && isDateKey(balanceAsOf) ? balanceAsOf : undefined,
    currency: currencyCode(o.currency),
    linkStatus: asOneOf(o.linkStatus, FINANCE_ACCOUNT_LINK_STATUSES) ?? 'manual',
    provider:
      asOneOf(o.provider, FINANCE_CONNECTION_PROVIDERS) ??
      (legacyPlaidItemId ? 'plaid' : undefined),
    connectionId: asTrimmedString(o.connectionId) ?? legacyPlaidItemId,
    institutionName: asTrimmedString(o.institutionName) ?? legacyPlaidInstitutionName,
    externalAccountId: asTrimmedString(o.externalAccountId) ?? legacyPlaidAccountId,
    plaidItemId: legacyPlaidItemId,
    plaidInstitutionName: legacyPlaidInstitutionName,
    plaidAccountId: legacyPlaidAccountId,
    ...timestamps(o),
  };
}

export function normalizeHolding(raw: unknown): FinanceHolding | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const accountId = asString(o.accountId);
  const value = asFiniteNumber(o.value);
  const asOf = asString(o.asOf);
  if (!accountId || value === undefined || !asOf || !isDateKey(asOf)) return undefined;
  return {
    id: idOrNew(o.id),
    accountId,
    symbol: asTrimmedString(o.symbol),
    name: asTrimmedString(o.name) || 'Holding',
    quantity: asFiniteNumber(o.quantity),
    value,
    currency: currencyCode(o.currency),
    asOf,
    externalId: asTrimmedString(o.externalId),
    ...timestamps(o),
  };
}

function normalizeCreditEntry(raw: unknown): FinanceCreditScoreEntry | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const score = asFiniteNumber(o.score);
  if (score === undefined || score < 300 || score > 850) return undefined;
  const asOf = asString(o.asOf);
  if (!asOf || !isDateKey(asOf)) return undefined;
  return {
    score: Math.round(score),
    bureau: asOneOf(o.bureau, FINANCE_CREDIT_BUREAUS) ?? 'other',
    model: asOneOf(o.model, FINANCE_CREDIT_MODELS) ?? 'other',
    asOf,
    notes: asTrimmedString(o.notes),
    updatedAt: asString(o.updatedAt) || isoNow(),
  };
}

export function normalizeCreditScore(raw: unknown): FinanceCreditScore | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const current = normalizeCreditEntry(o.current);
  const history = mapDefined(o.history, normalizeCreditEntry).slice(
    0,
    FINANCE_CREDIT_HISTORY_CAP,
  );
  if (!current && !history.length) return undefined;
  return { current, history };
}

export function normalizeTransaction(raw: unknown): FinanceTransaction | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const amount = asFiniteNumber(o.amount);
  const date = asString(o.date);
  const entityId = asString(o.entityId);
  if (amount === undefined || !date || !isDateKey(date) || !entityId) return undefined;
  return {
    id: idOrNew(o.id),
    amount,
    currency: currencyCode(o.currency),
    date,
    merchant: asTrimmedString(o.merchant) || 'Expense',
    categoryId: asString(o.categoryId) || 'other',
    entityId,
    accountId: asTrimmedString(o.accountId),
    notes: asTrimmedString(o.notes),
    receiptUri: cleanHttpsOrFileUri(asString(o.receiptUri)),
    source: asOneOf(o.source, FINANCE_TRANSACTION_SOURCES) ?? 'manual',
    externalId: asTrimmedString(o.externalId),
    ...timestamps(o),
  };
}

export function normalizeBill(raw: unknown): FinanceRecurringBill | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const amount = asFiniteNumber(o.amount);
  const nextDue = asString(o.nextDue);
  const entityId = asString(o.entityId);
  if (amount === undefined || !nextDue || !isDateKey(nextDue) || !entityId) {
    return undefined;
  }
  return {
    id: idOrNew(o.id),
    name: asTrimmedString(o.name) || 'Bill',
    amount,
    currency: currencyCode(o.currency),
    cadence: asOneOf(o.cadence, FINANCE_BILL_CADENCES) ?? 'monthly',
    nextDue,
    categoryId: asString(o.categoryId) || 'other',
    entityId,
    kind: asOneOf(o.kind, FINANCE_BILL_KINDS) ?? 'bill',
    accountId: asTrimmedString(o.accountId),
    aprPercent: asFiniteNumber(o.aprPercent),
    notes: asTrimmedString(o.notes),
    active: typeof o.active === 'boolean' ? o.active : true,
    lastPaidAt: asTrimmedString(o.lastPaidAt),
    ...timestamps(o),
  };
}

function normalizeContribution(raw: unknown): FinanceBucketContribution | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const amount = asFiniteNumber(o.amount);
  const date = asString(o.date);
  if (amount === undefined || !date || !isDateKey(date)) return undefined;
  return {
    id: idOrNew(o.id),
    amount,
    date,
    notes: asTrimmedString(o.notes),
  };
}

export function normalizeBucket(raw: unknown): FinanceBucket | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const goalAmount = asFiniteNumber(o.goalAmount);
  if (goalAmount === undefined || goalAmount < 0) return undefined;
  const targetDate = asString(o.targetDate);
  return {
    id: idOrNew(o.id),
    name: asTrimmedString(o.name) || 'Bucket',
    goalAmount,
    currency: currencyCode(o.currency),
    targetDate: targetDate && isDateKey(targetDate) ? targetDate : undefined,
    entityId: asTrimmedString(o.entityId),
    notes: asTrimmedString(o.notes),
    contributions: mapDefined(o.contributions, normalizeContribution),
    ...timestamps(o),
  };
}

export function normalizeDocument(raw: unknown): FinanceDocument | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const uri = cleanHttpsOrFileUri(asString(o.uri));
  if (!uri) return undefined;
  return {
    id: idOrNew(o.id),
    taxYearId: asString(o.taxYearId) ?? '',
    kind: asOneOf(o.kind, FINANCE_DOCUMENT_KINDS) ?? 'other',
    name: asTrimmedString(o.name) || 'Document',
    uri,
    createdAt: asString(o.createdAt) || isoNow(),
  };
}

export function normalizeTaxYear(raw: unknown): FinanceTaxYear | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const year = asFiniteNumber(o.year);
  if (year === undefined || year < 2000 || year > 2100) return undefined;
  const checklist =
    o.checklist && typeof o.checklist === 'object' && !Array.isArray(o.checklist)
      ? (o.checklist as FinanceTaxYear['checklist'])
      : {};
  return {
    id: idOrNew(o.id),
    year: Math.floor(year),
    entityIds: stringList(o.entityIds),
    checklist,
    documentIds: stringList(o.documentIds),
    notes: asTrimmedString(o.notes),
    ...timestamps(o),
  };
}

export function normalizeFinanceSnapshot(raw: unknown): FinanceStateSnapshot {
  const o = asRecord(raw) ?? {};
  let entities = mapDefined(o.entities, normalizeEntity);
  if (!entities.some((entity) => entity.kind === 'personal')) {
    entities = [createDefaultPersonalEntity(), ...entities];
  }
  const referenceSavingsApr = asFiniteNumber(o.referenceSavingsApr);
  return {
    entities,
    accounts: mapDefined(o.accounts, normalizeAccount),
    holdings: mapDefined(o.holdings, normalizeHolding),
    transactions: mapDefined(o.transactions, normalizeTransaction),
    bills: mapDefined(o.bills, normalizeBill),
    buckets: mapDefined(o.buckets, normalizeBucket),
    taxYears: mapDefined(o.taxYears, normalizeTaxYear),
    documents: mapDefined(o.documents, normalizeDocument),
    creditScore: normalizeCreditScore(o.creditScore),
    customHandoffUrl: asTrimmedString(o.customHandoffUrl),
    referenceSavingsApr:
      referenceSavingsApr !== undefined && referenceSavingsApr >= 0
        ? referenceSavingsApr
        : undefined,
    baseCurrency: currencyCode(o.baseCurrency),
    updatedAt: asTrimmedString(o.updatedAt),
  };
}

/** Snapshot fields only — Plaid access tokens never live on the client document. */
export function privateFinancePayload(state: FinanceStateSnapshot): FinanceStateSnapshot {
  const {
    entities,
    accounts,
    holdings,
    transactions,
    bills,
    buckets,
    taxYears,
    documents,
    creditScore,
    customHandoffUrl,
    referenceSavingsApr,
    baseCurrency,
    updatedAt,
  } = state;
  return {
    entities,
    accounts,
    holdings,
    transactions,
    bills,
    buckets,
    taxYears,
    documents,
    creditScore,
    customHandoffUrl,
    referenceSavingsApr,
    baseCurrency,
    updatedAt,
  };
}
