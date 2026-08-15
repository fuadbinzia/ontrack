import { TAX_HANDOFF_DESTINATIONS, taxHandoffById } from '../tax-handoff';
import { buildTaxExportPackage } from '../tax-export';
import type { FinanceEntity, FinanceTaxYear, FinanceTransaction } from '../types';

describe('tax handoff + export', () => {
  it('includes IRS and consumer filers', () => {
    const ids = TAX_HANDOFF_DESTINATIONS.map((d) => d.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'irs_direct_file',
        'irs_free_file',
        'turbotax',
        'freetaxusa',
        'april',
        'cpa',
        'other',
      ]),
    );
    expect(taxHandoffById('turbotax').sharePackage).toBe(true);
  });

  it('builds a categorized CSV export', () => {
    const taxYear: FinanceTaxYear = {
      id: 'ty',
      year: 2026,
      entityIds: ['e1'],
      checklist: {},
      documentIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const entities: FinanceEntity[] = [
      {
        id: 'e1',
        kind: 'business',
        name: 'Studio',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const transactions: FinanceTransaction[] = [
      {
        id: 't1',
        amount: 42.5,
        currency: 'USD',
        date: '2026-03-04',
        merchant: 'Office Depot',
        categoryId: 'office',
        entityId: 'e1',
        source: 'manual',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'toll',
        amount: 2.25,
        currency: 'USD',
        date: '2026-03-05',
        merchant: 'Bridge Toll',
        categoryId: 'transport',
        entityId: 'e1',
        source: 'ezpass',
        activity: 'expense',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'funding',
        amount: 25,
        currency: 'USD',
        date: '2026-03-05',
        merchant: 'E-ZPass Replenishment',
        categoryId: 'transport',
        entityId: 'e1',
        source: 'ezpass',
        activity: 'transfer',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const pack = buildTaxExportPackage({
      taxYear,
      entities,
      transactions,
      documents: [],
    });
    expect(pack.csv).toContain('Office Depot');
    expect(pack.csv).toContain('Office Expense');
    expect(pack.csv).not.toContain('Bridge Toll');
    expect(pack.csv).not.toContain('E-ZPass Replenishment');
    expect(pack.summaryText).toContain('Total categorized spend: 42.50');
    expect(pack.summaryText).toContain('does not e-file');
  });
});
