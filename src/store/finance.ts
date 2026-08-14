import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  createDefaultPersonalEntity,
  createFinanceEntity,
  createFinanceTransaction,
} from '@/features/finance/create';
import { advanceBillDue } from '@/features/finance/model';
import {
  normalizeFinanceSnapshot,
  privateFinancePayload,
} from '@/features/finance/normalize';
import type {
  FinanceAccount,
  FinanceBucket,
  FinanceBucketContribution,
  FinanceCreditScoreEntry,
  FinanceDocument,
  FinanceEntity,
  FinanceHolding,
  FinanceRecurringBill,
  FinanceStateSnapshot,
  FinanceTaxYear,
  FinanceTransaction,
} from '@/features/finance/types';
import { FINANCE_CREDIT_HISTORY_CAP } from '@/features/finance/types';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { todayKey } from '@/utils/date';
import { newUuid } from '@/utils/id';

export {
  createFinanceEntity,
  createFinanceTransaction,
  privateFinancePayload,
};

type FinanceState = FinanceStateSnapshot & {
  saveEntity: (entity: FinanceEntity) => void;
  removeEntity: (id: string) => void;
  saveAccount: (account: FinanceAccount) => void;
  removeAccount: (id: string) => void;
  removeConnection: (provider: 'plaid' | 'teller', connectionId: string) => void;
  removePlaidItem: (itemId: string) => void;
  saveHolding: (holding: FinanceHolding) => void;
  removeHolding: (id: string) => void;
  upsertHoldings: (holdings: FinanceHolding[]) => void;
  replacePlaidHoldings: (accountIds: string[], holdings: FinanceHolding[]) => void;
  saveTransaction: (transaction: FinanceTransaction) => void;
  removeTransaction: (id: string) => void;
  upsertPlaidTransactions: (transactions: FinanceTransaction[]) => void;
  reconcilePlaidTransactions: (
    transactions: FinanceTransaction[],
    removedExternalIds: string[],
  ) => void;
  reconcileLinkedTransactions: (
    provider: 'plaid' | 'teller',
    accountIds: string[],
    transactions: FinanceTransaction[],
    refreshedFrom?: string,
  ) => void;
  saveBill: (bill: FinanceRecurringBill) => void;
  removeBill: (id: string) => void;
  markBillPaid: (id: string, paidOn?: string) => void;
  saveBucket: (bucket: FinanceBucket) => void;
  removeBucket: (id: string) => void;
  addBucketContribution: (
    bucketId: string,
    contribution: Omit<FinanceBucketContribution, 'id'> & { id?: string },
  ) => void;
  saveTaxYear: (taxYear: FinanceTaxYear) => void;
  removeTaxYear: (id: string) => void;
  saveDocument: (document: FinanceDocument) => void;
  removeDocument: (id: string) => void;
  setCreditScore: (entry: FinanceCreditScoreEntry) => void;
  clearCreditScore: () => void;
  setCustomHandoffUrl: (url: string | undefined) => void;
  setReferenceSavingsApr: (apr: number | undefined) => void;
  replaceFinanceData: (snapshot: FinanceStateSnapshot) => void;
  reset: () => void;
};

