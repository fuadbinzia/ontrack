/** Finance domain models — local-first ledger, bills, buckets, tax prep. */

export type FinanceEntityKind = 'personal' | 'business' | 'property';

export const FINANCE_ENTITY_KINDS: readonly FinanceEntityKind[] = [
  'personal',
  'business',
  'property',
] as const;

export const FINANCE_CREDIT_HISTORY_CAP = 12;

export type FinanceAccountKind =
  | 'card'
  | 'bank'
  | 'cash'
  | 'brokerage'
  | 'retirement_401k'
  | 'ira'
  | 'hsa'
  | 'crypto'
  | 'other_investment'
  | 'other';

export const FINANCE_ACCOUNT_KINDS: readonly FinanceAccountKind[] = [
  'card',
  'bank',
  'cash',
  'brokerage',
  'retirement_401k',
  'ira',
  'hsa',
  'crypto',
  'other_investment',
  'other',
] as const;

export function isFinanceAccountKind(value: string): value is FinanceAccountKind {
  return (FINANCE_ACCOUNT_KINDS as readonly string[]).includes(value);
}

const ASSET_KINDS = new Set<FinanceAccountKind>([
  'bank',
  'cash',
  'brokerage',
  'retirement_401k',
  'ira',
  'hsa',
  'crypto',
  'other_investment',
]);

const INVESTMENT_KINDS = new Set<FinanceAccountKind>([
  'brokerage',
  'retirement_401k',
  'ira',
  'hsa',
  'crypto',
  'other_investment',
]);

/** Asset-like kinds included in hub Assets total (excludes cards). */
export function isFinanceAssetKind(kind: FinanceAccountKind): boolean {
  return ASSET_KINDS.has(kind);
}

export function isFinanceInvestmentKind(kind: FinanceAccountKind): boolean {
  return INVESTMENT_KINDS.has(kind);
}

export const FINANCE_ACCOUNT_KIND_LABEL: Record<FinanceAccountKind, string> = {
  card: 'Card',
  bank: 'Bank',
  cash: 'Cash',
  brokerage: 'Brokerage',
  retirement_401k: '401(k)',
  ira: 'IRA',
  hsa: 'HSA',
  crypto: 'Crypto',
  other_investment: 'Other Investment',
  other: 'Other',
};

export type FinanceAccountLinkStatus = 'manual' | 'pending' | 'linked' | 'error';

export type FinanceConnectionProvider = 'plaid' | 'teller';

export const FINANCE_CONNECTION_PROVIDERS: readonly FinanceConnectionProvider[] = [
  'plaid',
  'teller',
] as const;

export const FINANCE_ACCOUNT_LINK_STATUSES: readonly FinanceAccountLinkStatus[] = [
  'manual',
  'pending',
  'linked',
  'error',
] as const;

export type FinanceTransactionSource = 'manual' | 'import' | 'plaid' | 'teller';

export const FINANCE_TRANSACTION_SOURCES: readonly FinanceTransactionSource[] = [
  'manual',
  'import',
  'plaid',
  'teller',
] as const;

export type FinanceBillKind =
  | 'bill'
  | 'subscription'
  | 'loan'
  | 'insurance'
  | 'tax'
  | 'other';

export const FINANCE_BILL_KINDS: readonly FinanceBillKind[] = [
  'bill',
  'subscription',
  'loan',
  'insurance',
  'tax',
  'other',
] as const;

export type FinanceBillCadence =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'once';

export const FINANCE_BILL_CADENCES: readonly FinanceBillCadence[] = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
  'once',
] as const;

export type FinanceDocumentKind =
  | 'w2'
  | '1099'
  | 'k1'
  | 'receipt'
  | 'property'
  | 'other';

export const FINANCE_DOCUMENT_KINDS: readonly FinanceDocumentKind[] = [
  'w2',
  '1099',
  'k1',
  'receipt',
  'property',
  'other',
] as const;

export type FinanceCreditBureau =
  | 'equifax'
  | 'experian'
  | 'transunion'
  | 'other';

export const FINANCE_CREDIT_BUREAUS: readonly FinanceCreditBureau[] = [
  'equifax',
  'experian',
  'transunion',
  'other',
] as const;

export type FinanceCreditModel =
  | 'vantage_3'
  | 'vantage_4'
  | 'fico_8'
  | 'fico_9'
  | 'fico_10'
  | 'other';

export const FINANCE_CREDIT_MODELS: readonly FinanceCreditModel[] = [
  'vantage_3',
  'vantage_4',
  'fico_8',
  'fico_9',
  'fico_10',
  'other',
] as const;

