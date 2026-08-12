import { newUuid } from '@/utils/id';

import type {
  FinanceAccount,
  FinanceBillKind,
  FinanceBucket,
  FinanceDocument,
  FinanceEntity,
  FinanceHolding,
  FinanceRecurringBill,
  FinanceTaxYear,
  FinanceTransaction,
} from './types';

function isoNow(): string {
  return new Date().toISOString();
}

export function personalEntityId(entities: FinanceEntity[]): string {
  return entities.find((entity) => entity.kind === 'personal')?.id ?? entities[0]?.id ?? '';
}

export function createFinanceEntity(input: {
  id?: string;
  kind: FinanceEntity['kind'];
  name: string;
  notes?: string;
}): FinanceEntity {
  const now = isoNow();
  return {
    id: input.id ?? newUuid(),
    kind: input.kind,
    name: input.name.trim() || 'Untitled',
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultPersonalEntity(): FinanceEntity {
  return createFinanceEntity({ kind: 'personal', name: 'Personal' });
}

export function createFinanceTransaction(input: {
  id?: string;
  amount: number;
  currency?: string;
  date: string;
  merchant: string;
  categoryId: string;
  entityId: string;
  accountId?: string;
  notes?: string;
  receiptUri?: string;
  source?: FinanceTransaction['source'];
  externalId?: string;
}): FinanceTransaction {
  const now = isoNow();
  return {
    id: input.id ?? newUuid(),
    amount: input.amount,
    currency: input.currency ?? 'USD',
    date: input.date,
    merchant: input.merchant.trim() || 'Expense',
    categoryId: input.categoryId,
    entityId: input.entityId,
    accountId: input.accountId,
    notes: input.notes,
    receiptUri: input.receiptUri,
    source: input.source ?? 'manual',
    externalId: input.externalId,
    createdAt: now,
    updatedAt: now,
  };
}

export function createFinanceAccount(
  input: Omit<FinanceAccount, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  },
): FinanceAccount {
  const now = isoNow();
  return {
    ...input,
    id: input.id ?? newUuid(),
    name: input.name.trim() || 'Account',
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function createFinanceHolding(
  input: Omit<FinanceHolding, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
): FinanceHolding {
  const now = isoNow();
  return {
    ...input,
    id: input.id ?? newUuid(),
    createdAt: now,
    updatedAt: now,
  };
}

const BILL_KIND_CATEGORY: Record<FinanceBillKind, string> = {
  subscription: 'subscription',
  tax: 'property_tax',
  insurance: 'insurance',
  loan: 'car_payment',
  bill: 'other',
  other: 'other',
};

export function createFinanceBill(input: {
  id?: string;
  name: string;
  amount: number;
  currency: string;
  cadence: FinanceRecurringBill['cadence'];
  nextDue: string;
  entityId: string;
  kind: FinanceBillKind;
  categoryId?: string;
  accountId?: string;
  aprPercent?: number;
  notes?: string;
}): FinanceRecurringBill {
  const now = isoNow();
  return {
    id: input.id ?? newUuid(),
    name: input.name.trim() || 'Bill',
    amount: input.amount,
    currency: input.currency,
    cadence: input.cadence,
    nextDue: input.nextDue,
    categoryId: input.categoryId ?? BILL_KIND_CATEGORY[input.kind],
    entityId: input.entityId,
    kind: input.kind,
    accountId: input.accountId,
    aprPercent: input.aprPercent,
    notes: input.notes,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function createFinanceBucket(input: {
  id?: string;
  name: string;
  goalAmount: number;
  currency: string;
  targetDate?: string;
  entityId?: string;
  notes?: string;
}): FinanceBucket {
  const now = isoNow();
  return {
    id: input.id ?? newUuid(),
    name: input.name.trim() || 'Bucket',
    goalAmount: input.goalAmount,
    currency: input.currency,
    targetDate: input.targetDate,
    entityId: input.entityId,
    notes: input.notes,
    contributions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createFinanceTaxYear(input: {
  id?: string;
  year: number;
  entityIds: string[];
}): FinanceTaxYear {
  const now = isoNow();
  return {
    id: input.id ?? newUuid(),
    year: input.year,
    entityIds: input.entityIds,
    checklist: {},
    documentIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createFinanceDocument(input: {
  id?: string;
  taxYearId: string;
  kind: FinanceDocument['kind'];
  name: string;
  uri: string;
}): FinanceDocument {
  return {
    id: input.id ?? newUuid(),
    taxYearId: input.taxYearId,
    kind: input.kind,
    name: input.name.trim() || 'Document',
    uri: input.uri,
    createdAt: isoNow(),
  };
}
