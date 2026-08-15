import { importFinanceRewardsCsv, previewFinanceRewardsCsv } from '../rewards-csv';

describe('finance rewards CSV import', () => {
  const csv = [
    'Posted Date,Description,Amount,Category',
    '01/02/2026,"Cafe, Main",24.50,Dining',
    '01/03/2026,Refund,(5.00),Dining',
    'bad,Missing Date,10.00,Other',
  ].join('\n');

  it('previews quoted cells and imports expenses and refunds', () => {
    const preview = previewFinanceRewardsCsv(csv);
    expect(preview.headers).toEqual(['Posted Date', 'Description', 'Amount', 'Category']);
    expect(preview.rows[0].Description).toBe('Cafe, Main');
    const result = importFinanceRewardsCsv({
      preview,
      mapping: {
        date: 'Posted Date',
        merchant: 'Description',
        amount: 'Amount',
        category: 'Category',
      },
      accountId: 'card',
      entityId: 'personal',
      existingTransactions: [],
    });
    expect(result.skippedRows).toBe(1);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      merchant: 'Cafe, Main', amount: 24.5, activity: 'expense', sourceCategory: 'Dining',
    });
    expect(result.transactions[1]).toMatchObject({ amount: 5, activity: 'refund' });
  });

  it('uses deterministic fingerprints to reject rows already imported', () => {
    const preview = previewFinanceRewardsCsv(csv);
    const input = {
      preview,
      mapping: { date: 'Posted Date', merchant: 'Description', amount: 'Amount' },
      accountId: 'card',
      entityId: 'personal',
      existingTransactions: [],
    };
    const first = importFinanceRewardsCsv(input);
    const second = importFinanceRewardsCsv({ ...input, existingTransactions: first.transactions });
    expect(second.transactions).toEqual([]);
    expect(second.duplicateRows).toBe(2);
  });
});

