import { isDateKey } from '@/utils/date';
import { newUuid } from '@/utils/id';
import {
  asFiniteNumber,
  asOneOf,
  asString,
  asTrimmedString,
} from '@/utils/parse';

import { createDefaultPersonalEntity } from './create';
import { EZPASS_REPLENISHMENT_CATEGORY } from './categories';
import { deduplicateEzPassTransactions } from './ezpass-deduplication';
import { harmonizeFinanceMerchantCategories } from './finance-merchant-category';
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
  FinanceSubscriptionCandidate,
  FinanceSubscriptionDismissal,
  FinanceStateSnapshot,
  FinanceTaxYear,
  FinanceTransaction,
} from './types';
import type {
  FinanceRewardBenefit,
  FinanceRewardCardProfile,
  FinanceRewardRule,
} from './rewards-types';
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
  FINANCE_TRANSACTION_ACTIVITIES,
  FINANCE_SUBSCRIPTION_CANDIDATE_SOURCES,
  FINANCE_SUBSCRIPTION_CANDIDATE_STATUSES,
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

function activityTime(value: unknown): string | undefined {
  const time = asTrimmedString(value);
  return time && /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time) ? time : undefined;
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
    rewardProfileId: asTrimmedString(o.rewardProfileId),
    plaidItemId: legacyPlaidItemId,
    plaidInstitutionName: legacyPlaidInstitutionName,
    plaidAccountId: legacyPlaidAccountId,
    ...timestamps(o),
  };
}

function normalizeRewardRule(raw: unknown): FinanceRewardRule | undefined {
  const o = asRecord(raw);
  const multiplier = o ? asFiniteNumber(o.multiplier) : undefined;
  if (!o || multiplier === undefined || multiplier < 0) return undefined;
  const capPeriod = asOneOf(o.capPeriod, ['month', 'quarter', 'year', 'lifetime'] as const);
  const startsOn = asString(o.startsOn);
  const endsOn = asString(o.endsOn);
  return {
    id: idOrNew(o.id),
    name: asTrimmedString(o.name) || 'Bonus Category',
    multiplier,
    categoryIds: stringList(o.categoryIds),
    sourceCategories: stringList(o.sourceCategories),
    startsOn: startsOn && isDateKey(startsOn) ? startsOn : undefined,
    endsOn: endsOn && isDateKey(endsOn) ? endsOn : undefined,
    capAmount: Math.max(0, asFiniteNumber(o.capAmount) ?? 0) || undefined,
    capPeriod,
    capGroup: asTrimmedString(o.capGroup),
    requiresActivation: o.requiresActivation === true,
    active: o.active !== false,
  };
}

function normalizeRewardBenefit(raw: unknown): FinanceRewardBenefit | undefined {
  const o = asRecord(raw);
  const faceValue = o ? asFiniteNumber(o.faceValue) : undefined;
  if (!o || faceValue === undefined || faceValue < 0) return undefined;
  return {
    id: idOrNew(o.id),
    name: asTrimmedString(o.name) || 'Card Benefit',
    faceValue,
    userValue: Math.max(0, asFiniteNumber(o.userValue) ?? 0),
    enabled: o.enabled === true,
  };
}

