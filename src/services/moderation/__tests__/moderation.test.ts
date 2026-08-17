import { REPORT_REASONS, isReportReason } from '@/services/moderation';

describe('moderation report reasons', () => {
  it('covers the reasons the report RPC accepts', () => {
    expect(REPORT_REASONS.map((reason) => reason.key)).toEqual([
      'harassment',
      'hate',
      'spam',
      'sexual',
      'illegal',
      'impersonation',
      'private_info',
      'unsafe',
      'copyright',
      'other',
    ]);
  });

  it('accepts known reasons and rejects unknown keys', () => {
    expect(isReportReason('harassment')).toBe(true);
    expect(isReportReason('spam')).toBe(true);
    expect(isReportReason('not-a-reason')).toBe(false);
    expect(isReportReason('')).toBe(false);
  });
});
