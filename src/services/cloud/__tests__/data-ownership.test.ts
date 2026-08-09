import { decideAccountData } from '@/services/cloud/data-ownership';

describe('account data ownership', () => {
  it('opens the chooser for a dirty guest upgrade with empty or existing cloud', () => {
    expect(decideAccountData(0, true, true)).toBe('resolve-conflict');
    expect(decideAccountData(1, true, true)).toBe('resolve-conflict');
    expect(decideAccountData(6, true, true)).toBe('resolve-conflict');
  });

  it('promotes device domains for a new account without a dirty guest upgrade', () => {
    expect(decideAccountData(0, false, false)).toBe('upload-device');
    expect(decideAccountData(0, true, false)).toBe('upload-device');
  });

  it('restores cloud data for a pristine guest or an existing persisted session', () => {
    expect(decideAccountData(6, false, false)).toBe('restore-cloud');
    expect(decideAccountData(6, false, true)).toBe('restore-cloud');
    expect(decideAccountData(6, true, false)).toBe('restore-cloud');
  });
});
