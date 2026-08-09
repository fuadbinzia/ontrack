import { resolveSelfDisplayName } from '@/features/account/self-display-name';

describe('resolveSelfDisplayName', () => {
  it('prefers preferences name', () => {
    expect(
      resolveSelfDisplayName({
        preferencesName: 'Alex Rivera',
        user: {
          email: 'alex.rivera@example.com',
          user_metadata: { full_name: 'Other' },
        },
      }),
    ).toBe('Alex Rivera');
  });

  it('skips placeholder You and uses SSO metadata', () => {
    expect(
      resolveSelfDisplayName({
        preferencesName: 'You',
        user: {
          email: 'alex.rivera@example.com',
          user_metadata: { full_name: 'Alex Rivera' },
        },
      }),
    ).toBe('Alex Rivera');
  });

  it('falls back to email local-part', () => {
    expect(
      resolveSelfDisplayName({
        preferencesName: '',
        user: { email: 'alex.rivera@example.com', user_metadata: {} },
      }),
    ).toBe('alex.rivera');
  });

  it('defaults to Guest when nothing else is available', () => {
    expect(resolveSelfDisplayName({ preferencesName: '', user: null })).toBe(
      'Guest',
    );
  });
});
