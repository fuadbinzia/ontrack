import { accountProviderLabel } from '../account-provider-label';

describe('accountProviderLabel', () => {
  it('falls back when no SSO metadata is present', () => {
    expect(accountProviderLabel(undefined)).toBe('Existing account');
    expect(accountProviderLabel({})).toBe('Existing account');
  });

  it('prefers the provider recorded for this sign-in', () => {
    expect(
      accountProviderLabel(
        {
          app_metadata: { provider: 'apple', providers: ['apple', 'google'] },
          identities: [
            { provider: 'apple', last_sign_in_at: '2026-08-09T12:00:00.000Z' },
            { provider: 'google', last_sign_in_at: '2026-01-01T00:00:00.000Z' },
          ],
        },
        'google',
      ),
    ).toBe('Signed in via Google');
  });

  it('uses first-signup provider when identities are absent', () => {
    expect(
      accountProviderLabel({ app_metadata: { provider: 'apple' } }),
    ).toBe('Signed in via Apple');
  });

  it('shows only the most recently used identity when none was recorded', () => {
    expect(
      accountProviderLabel({
        app_metadata: { provider: 'apple', providers: ['apple', 'google'] },
        identities: [
          { provider: 'apple', last_sign_in_at: '2026-01-01T00:00:00.000Z' },
          { provider: 'google', last_sign_in_at: '2026-08-09T00:00:00.000Z' },
        ],
      }),
    ).toBe('Signed in via Google');
  });
});