export function normalizeRewardProfile(raw: unknown): FinanceRewardCardProfile | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const source = asRecord(o.source) ?? {};
  const welcomeOffer = asRecord(o.welcomeOffer);
  const pointValueCents = asFiniteNumber(o.pointValueCents);
  const baseMultiplier = asFiniteNumber(o.baseMultiplier);
  const annualFee = asFiniteNumber(o.annualFee);
  if (pointValueCents === undefined || baseMultiplier === undefined || annualFee === undefined) {
    return undefined;
  }
  const sourceKind = asOneOf(source.kind, ['manual', 'issuer', 'third_party'] as const) ?? 'manual';
  return {
    id: idOrNew(o.id),
    issuer: asTrimmedString(o.issuer) || 'Unknown Issuer',
    name: asTrimmedString(o.name) || 'Rewards Card',
    network: asTrimmedString(o.network),
    ownership: asOneOf(o.ownership, ['owned', 'market'] as const) ?? 'owned',
    rewardCurrency: asTrimmedString(o.rewardCurrency) || 'points',
    pointValueCents: Math.max(0, pointValueCents),
    baseMultiplier: Math.max(0, baseMultiplier),
    annualFee: Math.max(0, annualFee),
    rules: mapDefined(o.rules, normalizeRewardRule),
    benefits: mapDefined(o.benefits, normalizeRewardBenefit),
    welcomeOffer: welcomeOffer ? {
      description: asTrimmedString(welcomeOffer.description) || 'Welcome Offer',
      rewardAmount: Math.max(0, asFiniteNumber(welcomeOffer.rewardAmount) ?? 0) || undefined,
      spendRequirement:
        Math.max(0, asFiniteNumber(welcomeOffer.spendRequirement) ?? 0) || undefined,
      monthsToEarn: Math.max(0, asFiniteNumber(welcomeOffer.monthsToEarn) ?? 0) || undefined,
    } : undefined,
    source: {
      url: asTrimmedString(source.url),
      hostname: asTrimmedString(source.hostname),
      kind: sourceKind,
      retrievedAt: asTrimmedString(source.retrievedAt),
      confidence: source.confidence == null
        ? undefined
        : Math.min(1, Math.max(0, asFiniteNumber(source.confidence) ?? 0)),
      warnings: stringList(source.warnings),
    },
    editedFields: stringList(o.editedFields),
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
  const source = asOneOf(o.source, FINANCE_TRANSACTION_SOURCES) ?? 'manual';
  const activity = asOneOf(o.activity, FINANCE_TRANSACTION_ACTIVITIES) ?? 'expense';
  return {
    id: idOrNew(o.id),
    amount,
    currency: currencyCode(o.currency),
    date,
    merchant: asTrimmedString(o.merchant) || 'Expense',
    categoryId:
      source === 'ezpass' && activity === 'transfer'
        ? EZPASS_REPLENISHMENT_CATEGORY.id
        : asString(o.categoryId) || 'other',
    entityId,
    accountId: asTrimmedString(o.accountId),
    notes: asTrimmedString(o.notes),
    receiptUri: cleanHttpsOrFileUri(asString(o.receiptUri)),
    source,
    activity,
    activityTime: activityTime(o.activityTime),
    externalId: asTrimmedString(o.externalId),
    sourceCategory: asTrimmedString(o.sourceCategory),
    ezPassFriendId: source === 'ezpass' ? asTrimmedString(o.ezPassFriendId) : undefined,
    ezPassFriendName: source === 'ezpass' ? asTrimmedString(o.ezPassFriendName) : undefined,
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
  const link = asRecord(o.subscriptionLink);
  const linkSource = link
    ? asOneOf(link.source, FINANCE_SUBSCRIPTION_CANDIDATE_SOURCES)
    : undefined;
  const linkProvider = link ? asOneOf(link.provider, FINANCE_CONNECTION_PROVIDERS) : undefined;
  const candidateId = link ? asTrimmedString(link.candidateId) : undefined;
  const materialFingerprint = link ? asTrimmedString(link.materialFingerprint) : undefined;
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
    subscriptionLink:
      link && linkSource && linkProvider && candidateId && materialFingerprint
        ? {
            candidateId,
            source: linkSource,
            provider: linkProvider,
            connectionId: asTrimmedString(link.connectionId),
            externalStreamId: asTrimmedString(link.externalStreamId),
            materialFingerprint,
            lastSyncedAt: asTrimmedString(link.lastSyncedAt) || isoNow(),
          }
        : undefined,
    ...timestamps(o),
  };
}

