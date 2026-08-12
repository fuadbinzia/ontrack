import {
  aprBeatsCash,
  DEFAULT_REFERENCE_SAVINGS_APR,
  describeAprVsCash,
  referenceSavingsAprPercent,
} from '../rate-context';

describe('finance rate context', () => {
  it('compares APR to cash reference', () => {
    expect(referenceSavingsAprPercent()).toBe(DEFAULT_REFERENCE_SAVINGS_APR);
    expect(referenceSavingsAprPercent(5)).toBe(5);
    expect(aprBeatsCash(22, 4.25)).toBe(true);
    expect(aprBeatsCash(5, 4.25)).toBe(false);
    expect(describeAprVsCash(24, 4.25)).toMatch(/paying this debt/i);
  });
});
