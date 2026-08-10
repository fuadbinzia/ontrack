import {
  accessibleAuthError,
  appleNameMetadata,
  CloudAccountError,
  isProviderCancellation,
  oauthCodeFromUrl,
  ProviderCancelledError,
  shouldUseNativeApple,
} from '@/services/cloud/account';

describe('OAuth callback validation', () => {
  const redirect = 'ontrack://auth/callback';

  it('accepts a one-time code only on the expected callback', () => {
    expect(oauthCodeFromUrl(`${redirect}?code=one-time-code`, redirect)).toBe('one-time-code');
  });

  it('accepts the Android triple-slash custom-scheme form', () => {
    expect(oauthCodeFromUrl('ontrack:///auth/callback?code=one-time-code', redirect)).toBe(
      'one-time-code',
    );
  });

  it.each([
    ['malformed callback', 'not a url'],
    ['wrong originating route', 'ontrack://other/callback?code=code'],
    ['missing code', redirect],
  ])('rejects %s', (_label, url) => {
    expect(() => oauthCodeFromUrl(url, redirect)).toThrow(CloudAccountError);
  });

  it('surfaces provider callback failures without accepting a code', () => {
    expect(() =>
      oauthCodeFromUrl(
        `${redirect}?error=access_denied&error_description=Provider%20declined`,
        redirect,
      ),
    ).toThrow('Provider declined');
  });
});

describe('provider dispatch and cancellation', () => {
  it('uses native Apple only on iOS and browser OAuth for all other combinations', () => {
    expect(shouldUseNativeApple('apple', 'ios')).toBe(true);
    expect(shouldUseNativeApple('apple', 'android')).toBe(false);
    expect(shouldUseNativeApple('apple', 'web')).toBe(false);
    expect(shouldUseNativeApple('google', 'ios')).toBe(false);
  });

  it('treats browser and native provider cancellation as neutral outcomes', () => {
    expect(isProviderCancellation(new ProviderCancelledError())).toBe(true);
    expect(isProviderCancellation({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(isProviderCancellation({ code: 'ERR_CANCELED' })).toBe(true);
    expect(isProviderCancellation(new Error('network failed'))).toBe(false);
  });
});

describe('Apple first-login metadata', () => {
  it('captures the one-time Apple name in Supabase metadata shape', () => {
    expect(appleNameMetadata({ givenName: ' Ada ', familyName: 'Lovelace ' })).toEqual({
      full_name: 'Ada Lovelace',
      given_name: 'Ada',
      family_name: 'Lovelace',
    });
  });

  it('does not overwrite metadata when Apple returns no name', () => {
    expect(appleNameMetadata({ givenName: null, familyName: null })).toBeUndefined();
  });
});

describe('accessible authentication errors', () => {
  it('maps network, configuration, and callback errors to actionable copy', () => {
    expect(accessibleAuthError(new Error('Failed to fetch'))).toContain('offline');
    expect(accessibleAuthError(new Error('Cloud sync is not configured'))).toContain(
      'continue as a guest',
    );
    expect(accessibleAuthError(new Error('The callback was malformed'))).toContain(
      'invalid or expired',
    );
  });

  it('maps schema and constraint failures to actionable copy', () => {
    expect(
      accessibleAuthError({
        code: '23514',
        message: 'new row for relation "app_state" violates check constraint "app_state_domain_check"',
      }),
    ).toContain('database update');
    expect(
      accessibleAuthError({
        code: '23514',
        message: 'new row violates check constraint "other_check"',
      }),
    ).toContain('could not save');
  });
});
