import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  createDefaultPersonalEntity,
  createFinanceBill,
  createFinanceEntity,
  createFinanceRewardProfile,
  createFinanceTransaction,
} from '@/features/finance/create';
import { deduplicateEzPassTransactions } from '@/features/finance/ezpass-deduplication';
import {
  categorizeFinanceMerchant,
  financeMerchantCategory,
  harmonizeFinanceMerchantCategories,
  saveFinanceTransactionForMerchant,
} from '@/features/finance/finance-merchant-category';
import { advanceBillDue } from '@/features/finance/model';
import {
  normalizeFinanceSnapshot,
  privateFinancePayload,
} from '@/features/finance/normalize';
import type {
  FinanceBucketContribution,
  FinanceStateSnapshot,
} from '@/features/finance/types';
import { FINANCE_CREDIT_HISTORY_CAP } from '@/features/finance/types';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { todayKey } from '@/utils/date';
import { newUuid } from '@/utils/id';

import type { FinanceState } from './finance-state';

export {
  createFinanceEntity,
  createFinanceRewardProfile,
  createFinanceTransaction,
  privateFinancePayload,
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
    subscriptionCandidates: [],
    dismissedSubscriptions: [],
    subscriptionDetectionStatus: 'idle',
    buckets: [],
    taxYears: [],
    documents: [],
    rewardProfiles: [],
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
          bills: get().bills.map((bill) =>
            (bill.accountId && accountIds.has(bill.accountId)) ||
            (bill.subscriptionLink?.provider === provider &&
              bill.subscriptionLink.connectionId === connectionId)
              ? {
                  ...bill,
                  accountId: undefined,
                  subscriptionLink: undefined,
                  updatedAt: now,
                }
              : bill,
          ),
          subscriptionCandidates: get().subscriptionCandidates.filter(
            (candidate) =>
              candidate.provider !== provider || candidate.connectionId !== connectionId,
          ),
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
          transactions: saveFinanceTransactionForMerchant(get().transactions, transaction, now),
          updatedAt: now,
        });
      },
      saveTransactions: (transactions) => {
        if (!transactions.length) return;
        const now = touchUpdatedAt();
        const next = [...get().transactions];
        const indexById = new Map(next.map((transaction, index) => [transaction.id, index]));
        for (const transaction of transactions) {
          const updated = { ...transaction, updatedAt: now };
          const index = indexById.get(transaction.id);
          if (index === undefined) {
            indexById.set(transaction.id, next.length);
            next.push(updated);
          } else {
            next[index] = updated;
          }
        }
        set({
          transactions: harmonizeFinanceMerchantCategories(deduplicateEzPassTransactions(next)),
          updatedAt: now,
        });
      },
      categorizeMerchantTransactions: (merchant, categoryId) => {
        const now = touchUpdatedAt();
        set({
          transactions: categorizeFinanceMerchant(get().transactions, merchant, categoryId, now),
          updatedAt: now,
        });
      },
      repairEzPassDuplicates: () => {
        const current = get().transactions;
        const repaired = deduplicateEzPassTransactions(current);
        if (repaired.length === current.length) return;
        set({ transactions: repaired, updatedAt: touchUpdatedAt() });
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
            next = upsertById(next, {
              ...existing,
              ...txn,
              id: existing.id,
              categoryId: existing.categoryId,
            });
          } else {
            next = upsertById(next, {
              ...txn,
              categoryId: financeMerchantCategory(next, txn.merchant) ?? txn.categoryId,
            });
          }
        }
        set({
          transactions: harmonizeFinanceMerchantCategories(next),
          updatedAt: touchUpdatedAt(),
        });
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
            categoryId: existing?.categoryId
              ?? financeMerchantCategory(next, transaction.merchant)
              ?? transaction.categoryId,
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
            categoryId: existing?.categoryId
              ?? financeMerchantCategory(next, transaction.merchant)
              ?? transaction.categoryId,
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
      reconcileSubscriptionCandidates: (source, connectionId, incoming) => {
        const now = touchUpdatedAt();
        const incomingById = new Map(incoming.map((candidate) => [candidate.id, candidate]));
        const bills = get().bills.map((bill) => {
          const linked = bill.subscriptionLink;
          if (!linked) return bill;
          const candidate = incomingById.get(linked.candidateId);
          if (!candidate) return bill;
          return {
            ...bill,
            amount: candidate.amount,
            currency: candidate.currency,
            cadence: candidate.cadence,
            nextDue: candidate.nextDue,
            accountId: candidate.accountId,
            active: candidate.active,
            subscriptionLink: {
              ...linked,
              connectionId: candidate.connectionId,
              externalStreamId: candidate.externalStreamId,
              materialFingerprint: candidate.materialFingerprint,
              lastSyncedAt: now,
            },
            updatedAt: now,
          };
        });
        const confirmedIds = new Set(
          bills.flatMap((bill) => bill.subscriptionLink?.candidateId ?? []),
        );
        const dismissedSubscriptions = get().dismissedSubscriptions.filter((dismissal) => {
          const candidate = incomingById.get(dismissal.candidateId);
          return !candidate || candidate.materialFingerprint === dismissal.materialFingerprint;
        });
        const dismissedKeys = new Set(
          dismissedSubscriptions.map(
            (dismissal) => `${dismissal.candidateId}|${dismissal.materialFingerprint}`,
          ),
        );
        const retained = get().subscriptionCandidates.filter((candidate) => {
          if (candidate.source !== source) return true;
          if (source === 'plaid' && candidate.connectionId !== connectionId) return true;
          return false;
        });
        const nextIncoming = incoming.filter(
          (candidate) =>
            candidate.active &&
            !confirmedIds.has(candidate.id) &&
            !dismissedKeys.has(`${candidate.id}|${candidate.materialFingerprint}`),
        );
        set({
          bills,
          subscriptionCandidates: [...retained, ...nextIncoming],
          dismissedSubscriptions,
          updatedAt: now,
        });
      },
      confirmSubscriptionCandidate: (id, kind) => {
        const candidate = get().subscriptionCandidates.find((row) => row.id === id);
        const entityId = get().entities.find((entity) => entity.kind === 'personal')?.id;
        if (!candidate || !entityId) return;
        const now = touchUpdatedAt();
        const bill = createFinanceBill({
          name: candidate.name,
          amount: candidate.amount,
          currency: candidate.currency,
          cadence: candidate.cadence,
          nextDue: candidate.nextDue,
          entityId,
          kind: kind ?? candidate.suggestedKind,
          accountId: candidate.accountId,
        });
        set({
          bills: [...get().bills, {
            ...bill,
            subscriptionLink: {
              candidateId: candidate.id,
              source: candidate.source,
              provider: candidate.provider,
              connectionId: candidate.connectionId,
              externalStreamId: candidate.externalStreamId,
              materialFingerprint: candidate.materialFingerprint,
              lastSyncedAt: now,
            },
          }],
          subscriptionCandidates: get().subscriptionCandidates.filter((row) => row.id !== id),
          updatedAt: now,
        });
      },
      dismissSubscriptionCandidate: (id) => {
        const candidate = get().subscriptionCandidates.find((row) => row.id === id);
        if (!candidate) return;
        const now = touchUpdatedAt();
        const retained = get().dismissedSubscriptions.filter(
          (dismissal) => dismissal.candidateId !== id,
        );
        set({
          subscriptionCandidates: get().subscriptionCandidates.filter((row) => row.id !== id),
          dismissedSubscriptions: [...retained, {
            candidateId: id,
            materialFingerprint: candidate.materialFingerprint,
            dismissedAt: now,
          }],
          updatedAt: now,
        });
      },
      removeSubscription: (id) => {
        const bill = get().bills.find((row) => row.id === id);
        if (!bill || bill.kind !== 'subscription') return;
        const now = touchUpdatedAt();
        const link = bill.subscriptionLink;
        const retained = link
          ? get().dismissedSubscriptions.filter(
              (dismissal) => dismissal.candidateId !== link.candidateId,
            )
          : get().dismissedSubscriptions;
        set({
          bills: get().bills.filter((row) => row.id !== id),
          dismissedSubscriptions: link
            ? [...retained, {
                candidateId: link.candidateId,
                materialFingerprint: link.materialFingerprint,
                dismissedAt: now,
              }]
            : retained,
          updatedAt: now,
        });
      },
      setSubscriptionDetectionStatus: (subscriptionDetectionStatus) =>
        set({ subscriptionDetectionStatus, updatedAt: touchUpdatedAt() }),
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
      saveRewardProfile: (profile) => {
        const now = touchUpdatedAt();
        set({
          rewardProfiles: upsertById(get().rewardProfiles, { ...profile, updatedAt: now }),
          updatedAt: now,
        });
      },
      removeRewardProfile: (id) => {
        const now = touchUpdatedAt();
        set({
          rewardProfiles: get().rewardProfiles.filter((profile) => profile.id !== id),
          accounts: get().accounts.map((account) =>
            account.rewardProfileId === id
              ? { ...account, rewardProfileId: undefined, updatedAt: now }
              : account,
          ),
          updatedAt: now,
        });
      },
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