function touchUpdatedAt(): string {
  return new Date().toISOString();
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((row) => row.id === item.id);
  if (index < 0) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

const emptySnapshot = (): FinanceStateSnapshot => {
  const personal = createDefaultPersonalEntity();
  return {
    entities: [personal],
    accounts: [],
    holdings: [],
    transactions: [],
    bills: [],
    buckets: [],
    taxYears: [],
    documents: [],
    baseCurrency: 'USD',
    updatedAt: touchUpdatedAt(),
  };
};

export const useFinance = create<FinanceState>()(
  persist(
    (set, get) => ({
      ...emptySnapshot(),
      saveEntity: (entity) => {
        const now = touchUpdatedAt();
        set({
          entities: upsertById(get().entities, { ...entity, updatedAt: now }),
          updatedAt: now,
        });
      },
      removeEntity: (id) => {
        const entities = get().entities.filter((e) => e.id !== id);
        const ensured = entities.some((e) => e.kind === 'personal')
          ? entities
          : [createDefaultPersonalEntity(), ...entities];
        set({ entities: ensured, updatedAt: touchUpdatedAt() });
      },
      saveAccount: (account) => {
        const now = touchUpdatedAt();
        set({
          accounts: upsertById(get().accounts, { ...account, updatedAt: now }),
          updatedAt: now,
        });
      },
      removeAccount: (id) =>
        set({
          accounts: get().accounts.filter((a) => a.id !== id),
          holdings: get().holdings.filter((h) => h.accountId !== id),
          updatedAt: touchUpdatedAt(),
        }),
      removeConnection: (provider, connectionId) => {
        const accountIds = new Set(
          get().accounts
            .filter((account) =>
              account.provider === provider && account.connectionId === connectionId,
            )
            .map((account) => account.id),
        );
        const now = touchUpdatedAt();
        set({
          accounts: get().accounts.filter((account) => !accountIds.has(account.id)),
          holdings: get().holdings.filter((holding) => !accountIds.has(holding.accountId)),
          transactions: get().transactions.flatMap((transaction) => {
            if (!transaction.accountId || !accountIds.has(transaction.accountId)) return [transaction];
            if (transaction.source === provider) return [];
            return [{ ...transaction, accountId: undefined, updatedAt: now }];
          }),
          updatedAt: now,
        });
      },
      removePlaidItem: (itemId) => {
        const normalized = get().accounts.find(
          (account) => account.provider === 'plaid' && account.connectionId === itemId,
        );
        if (normalized) {
          get().removeConnection('plaid', itemId);
          return;
        }
        const accountIds = new Set(
          get().accounts.filter((account) => account.plaidItemId === itemId).map((account) => account.id),
        );
        set({
          accounts: get().accounts.filter((account) => account.plaidItemId !== itemId),
          holdings: get().holdings.filter((holding) => !accountIds.has(holding.accountId)),
          transactions: get().transactions.flatMap((transaction) => {
            if (!transaction.accountId || !accountIds.has(transaction.accountId)) return [transaction];
            if (transaction.source === 'plaid') return [];
            return [{ ...transaction, accountId: undefined, updatedAt: touchUpdatedAt() }];
          }),
          updatedAt: touchUpdatedAt(),
        });
      },
      saveHolding: (holding) => {
        const now = touchUpdatedAt();
        set({
          holdings: upsertById(get().holdings, { ...holding, updatedAt: now }),
          updatedAt: now,
        });
      },
      removeHolding: (id) =>
        set({
          holdings: get().holdings.filter((h) => h.id !== id),
          updatedAt: touchUpdatedAt(),
        }),
      upsertHoldings: (incoming) => {
        const now = touchUpdatedAt();
        const byExternal = new Map(
          get()
            .holdings.filter((h) => h.externalId)
            .map((h) => [h.externalId!, h]),
        );
        let next = [...get().holdings];
        for (const holding of incoming) {
          if (holding.externalId && byExternal.has(holding.externalId)) {
            const existing = byExternal.get(holding.externalId)!;
            next = upsertById(next, {
              ...existing,
              ...holding,
              id: existing.id,
              updatedAt: now,
            });
          } else {
            next = upsertById(next, { ...holding, updatedAt: now });
          }
        }
        set({ holdings: next, updatedAt: now });
      },
      replacePlaidHoldings: (accountIds, incoming) => {
        const now = touchUpdatedAt();
        const scopedAccountIds = new Set(accountIds);
        const existingByExternal = new Map(
          get()
            .holdings.filter((holding) => holding.externalId)
            .map((holding) => [holding.externalId!, holding]),
        );
        const retained = get().holdings.filter(
          (holding) => !scopedAccountIds.has(holding.accountId),
        );
        const replaced = incoming.map((holding) => {
          const existing = holding.externalId
            ? existingByExternal.get(holding.externalId)
            : undefined;
          return {
            ...existing,
            ...holding,
            id: existing?.id ?? holding.id,
            createdAt: existing?.createdAt ?? holding.createdAt,
            updatedAt: now,
          };
        });
        set({ holdings: [...retained, ...replaced], updatedAt: now });
      },
      saveTransaction: (transaction) => {
        const now = touchUpdatedAt();
        set({
          transactions: upsertById(get().transactions, {
            ...transaction,
            updatedAt: now,
          }),
          updatedAt: now,
        });
      },
      removeTransaction: (id) =>
        set({
          transactions: get().transactions.filter((t) => t.id !== id),
          updatedAt: touchUpdatedAt(),
        }),
      upsertPlaidTransactions: (incoming) => {
        const byExternal = new Map(
          get()
            .transactions.filter((t) => t.source === 'plaid' && t.externalId)
            .map((t) => [t.externalId!, t]),
        );
        let next = [...get().transactions];
        for (const txn of incoming) {
          if (txn.externalId && byExternal.has(txn.externalId)) {
            const existing = byExternal.get(txn.externalId)!;
            next = upsertById(next, { ...existing, ...txn, id: existing.id });
          } else {
            next = upsertById(next, txn);
          }
        }
        set({ transactions: next, updatedAt: touchUpdatedAt() });
      },
      reconcilePlaidTransactions: (incoming, removedExternalIds) => {
        const now = touchUpdatedAt();
        const removed = new Set(removedExternalIds);
        let next = get().transactions.filter(
          (transaction) =>
            transaction.source !== 'plaid' ||
            !transaction.externalId ||
            !removed.has(transaction.externalId),
        );
        const byExternal = new Map(
          next
            .filter((transaction) => transaction.source === 'plaid' && transaction.externalId)
            .map((transaction) => [transaction.externalId!, transaction]),
        );
        for (const transaction of incoming) {
          const existing = transaction.externalId
            ? byExternal.get(transaction.externalId)
            : undefined;
          next = upsertById(next, {
            ...existing,
            ...transaction,
            id: existing?.id ?? transaction.id,
            createdAt: existing?.createdAt ?? transaction.createdAt,
            updatedAt: now,
          });
        }
        set({ transactions: next, updatedAt: now });
      },
      reconcileLinkedTransactions: (provider, accountIds, incoming, refreshedFrom) => {
        const now = touchUpdatedAt();
        const scopedAccountIds = new Set(accountIds);
        const incomingExternalIds = new Set(
          incoming.flatMap((transaction) =>
            transaction.externalId ? [transaction.externalId] : [],
          ),
        );
        let next = get().transactions.filter((transaction) => {
          if (transaction.source !== provider || !transaction.accountId) return true;
          if (!scopedAccountIds.has(transaction.accountId)) return true;
          if (refreshedFrom && transaction.date < refreshedFrom) return true;
          return Boolean(
            transaction.externalId && incomingExternalIds.has(transaction.externalId),
          );
        });
        const byExternal = new Map(
          next
            .filter((transaction) => transaction.source === provider && transaction.externalId)
            .map((transaction) => [transaction.externalId!, transaction]),
        );
        for (const transaction of incoming) {
          const existing = transaction.externalId
            ? byExternal.get(transaction.externalId)
            : undefined;
          next = upsertById(next, {
            ...existing,
            ...transaction,
            id: existing?.id ?? transaction.id,
            createdAt: existing?.createdAt ?? transaction.createdAt,
            updatedAt: now,
          });
        }
        set({ transactions: next, updatedAt: now });
      },
      saveBill: (bill) => {
        const now = touchUpdatedAt();
        set({
          bills: upsertById(get().bills, { ...bill, updatedAt: now }),
          updatedAt: now,
        });
      },
      removeBill: (id) =>
        set({
          bills: get().bills.filter((b) => b.id !== id),
          updatedAt: touchUpdatedAt(),
        }),
      markBillPaid: (id, paidOn) => {
        const bill = get().bills.find((b) => b.id === id);
        if (!bill) return;
        const paid = paidOn ?? todayKey();
        const now = touchUpdatedAt();
        const nextDue =
          bill.cadence === 'once'
            ? bill.nextDue
            : advanceBillDue(bill.cadence, bill.nextDue > paid ? bill.nextDue : paid);
        set({
          bills: upsertById(get().bills, {
            ...bill,
            lastPaidAt: paid,
            nextDue,
            active: bill.cadence === 'once' ? false : bill.active,
            updatedAt: now,
          }),
          updatedAt: now,
        });
      },
      saveBucket: (bucket) => {
        const now = touchUpdatedAt();
        set({
          buckets: upsertById(get().buckets, { ...bucket, updatedAt: now }),
          updatedAt: now,
        });
      },
      removeBucket: (id) =>
        set({
          buckets: get().buckets.filter((b) => b.id !== id),
          updatedAt: touchUpdatedAt(),
        }),
      addBucketContribution: (bucketId, contribution) => {
        const bucket = get().buckets.find((b) => b.id === bucketId);
        if (!bucket) return;
        const now = touchUpdatedAt();
        const row: FinanceBucketContribution = {
          id: contribution.id ?? newUuid(),
          amount: contribution.amount,
          date: contribution.date,
          notes: contribution.notes,
        };
        set({
          buckets: upsertById(get().buckets, {
            ...bucket,
            contributions: [...bucket.contributions, row],
            updatedAt: now,
          }),
          updatedAt: now,
        });
      },
      saveTaxYear: (taxYear) => {
        const now = touchUpdatedAt();
        set({
          taxYears: upsertById(get().taxYears, { ...taxYear, updatedAt: now }),
          updatedAt: now,
        });
      },
      removeTaxYear: (id) =>
        set({
          taxYears: get().taxYears.filter((t) => t.id !== id),
          documents: get().documents.filter((d) => d.taxYearId !== id),
          updatedAt: touchUpdatedAt(),
        }),
      saveDocument: (document) =>
        set({
          documents: upsertById(get().documents, document),
          updatedAt: touchUpdatedAt(),
        }),
      removeDocument: (id) =>
        set({
          documents: get().documents.filter((d) => d.id !== id),
          taxYears: get().taxYears.map((year) => ({
            ...year,
            documentIds: year.documentIds.filter((docId) => docId !== id),
          })),
          updatedAt: touchUpdatedAt(),
        }),
      setCreditScore: (entry) => {
        const prev = get().creditScore;
        const history = [
          entry,
          ...(prev?.history ?? []).filter(
            (row) => !(row.asOf === entry.asOf && row.bureau === entry.bureau),
          ),
        ].slice(0, FINANCE_CREDIT_HISTORY_CAP);
        set({
          creditScore: { current: entry, history },
          updatedAt: touchUpdatedAt(),
        });
      },
      clearCreditScore: () =>
        set({
          creditScore: undefined,
          updatedAt: touchUpdatedAt(),
        }),
      setCustomHandoffUrl: (url) =>
        set({
          customHandoffUrl: url?.trim() || undefined,
          updatedAt: touchUpdatedAt(),
        }),
      setReferenceSavingsApr: (apr) =>
        set({
          referenceSavingsApr:
            typeof apr === 'number' && Number.isFinite(apr) && apr >= 0 ? apr : undefined,
          updatedAt: touchUpdatedAt(),
        }),
      replaceFinanceData: (snapshot) => set({ ...normalizeFinanceSnapshot(snapshot) }),
      reset: () => set(emptySnapshot()),
    }),
    {
      name: STORAGE_KEYS.finance,
      storage: createPersistStorage(),
      partialize: (state) => privateFinancePayload(state),
      merge: (persisted, current) => {
        const snapshot = normalizeFinanceSnapshot(persisted);
        return { ...current, ...snapshot };
      },
    },
  ),
);
