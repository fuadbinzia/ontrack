import type { SharePayload } from 'expo-sharing';

import {
  ezPassAssetsFromSharedPayloads,
  isEzPassStatementPayload,
} from '../ezpass-shared-statement';

function payload(value: string, mimeType?: string): SharePayload {
  return { value, mimeType, shareType: 'file' };
}

describe('shared E-ZPass statements', () => {
  it('recognizes the iOS transaction-report CSV even when Files labels it as text', () => {
    const shared = payload(
      'file:///Share/Transaction_Report_131813701_2026-08-14.csv',
      'text/plain',
    );

    expect(isEzPassStatementPayload(shared)).toBe(true);
    expect(ezPassAssetsFromSharedPayloads([shared])).toEqual([
      {
        uri: shared.value,
        name: 'Transaction_Report_131813701_2026-08-14.csv',
        mimeType: 'text/plain',
      },
    ]);
  });

  it.each([
    ['file:///Share/tolls.tsv', 'text/tab-separated-values'],
    ['file:///Share/tolls.xlsx', 'application/octet-stream'],
    ['file:///Share/E-ZPass%20Statement.pdf', 'application/pdf'],
  ])('accepts supported statement %s', (value, mimeType) => {
    expect(isEzPassStatementPayload(payload(value, mimeType))).toBe(true);
  });

  it('does not steal unrelated documents or mixed shares from the generic importer', () => {
    const statement = payload('file:///Share/tolls.csv', 'text/csv');
    const unrelated = payload('file:///Share/lease.pdf', 'application/pdf');

    expect(isEzPassStatementPayload(unrelated)).toBe(false);
    expect(ezPassAssetsFromSharedPayloads([statement, unrelated])).toEqual([]);
  });
});
