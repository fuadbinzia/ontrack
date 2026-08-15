import {
  categorizeFinanceMerchant,
  financeMerchantKey,
  harmonizeFinanceMerchantCategories,
} from '../finance-merchant-category';
import { createFinanceTransaction } from '../create';

function transaction(
  id: string,
  merchant: string,
  categoryId: string,
  source: 'manual' | 'plaid' | 'teller' | 'ezpass' = 'manual',
) {
  return createFinanceTransaction({
    id,
    amount: 25,
    date: '2026-08-13',
    merchant,
    categoryId,
    entityId: 'personal',
    source,
  });
}

describe('Finance merchant categories', () => {
  it('matches casing, accents, punctuation, and spacing without matching broader names', () => {
    expect(financeMerchantKey(' Páss-ny ')).toBe(financeMerchantKey('PASS NY'));
    expect(financeMerchantKey('Passny Cafe')).not.toBe(financeMerchantKey('Passny'));
  });

  it('categorizes every general transaction from the same merchant', () => {
    const updated = categorizeFinanceMerchant([
      transaction('one', 'Passny', 'other', 'plaid'),
      transaction('two', 'PASS-NY', 'other', 'teller'),
      transaction('cafe', 'Passny Cafe', 'other'),
      transaction('toll', 'Passny', 'transport', 'ezpass'),
    ], 'Pass ny', 'ezpass_replenishment', '2026-08-14T12:00:00.000Z');

    expect(updated.map(({ id, categoryId }) => ({ id, categoryId }))).toEqual([
      { id: 'one', categoryId: 'ezpass_replenishment' },
      { id: 'two', categoryId: 'ezpass_replenishment' },
      { id: 'cafe', categoryId: 'other' },
      { id: 'toll', categoryId: 'transport' },
    ]);
  });

  it('repairs older uncategorized copies using the known merchant category', () => {
    const categorized = transaction('one', 'Passny', 'ezpass_replenishment', 'plaid');
    const other = transaction('two', 'PASS NY', 'other', 'teller');
    categorized.updatedAt = '2026-08-13T10:00:00.000Z';
    other.updatedAt = '2026-08-14T10:00:00.000Z';

    expect(harmonizeFinanceMerchantCategories([categorized, other])).toEqual([
      categorized,
      expect.objectContaining({ id: 'two', categoryId: 'ezpass_replenishment' }),
    ]);
  });
});
