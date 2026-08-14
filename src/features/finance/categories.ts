/** Expense categories mapped to IRS-friendly tax buckets. */

export type FinanceTaxBucket =
  | 'advertising'
  | 'car_truck'
  | 'commissions'
  | 'contract_labor'
  | 'depletion'
  | 'depreciation'
  | 'employee_benefit'
  | 'insurance'
  | 'interest'
  | 'legal_professional'
  | 'office'
  | 'pension'
  | 'rent_lease'
  | 'repairs'
  | 'supplies'
  | 'taxes_licenses'
  | 'travel'
  | 'meals'
  | 'utilities'
  | 'wages'
  | 'other_business'
  | 'property_mortgage'
  | 'property_tax'
  | 'property_insurance'
  | 'property_repairs'
  | 'property_management'
  | 'personal'
  | 'subscription'
  | 'uncategorized';

export interface FinanceCategory {
  id: string;
  label: string;
  taxBucket: FinanceTaxBucket;
  /** Shown for business entities by default. */
  businessDefault?: boolean;
  propertyDefault?: boolean;
  personalDefault?: boolean;
}

export const EZPASS_REPLENISHMENT_CATEGORY: FinanceCategory = {
  id: 'ezpass_replenishment',
  label: 'E-ZPass Replenishment',
  taxBucket: 'personal',
};

export const FINANCE_CATEGORIES: readonly FinanceCategory[] = [
  { id: 'groceries', label: 'Groceries', taxBucket: 'personal', personalDefault: true },
  { id: 'dining', label: 'Dining', taxBucket: 'meals', personalDefault: true, businessDefault: true },
  { id: 'transport', label: 'Transport', taxBucket: 'car_truck', personalDefault: true, businessDefault: true },
  { id: 'housing', label: 'Housing', taxBucket: 'personal', personalDefault: true },
  { id: 'utilities', label: 'Utilities', taxBucket: 'utilities', personalDefault: true, businessDefault: true, propertyDefault: true },
  { id: 'subscription', label: 'Subscriptions', taxBucket: 'subscription', personalDefault: true, businessDefault: true },
  { id: 'insurance', label: 'Insurance', taxBucket: 'insurance', personalDefault: true, businessDefault: true, propertyDefault: true },
  { id: 'healthcare', label: 'Healthcare', taxBucket: 'personal', personalDefault: true },
  { id: 'entertainment', label: 'Entertainment', taxBucket: 'personal', personalDefault: true },
  { id: 'shopping', label: 'Shopping', taxBucket: 'personal', personalDefault: true },
  { id: 'travel', label: 'Travel', taxBucket: 'travel', personalDefault: true, businessDefault: true },
  { id: 'office', label: 'Office', taxBucket: 'office', businessDefault: true },
  { id: 'supplies', label: 'Supplies', taxBucket: 'supplies', businessDefault: true },
  { id: 'advertising', label: 'Advertising', taxBucket: 'advertising', businessDefault: true },
  { id: 'legal', label: 'Legal & Professional', taxBucket: 'legal_professional', businessDefault: true },
  { id: 'contract_labor', label: 'Contract Labor', taxBucket: 'contract_labor', businessDefault: true },
  { id: 'interest', label: 'Interest', taxBucket: 'interest', businessDefault: true, personalDefault: true },
  { id: 'taxes', label: 'Taxes & Licenses', taxBucket: 'taxes_licenses', businessDefault: true },
  { id: 'property_tax', label: 'Property Tax', taxBucket: 'property_tax', propertyDefault: true },
  { id: 'property_insurance', label: 'Property Insurance', taxBucket: 'property_insurance', propertyDefault: true },
  { id: 'mortgage', label: 'Mortgage / Rent', taxBucket: 'property_mortgage', propertyDefault: true },
  { id: 'repairs', label: 'Repairs', taxBucket: 'repairs', businessDefault: true, propertyDefault: true },
  { id: 'property_management', label: 'Property Management', taxBucket: 'property_management', propertyDefault: true },
  { id: 'car_payment', label: 'Car Payment', taxBucket: 'car_truck', personalDefault: true },
  { id: 'other', label: 'Other', taxBucket: 'uncategorized', personalDefault: true, businessDefault: true, propertyDefault: true },
] as const;

const BY_ID = new Map(
  [...FINANCE_CATEGORIES, EZPASS_REPLENISHMENT_CATEGORY].map((category) => [category.id, category]),
);

export function financeCategoryById(id: string): FinanceCategory {
  return BY_ID.get(id) ?? {
    id,
    label: id,
    taxBucket: 'uncategorized',
  };
}

export function taxBucketLabel(bucket: FinanceTaxBucket): string {
  const labels: Record<FinanceTaxBucket, string> = {
    advertising: 'Advertising',
    car_truck: 'Car and Truck',
    commissions: 'Commissions and Fees',
    contract_labor: 'Contract Labor',
    depletion: 'Depletion',
    depreciation: 'Depreciation',
    employee_benefit: 'Employee Benefit Programs',
    insurance: 'Insurance',
    interest: 'Interest',
    legal_professional: 'Legal and Professional Services',
    office: 'Office Expense',
    pension: 'Pension and Profit-Sharing',
    rent_lease: 'Rent or Lease',
    repairs: 'Repairs and Maintenance',
    supplies: 'Supplies',
    taxes_licenses: 'Taxes and Licenses',
    travel: 'Travel',
    meals: 'Meals',
    utilities: 'Utilities',
    wages: 'Wages',
    other_business: 'Other Business',
    property_mortgage: 'Rental Mortgage / Rent',
    property_tax: 'Property Taxes',
    property_insurance: 'Property Insurance',
    property_repairs: 'Property Repairs',
    property_management: 'Property Management',
    personal: 'Personal (Non-Deductible)',
    subscription: 'Subscriptions',
    uncategorized: 'Uncategorized',
  };
  return labels[bucket];
}
