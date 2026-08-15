export type FinanceRewardOwnership = 'owned' | 'market';
export type FinanceRewardCapPeriod = 'month' | 'quarter' | 'year' | 'lifetime';
export type FinanceRewardSourceKind = 'manual' | 'issuer' | 'third_party';

export interface FinanceRewardRule {
  id: string;
  name: string;
  multiplier: number;
  categoryIds: string[];
  /** Plaid detailed categories, such as FOOD_AND_DRINK_RESTAURANTS. */
  sourceCategories: string[];
  startsOn?: string;
  endsOn?: string;
  capAmount?: number;
  capPeriod?: FinanceRewardCapPeriod;
  /** Rules with the same non-empty key share a spending cap. */
  capGroup?: string;
  requiresActivation?: boolean;
  active: boolean;
}

export interface FinanceRewardBenefit {
  id: string;
  name: string;
  faceValue: number;
  /** User-estimated annual amount they realistically use. Defaults to zero. */
  userValue: number;
  enabled: boolean;
}

export interface FinanceRewardWelcomeOffer {
  description: string;
  rewardAmount?: number;
  spendRequirement?: number;
  monthsToEarn?: number;
}

export interface FinanceRewardSource {
  url?: string;
  hostname?: string;
  kind: FinanceRewardSourceKind;
  retrievedAt?: string;
  confidence?: number;
  warnings: string[];
}

export interface FinanceRewardCardProfile {
  id: string;
  issuer: string;
  name: string;
  network?: string;
  ownership: FinanceRewardOwnership;
  rewardCurrency: string;
  /** Estimated cents per point or mile. Cash-back profiles use 1. */
  pointValueCents: number;
  baseMultiplier: number;
  annualFee: number;
  rules: FinanceRewardRule[];
  benefits: FinanceRewardBenefit[];
  welcomeOffer?: FinanceRewardWelcomeOffer;
  source: FinanceRewardSource;
  /** Paths changed after import; re-import never silently overwrites them. */
  editedFields: string[];
  createdAt: string;
  updatedAt: string;
}

export type FinanceRewardProfileDraft = Omit<
  FinanceRewardCardProfile,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface RewardsCatalogProvider {
  id: string;
  search(query: string, signal?: AbortSignal): Promise<FinanceRewardProfileDraft[]>;
  getProfile(externalId: string, signal?: AbortSignal): Promise<FinanceRewardProfileDraft>;
}

export interface RewardProfileImporter<Input> {
  id: string;
  import(input: Input, signal?: AbortSignal): Promise<FinanceRewardProfileDraft>;
}