export const FINANCE_CREDIT_BUREAU_LABEL: Record<FinanceCreditBureau, string> = {
  equifax: 'Equifax',
  experian: 'Experian',
  transunion: 'TransUnion',
  other: 'Other',
};

export const FINANCE_CREDIT_MODEL_LABEL: Record<FinanceCreditModel, string> = {
  vantage_3: 'VantageScore 3',
  vantage_4: 'VantageScore 4',
  fico_8: 'FICO 8',
  fico_9: 'FICO 9',
  fico_10: 'FICO 10',
  other: 'Other',
};

export interface FinanceEntity {
  id: string;
  kind: FinanceEntityKind;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceAccount {
  id: string;
  name: string;
  kind: FinanceAccountKind;
  /** Last 4 digits when known. */
  last4?: string;
  /** APR for cards/loans — used by money coach. */
  aprPercent?: number;
  /** Current balance when known (assets / cash). */
  balance?: number;
  /** YYYY-MM-DD when balance was observed. */
  balanceAsOf?: string;
  currency: string;
  linkStatus: FinanceAccountLinkStatus;
  /** Provider-neutral connection metadata. Provider credentials remain server-side. */
  provider?: FinanceConnectionProvider;
  connectionId?: string;
  institutionName?: string;
  externalAccountId?: string;
  /** Opaque Plaid item id when linked (server-side tokens never stored here). */
  /** @deprecated Read only for snapshots created before provider-neutral connections. */
  plaidItemId?: string;
  /** @deprecated Use institutionName. */
  plaidInstitutionName?: string;
  /** Plaid account_id when linked (for holdings join). */
  /** @deprecated Use externalAccountId. */
  plaidAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceHolding {
  id: string;
  accountId: string;
  /** Ticker / CUSIP when known. */
  symbol?: string;
  name: string;
  quantity?: number;
  value: number;
  currency: string;
  /** YYYY-MM-DD */
  asOf: string;
  /** External Plaid security/holding key for upsert. */
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceCreditScoreEntry {
  score: number;
  bureau: FinanceCreditBureau;
  model: FinanceCreditModel;
  /** YYYY-MM-DD */
  asOf: string;
  notes?: string;
  updatedAt: string;
}

export interface FinanceCreditScore {
  current?: FinanceCreditScoreEntry;
  /** Newest-first history, capped at 12. */
  history: FinanceCreditScoreEntry[];
}

export interface FinanceTransaction {
  id: string;
  amount: number;
  currency: string;
  date: string;
  merchant: string;
  categoryId: string;
  entityId: string;
  accountId?: string;
  notes?: string;
  receiptUri?: string;
  source: FinanceTransactionSource;
  /** External id when synced from Plaid. */
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceRecurringBill {
  id: string;
  name: string;
  amount: number;
  currency: string;
  cadence: FinanceBillCadence;
  nextDue: string;
  categoryId: string;
  entityId: string;
  kind: FinanceBillKind;
  accountId?: string;
  /** APR for loans/cards tied to the bill. */
  aprPercent?: number;
  notes?: string;
  active: boolean;
  lastPaidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceBucketContribution {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface FinanceBucket {
  id: string;
  name: string;
  goalAmount: number;
  currency: string;
  targetDate?: string;
  entityId?: string;
  notes?: string;
  contributions: FinanceBucketContribution[];
  createdAt: string;
  updatedAt: string;
}

export interface FinanceDocument {
  id: string;
  taxYearId: string;
  kind: FinanceDocumentKind;
  name: string;
  uri: string;
  createdAt: string;
}

export type FinanceTaxChecklistKey =
  | 'entities_scoped'
  | 'income_docs'
  | 'expenses_categorized'
  | 'property_docs'
  | 'export_ready';

export interface FinanceTaxYear {
  id: string;
  year: number;
  entityIds: string[];
  checklist: Partial<Record<FinanceTaxChecklistKey, boolean>>;
  documentIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceStateSnapshot {
  entities: FinanceEntity[];
  accounts: FinanceAccount[];
  holdings: FinanceHolding[];
  transactions: FinanceTransaction[];
  bills: FinanceRecurringBill[];
  buckets: FinanceBucket[];
  taxYears: FinanceTaxYear[];
  documents: FinanceDocument[];
  creditScore?: FinanceCreditScore;
  /** User-saved custom file-elsewhere URL. */
  customHandoffUrl?: string;
  /** Optional HYSA / cash yield reference (%) for money coach. */
  referenceSavingsApr?: number;
  baseCurrency: string;
  updatedAt?: string;
}
