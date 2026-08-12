import type { FinanceAccountKind } from './types';

/** Map Plaid account type/subtype → onTrack finance account kind. */
export function mapPlaidAccountKind(
  type?: string,
  subtype?: string,
): FinanceAccountKind {
  const t = (type ?? '').toLowerCase();
  const s = (subtype ?? '').toLowerCase();

  if (t === 'credit' || s === 'credit card' || s === 'paypal') return 'card';
  if (t === 'depository') return 'bank';
  if (t === 'cryptocurrency' || s === 'crypto exchange') return 'crypto';

  if (t === 'investment' || t === 'brokerage') {
    if (
      s.includes('401k') ||
      s.includes('401a') ||
      s.includes('403b') ||
      s.includes('457b') ||
      s === 'pension' ||
      s.includes('profit sharing') ||
      s.includes('thrift savings')
    ) {
      return 'retirement_401k';
    }
    if (
      s.includes('ira') ||
      s === 'roth' ||
      s.includes('sep') ||
      s.includes('simple')
    ) {
      return 'ira';
    }
    if (s === 'hsa' || s.includes('health')) return 'hsa';
    if (s.includes('crypto')) return 'crypto';
    if (s === 'brokerage' || s.includes('stock') || s.includes('mutual')) {
      return 'brokerage';
    }
    return 'other_investment';
  }

  return 'other';
}
