import {
    consumeNavigationRestorePath,
    getRememberedNavigationPathname,
    isRestorablePathname,
    isTodayPathname,
    isTransientPathname,
    rememberNavigationPathname,
    resetNavigationSessionForTests,
    resolveInitialNavigationPath,
} from '@/utils/navigation-session';

describe('navigation-session', () => {
  beforeEach(() => {
    resetNavigationSessionForTests();
  });

  it('treats Today aliases as the default tab', () => {
    expect(isTodayPathname('/')).toBe(true);
    expect(isTodayPathname('/(tabs)')).toBe(true);
    expect(isTodayPathname('/(tabs)/')).toBe(true);
    expect(isTodayPathname('/travel')).toBe(false);
  });

  it('skips auth and agent shells', () => {
    expect(isTransientPathname('/welcome')).toBe(true);
    expect(isTransientPathname('/auth/callback')).toBe(true);
    expect(isTransientPathname('/onboarding')).toBe(true);
    expect(isTransientPathname('/travel')).toBe(false);
  });

  it('remembers restorable in-app routes', () => {
    rememberNavigationPathname('/travel');
    expect(getRememberedNavigationPathname()).toBe('/travel');
    expect(isRestorablePathname('/travel')).toBe(true);
  });

  it('restores the remembered route once when remounted on Today', () => {
    rememberNavigationPathname('/travel');
    expect(consumeNavigationRestorePath('/')).toBe('/travel');
    expect(consumeNavigationRestorePath('/')).toBeNull();
  });

  it('opens Overview for a cold root launch and Today route aliases', () => {
    expect(resolveInitialNavigationPath('/')).toBe('/overview');
    expect(resolveInitialNavigationPath('/(tabs)')).toBe('/overview');
    expect(resolveInitialNavigationPath('/(today)')).toBe('/overview');
  });

  it('preserves a direct deep link instead of replacing it with Overview', () => {
    expect(resolveInitialNavigationPath('/travel/abc')).toBeNull();
  });

  it('prefers same-session restoration over the Overview default', () => {
    rememberNavigationPathname('/calendar');
    expect(resolveInitialNavigationPath('/')).toBe('/calendar');
  });

  it('does not restore when already on the remembered route', () => {
    rememberNavigationPathname('/travel');
    expect(consumeNavigationRestorePath('/travel')).toBeNull();
  });

  it('clears memory when the user lands on Today after restore bootstrap', () => {
    rememberNavigationPathname('/travel');
    expect(consumeNavigationRestorePath('/')).toBe('/travel');
    rememberNavigationPathname('/');
    expect(getRememberedNavigationPathname()).toBeNull();
    expect(consumeNavigationRestorePath('/')).toBeNull();
  });

  it('ignores transient paths for memory', () => {
    rememberNavigationPathname('/welcome');
    expect(getRememberedNavigationPathname()).toBeNull();
  });
});