export function normalizeSubscriptionCandidate(
  raw: unknown,
): FinanceSubscriptionCandidate | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const source = asOneOf(o.source, FINANCE_SUBSCRIPTION_CANDIDATE_SOURCES);
  const status = asOneOf(o.status, FINANCE_SUBSCRIPTION_CANDIDATE_STATUSES);
  const provider = asOneOf(o.provider, FINANCE_CONNECTION_PROVIDERS);
  const cadence = asOneOf(o.cadence, FINANCE_BILL_CADENCES);
  const amount = asFiniteNumber(o.amount);
  const confidence = asFiniteNumber(o.confidence);
  const nextDue = asString(o.nextDue);
  const id = asTrimmedString(o.id);
  const materialFingerprint = asTrimmedString(o.materialFingerprint);
  if (
    !source || !status || !provider || !cadence || cadence === 'once' ||
    amount === undefined || amount <= 0 || confidence === undefined ||
    !nextDue || !isDateKey(nextDue) || !id || !materialFingerprint
  ) return undefined;
  return {
    id,
    source,
    status,
    provider,
    connectionId: asTrimmedString(o.connectionId),
    externalStreamId: asTrimmedString(o.externalStreamId),
    name: asTrimmedString(o.name) || 'Subscription',
    amount,
    currency: currencyCode(o.currency),
    cadence,
    nextDue,
    accountId: asTrimmedString(o.accountId),
    categoryHint: asTrimmedString(o.categoryHint),
    suggestedKind: asOneOf(o.suggestedKind, FINANCE_BILL_KINDS) ?? 'subscription',
    confidence: Math.max(0, Math.min(1, confidence)),
    active: typeof o.active === 'boolean' ? o.active : true,
    materialFingerprint,
    detectedAt: asTrimmedString(o.detectedAt) || isoNow(),
  };
}

export function normalizeSubscriptionDismissal(
  raw: unknown,
): FinanceSubscriptionDismissal | undefined {
  const o = asRecord(raw);
  if (!o) return undefined;
  const candidateId = asTrimmedString(o.candidateId);
  const materialFingerprint = asTrimmedString(o.materialFingerprint);
  if (!candidateId || !materialFingerprint) return undefined;
  return {
    candidateId,
    materialFingerprint,
    dismissedAt: asTrimmedString(o.dismissedAt) || isoNow(),
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
  const subscriptionDetectionStatus = asOneOf(
    o.subscriptionDetectionStatus,
    ['idle', 'pending', 'ready', 'fallback', 'error'] as const,
  ) ?? 'idle';
  return {
    entities,
    accounts: mapDefined(o.accounts, normalizeAccount),
    holdings: mapDefined(o.holdings, normalizeHolding),
    transactions: harmonizeFinanceMerchantCategories(
      deduplicateEzPassTransactions(mapDefined(o.transactions, normalizeTransaction)),
    ),
    bills: mapDefined(o.bills, normalizeBill),
    subscriptionCandidates: mapDefined(
      o.subscriptionCandidates,
      normalizeSubscriptionCandidate,
    ),
    dismissedSubscriptions: mapDefined(
      o.dismissedSubscriptions,
      normalizeSubscriptionDismissal,
    ),
    subscriptionDetectionStatus,
    buckets: mapDefined(o.buckets, normalizeBucket),
    taxYears: mapDefined(o.taxYears, normalizeTaxYear),
    documents: mapDefined(o.documents, normalizeDocument),
    rewardProfiles: mapDefined(o.rewardProfiles, normalizeRewardProfile),
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
    subscriptionCandidates,
    dismissedSubscriptions,
    subscriptionDetectionStatus,
    buckets,
    taxYears,
    documents,
    rewardProfiles,
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
    subscriptionCandidates,
    dismissedSubscriptions,
    subscriptionDetectionStatus,
    buckets,
    taxYears,
    documents,
    rewardProfiles,
    creditScore,
    customHandoffUrl,
    referenceSavingsApr,
    baseCurrency,
    updatedAt,
  };
}
