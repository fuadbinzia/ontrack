import {
  deduplicateEzPassDrafts,
  deduplicateEzPassDraftsAgainstTransactions,
  deduplicateEzPassTransactions,
  ezPassProbableKeyForTransaction,
  parseDelimitedText,
  parseEzPassRows,
  parseEzPassText,
} from '../ezpass-parser';

const CSV = `Posting Date,Transaction Type,Facility,Amount,Reference Number
08/01/2026,Toll,RFK Bridge,$6.94,trip-a
08/02/2026,Account Replenishment,E-ZPass NY,$25.00,payment-a
08/03/2026,Refund,Tappan Zee Toll Credit,$6.94,refund-a
08/04/2026,Administrative Fee,E-ZPass NY,$2.00,fee-a
08/05/2026,Balance Adjustment,E-ZPass NY,-$1.25,adjust-a`;

describe('E-ZPass activity parser', () => {
  it('parses quoted structured activity and classifies every account activity type', () => {
    const result = parseEzPassRows(parseDelimitedText(CSV));
    expect(result.skippedRows).toBe(0);
    expect(result.activities).toHaveLength(5);
    expect(result.activities.map(({ kind, activity, amount }) => ({ kind, activity, amount }))).toEqual([
      { kind: 'toll', activity: 'expense', amount: 6.94 },
      { kind: 'replenishment', activity: 'transfer', amount: 25 },
      { kind: 'refund', activity: 'refund', amount: -6.94 },
      { kind: 'fee', activity: 'expense', amount: 2 },
      { kind: 'adjustment', activity: 'adjustment', amount: -1.25 },
    ]);
  });

  it('parses iOS Vision-style and Android ML Kit-style OCR lines', () => {
    const ios = parseEzPassText(`E-ZPass Statement
08/08/2026 RFK Bridge Toll $6.94
08/09/2026 JFK Airport Parking $12.00`);
    const android = parseEzPassText(`ACTIVITY
2026-08-10 Newburgh-Beacon Bridge Toll 2.15
2026-08-11 Account Replenishment 30.00`);
    expect(ios.activities.map((row) => row.kind)).toEqual(['toll', 'parking']);
    expect(android.activities.map((row) => row.activity)).toEqual(['expense', 'transfer']);
    expect([...ios.activities, ...android.activities].every((row) => row.confidence === 'review')).toBe(true);
  });

  it('parses the embedded text order produced by iOS PDFKit', () => {
    const result = parseEzPassText(`E-ZPass Transaction History
Date Time Description Amount
08/14/2026 02:45 PM UNI - Union $2.25
08/14/2026 03:20 PM IRS - Irvington South $1.75`);

    expect(result.skippedRows).toBe(0);
    expect(result.activities.map(({ merchant, amount, activityTime }) => ({
      merchant,
      amount,
      activityTime,
    }))).toEqual([
      { merchant: 'Uni - Union', amount: 2.25, activityTime: '14:45:00' },
      { merchant: 'Irs - Irvington South', amount: 1.75, activityTime: '15:20:00' },
    ]);
  });

  it('reconstructs E-ZPass PDF rows when PDFKit separates descriptions from dated amounts', () => {
    const result = parseEzPassText(`Transaction Report
Lane Txn ID Tag/Plate # Agency Entry Plaza Exit Plaza Class Date Exit Time Amount
PAYMENT 08/13/2026 $25.00
34241715270 00810137604 GSP UNI 1 08/13/2026 04:25:15
PM
-$2.25
34244034502 NJ ABC123 CRZ 1 08/11/2026 07:11:36
PM
$3.00
34242760159 NJ ABC123 CBDTP CRZ 1 08/11/2026 07:11:36
PM
-$9.00`);

    expect(result.skippedRows).toBe(0);
    expect(result.activities).toHaveLength(4);
    expect(result.activities.map((row) => ({
      date: row.date,
      activityTime: row.activityTime,
      merchant: row.merchant,
      amount: row.amount,
      kind: row.kind,
    }))).toEqual([
      { date: '2026-08-13', activityTime: undefined, merchant: 'E-Zpass Ny Payment', amount: 25, kind: 'replenishment' },
      { date: '2026-08-13', activityTime: '16:25:15', merchant: 'Gsp Uni', amount: 2.25, kind: 'toll' },
      { date: '2026-08-11', activityTime: '19:11:36', merchant: 'Toll Credit · Crz', amount: -3, kind: 'refund' },
      { date: '2026-08-11', activityTime: '19:11:36', merchant: 'Cbdtp Crz', amount: 9, kind: 'toll' },
    ]);
    expect(result.activities.map((row) => row.merchant).join(' ')).not.toMatch(/3424|0081|ABC123/);
    expect(result.activities.every((row) => row.confidence === 'review')).toBe(true);
  });

  it('keeps dated amount-only PDF rows reviewable instead of discarding them', () => {
    const result = parseEzPassText(`Transaction Report
08/14/2026 12:14:47 PM $7.38`);
    expect(result.activities).toEqual([
      expect.objectContaining({
        date: '2026-08-14',
        activityTime: '12:14:47',
        amount: 7.38,
        merchant: 'E-Zpass Ny Activity',
        confidence: 'review',
      }),
    ]);
    expect(result.skippedRows).toBe(0);
  });

  it('parses separate CSV time columns in 12-hour and 24-hour forms', () => {
    const result = parseEzPassRows([
      ['Transaction Date', 'Exit Time', 'Description', 'Amount'],
      ['08/14/2026', '04:25:15 PM', 'Union', '2.25'],
      ['08/14/2026', '07:11', 'Irvington South', '3.00'],
    ]);
    expect(result.activities.map((row) => row.activityTime)).toEqual([
      '16:25:15',
      '07:11:00',
    ]);
  });

  it('rejects malformed dates, zero amounts, totals, and rows without descriptions', () => {
    const result = parseEzPassRows([
      ['Transaction Date', 'Description', 'Amount'],
      ['13/45/2026', 'Toll', '4.00'],
      ['08/01/2026', 'Toll', '0.00'],
      ['Statement total', '', '10.00'],
      ['08/02/2026', '', '2.00'],
    ]);
    expect(result.activities).toEqual([]);
    expect(result.skippedRows).toBe(4);
  });

  it('removes exact repeats and flags same-day probable OCR duplicates', () => {
    const parsed = parseEzPassText(`08/08/2026 RFK Bridge Toll $6.94
08/08/2026 RFK Bridge Toll $6.94
08/08/2026 RFK Bridge Toll $6.94`);
    const first = parsed.activities[0];
    expect(first).toBeDefined();
    const deduped = deduplicateEzPassDrafts(parsed.activities, []);
    expect(deduped.unique).toHaveLength(1);
    expect(deduped.exactDuplicates).toBe(2);

    const distinctReferences = parseEzPassRows([
      ['date', 'description', 'amount', 'reference'],
      ['08/08/2026', 'RFK Bridge Toll', '6.94', 'one'],
      ['08/08/2026', 'RFK Bridge Toll', '6.94', 'two'],
    ]);
    const possible = deduplicateEzPassDrafts(distinctReferences.activities, []);
    expect(possible.unique).toHaveLength(2);
    expect(possible.probableDuplicateKeys.has(possible.unique[0].probableDuplicateKey)).toBe(true);
    expect(deduplicateEzPassDrafts([first!], [first!.fingerprint]).exactDuplicates).toBe(1);
    const existingKey = ezPassProbableKeyForTransaction({
      id: 'existing',
      amount: 6.94,
      currency: 'USD',
      date: '2026-08-08',
      merchant: 'Rfk Bridge Toll',
      categoryId: 'transport',
      entityId: 'personal',
      source: 'ezpass',
      activity: 'expense',
      notes: 'E-ZPass Toll',
      createdAt: '2026-08-08T00:00:00.000Z',
      updatedAt: '2026-08-08T00:00:00.000Z',
    });
    const againstExisting = deduplicateEzPassDrafts([first!], [], [existingKey!]);
    expect(againstExisting.probableDuplicateKeys.has(first!.probableDuplicateKey)).toBe(true);
  });

  it('indexes existing Finance transactions once for exact and probable duplicates', () => {
    const [exact, probable] = parseEzPassRows([
      ['date', 'description', 'amount', 'reference'],
      ['08/08/2026', 'RFK Bridge Toll', '6.94', 'exact'],
      ['08/09/2026', 'Lincoln Tunnel Toll', '8.50', 'new-reference'],
    ]).activities;
    const result = deduplicateEzPassDraftsAgainstTransactions([exact!, probable!], [
      {
        id: 'exact-existing',
        amount: exact!.amount,
        currency: 'USD',
        date: exact!.date,
        merchant: exact!.merchant,
        categoryId: 'transport',
        entityId: 'personal',
        source: 'ezpass',
        activity: 'expense',
        externalId: exact!.fingerprint,
        createdAt: '2026-08-08T00:00:00.000Z',
        updatedAt: '2026-08-08T00:00:00.000Z',
      },
      {
        id: 'probable-existing',
        amount: probable!.amount,
        currency: 'USD',
        date: probable!.date,
        merchant: probable!.merchant,
        categoryId: 'transport',
        entityId: 'personal',
        source: 'ezpass',
        activity: 'expense',
        notes: 'E-ZPass Toll',
        createdAt: '2026-08-09T00:00:00.000Z',
        updatedAt: '2026-08-09T00:00:00.000Z',
      },
    ]);

    expect(result.exactDuplicates).toBe(1);
    expect(result.unique).toEqual([probable]);
    expect(result.probableDuplicateKeys.has(probable!.probableDuplicateKey)).toBe(true);
  });

  it('recognizes the same timestamped toll across CSV and PDF plaza names', () => {
    const [csv] = parseEzPassRows([
      ['Transaction Date', 'Exit Time', 'Description', 'Amount', 'Reference Number'],
      ['08/13/2026', '04:25:15 PM', 'UNI - Union', '2.25', 'csv-trip'],
    ]).activities;
    const [pdf] = parseEzPassText(
      '08/13/2026 04:25:15 PM GSP UNI $2.25',
    ).activities;
    const result = deduplicateEzPassDraftsAgainstTransactions([pdf!], [{
      id: 'csv-existing',
      amount: csv!.amount,
      currency: 'USD',
      date: csv!.date,
      merchant: csv!.merchant,
      categoryId: 'transport',
      entityId: 'personal',
      source: 'ezpass',
      activity: csv!.activity,
      activityTime: csv!.activityTime,
      externalId: csv!.fingerprint,
      createdAt: '2026-08-14T10:00:00.000Z',
      updatedAt: '2026-08-14T10:00:00.000Z',
    }]);

    expect(pdf!.merchant).not.toBe(csv!.merchant);
    expect(result.unique).toEqual([]);
    expect(result.exactDuplicates).toBe(1);
  });

  it('does not merge same-day amounts at different times or with different activity types', () => {
    const drafts = parseEzPassRows([
      ['Transaction Date', 'Exit Time', 'Transaction Type', 'Description', 'Amount', 'Reference'],
      ['08/13/2026', '04:25:15 PM', 'Toll', 'UNI - Union', '2.25', 'one'],
      ['08/13/2026', '04:25:16 PM', 'Toll', 'UNI - Union', '2.25', 'two'],
      ['08/13/2026', '04:25:15 PM', 'Refund', 'UNI - Union', '2.25', 'three'],
    ]).activities;
    const result = deduplicateEzPassDrafts(drafts, []);
    expect(result.unique).toHaveLength(3);
    expect(result.exactDuplicates).toBe(0);
  });

  it('repairs existing cross-format pairs while preserving the friend tag and richer name', () => {
    const common = {
      amount: 2.25,
      currency: 'USD',
      date: '2026-08-13',
      categoryId: 'transport',
      entityId: 'personal',
      source: 'ezpass' as const,
      activity: 'expense' as const,
      activityTime: '16:25:15',
    };
    const result = deduplicateEzPassTransactions([
      {
        ...common,
        id: 'pdf-row',
        merchant: 'Gsp',
        ezPassFriendId: 'friend-synthetic',
        ezPassFriendName: 'Sample Friend',
        createdAt: '2026-08-14T10:00:00.000Z',
        updatedAt: '2026-08-14T10:00:00.000Z',
      },
      {
        ...common,
        id: 'csv-row',
        merchant: 'UNI - Union',
        createdAt: '2026-08-14T11:00:00.000Z',
        updatedAt: '2026-08-14T12:00:00.000Z',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      id: 'pdf-row',
      merchant: 'UNI - Union',
      ezPassFriendId: 'friend-synthetic',
      ezPassFriendName: 'Sample Friend',
      createdAt: '2026-08-14T10:00:00.000Z',
    }));
  });
});
