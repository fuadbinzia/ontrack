import { normalizeFinanceSnapshot, normalizeRewardProfile, privateFinancePayload } from '../normalize';

describe('reward profile persistence', () => {
  it('keeps old snapshots backward compatible', () => {
    expect(normalizeFinanceSnapshot({}).rewardProfiles).toEqual([]);
  });

  it('normalizes profiles, source metadata, overrides, and account links', () => {
    const snapshot = normalizeFinanceSnapshot({
      accounts: [{
        id: 'card-account',
        name: 'Card',
        kind: 'card',
        currency: 'USD',
        rewardProfileId: 'reward-card',
      }],
      rewardProfiles: [{
        id: 'reward-card',
        issuer: 'Example Bank',
        name: 'Example Rewards',
        ownership: 'owned',
        rewardCurrency: 'points',
        pointValueCents: 1.5,
        baseMultiplier: 1,
        annualFee: 95,
        rules: [{
          id: 'dining',
          name: 'Dining',
          multiplier: 3,
          categoryIds: ['dining'],
          sourceCategories: ['FOOD_AND_DRINK_RESTAURANTS'],
          capAmount: 500,
          capPeriod: 'month',
          active: true,
        }],
        benefits: [{ id: 'credit', name: 'Credit', faceValue: 100 }],
        source: {
          url: 'https://issuer.example/card',
          hostname: 'issuer.example',
          kind: 'issuer',
          retrievedAt: '2026-08-14T12:00:00.000Z',
          confidence: 3,
          warnings: ['Review terms'],
        },
        editedFields: ['pointValueCents'],
      }],
    });

    expect(snapshot.accounts[0]?.rewardProfileId).toBe('reward-card');
    expect(snapshot.rewardProfiles[0]).toEqual(expect.objectContaining({
      id: 'reward-card',
      editedFields: ['pointValueCents'],
      source: expect.objectContaining({ confidence: 1, kind: 'issuer' }),
    }));
    expect(snapshot.rewardProfiles[0]?.benefits[0]).toEqual(expect.objectContaining({
      userValue: 0,
      enabled: false,
    }));
  });

  it('includes reward profiles and links in the private cloud payload', () => {
    const snapshot = normalizeFinanceSnapshot({
      accounts: [{
        id: 'card-account',
        name: 'Card',
        kind: 'card',
        currency: 'USD',
        rewardProfileId: 'reward-card',
      }],
      rewardProfiles: [{
        id: 'reward-card',
        issuer: 'Example Bank',
        name: 'Example Rewards',
        pointValueCents: 1,
        baseMultiplier: 1,
        annualFee: 0,
      }],
    });
    const payload = privateFinancePayload(snapshot);

    expect(payload.rewardProfiles).toHaveLength(1);
    expect(payload.accounts[0]?.rewardProfileId).toBe('reward-card');
  });

  it('rejects unusable card profiles', () => {
    expect(normalizeRewardProfile({ name: 'Missing rates' })).toBeUndefined();
  });
});
