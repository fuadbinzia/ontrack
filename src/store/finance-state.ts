import type { FinanceRewardCardProfile } from '@/features/finance/rewards-types';
import type {
  FinanceAccount,
  FinanceBillKind,
  FinanceBucket,
  FinanceBucketContribution,
  FinanceCreditScoreEntry,
  FinanceDocument,
  FinanceEntity,
  FinanceHolding,
  FinanceRecurringBill,
  FinanceStateSnapshot,
  FinanceSubscriptionCandidate,
  FinanceSubscriptionDetectionStatus,
  FinanceTaxYear,
  FinanceTransaction,
} from '@/features/finance/types';

export type FinanceState = FinanceStateSnapshot & {
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
  saveTransactions: (transactions: FinanceTransaction[]) => void;
  categorizeMerchantTransactions: (merchant: string, categoryId: string) => void;
  repairEzPassDuplicates: () => void;
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
  reconcileSubscriptionCandidates: (
    source: FinanceSubscriptionCandidate['source'],
    connectionId: string | undefined,
    candidates: FinanceSubscriptionCandidate[],
  ) => void;
  confirmSubscriptionCandidate: (id: string, kind?: FinanceBillKind) => void;
  dismissSubscriptionCandidate: (id: string) => void;
  removeSubscription: (id: string) => void;
  setSubscriptionDetectionStatus: (status: FinanceSubscriptionDetectionStatus) => void;
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
  saveRewardProfile: (profile: FinanceRewardCardProfile) => void;
  removeRewardProfile: (id: string) => void;
  setCreditScore: (entry: FinanceCreditScoreEntry) => void;
  clearCreditScore: () => void;
  setCustomHandoffUrl: (url: string | undefined) => void;
  setReferenceSavingsApr: (apr: number | undefined) => void;
  replaceFinanceData: (snapshot: FinanceStateSnapshot) => void;
  reset: () => void;
};
