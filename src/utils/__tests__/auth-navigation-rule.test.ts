import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('authentication navigation invariants', () => {
  const rootLayout = readFileSync(join(process.cwd(), 'src/app/_layout.tsx'), 'utf8');
  const tabsLayout = readFileSync(
    join(process.cwd(), 'src/app/(tabs)/_layout.tsx'),
    'utf8',
  );
  const authProvider = readFileSync(
    join(process.cwd(), 'src/features/auth/auth-provider.tsx'),
    'utf8',
  );
  const authEffects = readFileSync(
    join(process.cwd(), 'src/features/auth/auth-provider-effects.ts'),
    'utf8',
  );
  const authSnapshot = readFileSync(
    join(process.cwd(), 'src/features/auth/auth-session-snapshot.ts'),
    'utf8',
  );
  const authSources = `${authProvider}\n${authEffects}\n${authSnapshot}`;

  it('keeps the OAuth callback outside protected route groups', () => {
    expect(rootLayout).toContain('name="auth/callback"');
    const protectedGroups = rootLayout.match(/<Stack\.Protected[\s\S]*?<\/Stack\.Protected>/g) ?? [];
    expect(protectedGroups.every((group) => !group.includes('name="auth/callback"'))).toBe(true);
  });

  it('protects welcome, conflict resolution, and app routes with distinct guards', () => {
    expect(rootLayout).toContain('<Stack.Protected guard={welcomeAccess}>');
    expect(rootLayout).toContain("<Stack.Protected guard={phase === 'resolving-data'}>");
    expect(rootLayout).toContain('<Stack.Protected guard={appAccess}>');
  });

  it('keeps the name/goal canvas behind shouldShowWelcome on /welcome', () => {
    const welcome = readFileSync(join(process.cwd(), 'src/app/welcome.tsx'), 'utf8');
    expect(welcome).toContain('useShouldShowWelcome');
    expect(welcome).toContain('WelcomeOnboardScreen');
    expect(welcome).toContain('<AuthScreen variant="welcome" returnTo={returnTo} />');
  });

  it('keeps every user-facing app route in the authenticated-or-guest group', () => {
    const appGroup = rootLayout.match(
      /<Stack\.Protected guard=\{appAccess\}>([\s\S]*?)<\/Stack\.Protected>/,
    )?.[1];
    expect(appGroup).toBeDefined();
    for (const route of [
      '(tabs)',
      'account',
      'onboarding',
      'agents',
      'nutrition-profile',
    ]) {
      expect(appGroup).toContain(`name="${route}"`);
    }
    for (const route of [
      'profile',
      'workouts',
      'plants',
      'travel',
      'vision-board',
      'games',
      'vehicles',
    ]) {
      expect(tabsLayout).toContain(`<Tabs.Screen name="${route}"`);
    }
  });

  it('hosts guest upgrade sign-in on root /account outside the tab dock', () => {
    const account = readFileSync(join(process.cwd(), 'src/app/account.tsx'), 'utf8');
    const profileAccount = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/profile/account.tsx'),
      'utf8',
    );
    expect(account).toContain('AuthScreen');
    expect(account).toContain('variant="upgrade"');
    expect(account).not.toContain('Redirect');
    expect(profileAccount).toContain('Redirect');
    expect(profileAccount).toContain("href=\"/account\"");
  });

  it('holds the static loading shell until hydration and account resolution finish', () => {
    expect(rootLayout).toContain("if (!hydrated || phase === 'loading')");
    expect(rootLayout).toContain('AppBootLoader');
    expect(rootLayout).toContain('SplashScreen');
    expect(rootLayout.indexOf("if (!hydrated || phase === 'loading')")).toBeLessThan(
      rootLayout.indexOf('<Stack'),
    );
  });

  it('waits for vision board and health persistence before releasing the loading shell', () => {
    const hydrated = readFileSync(
      join(process.cwd(), 'src/hooks/use-hydrated.ts'),
      'utf8',
    );
    expect(hydrated).toContain("from '@/store/vision-board'");
    expect(hydrated).toContain('useVisionBoard.persist.rehydrate()');
    expect(hydrated).toContain('useHealth.persist.rehydrate()');
    expect(hydrated).toContain('useJournal.persist.rehydrate()');
    // Never seal while rehydrates are still in flight (no timeout escape hatch).
    expect(hydrated).not.toContain('setTimeout(release');
    expect(hydrated).not.toContain('HYDRATION_TIMEOUT_MS');
    expect(hydrated).not.toContain('Promise.race');
  });

  it('keeps hydration sticky across Fast Refresh remounts without sealing aborted boots', () => {
    const hydrated = readFileSync(
      join(process.cwd(), 'src/hooks/use-hydrated.ts'),
      'utf8',
    );
    expect(hydrated).toContain('sessionHydrated');
    expect(hydrated).toContain('useState(sessionHydrated)');
    expect(hydrated).toContain('if (!active) return');
  });

  it('restores the selected section after a Fast Refresh stack remount', () => {
    expect(rootLayout).toContain('NavigationSessionSync');
    expect(authSources).toContain('getSessionAuthSnapshot');
    expect(authSources).toContain("phase: snap?.phase ?? 'loading'");
  });

  it('does not demote sticky auth phases on getSession timeout', () => {
    expect(authEffects).toContain("current === 'resolving-data'");
    expect(authSnapshot).toContain(
      "phase === 'guest' || phase === 'authenticated' || phase === 'resolving-data'",
    );
  });

  it('keeps guest dirty tracking through auth-upgrade phases', () => {
    const guestDirty = readFileSync(
      join(process.cwd(), 'src/features/auth/auth-guest-dirty.ts'),
      'utf8',
    );
    expect(authEffects).toContain("!guestEnabled || phase === 'authenticated' || phase === 'welcome'");
    expect(authEffects).toContain('subscribeGuestDirtyStores()');
    expect(guestDirty).toContain('useVehicles.subscribe(mark)');
    expect(guestDirty).toContain('useRecipes.subscribe(mark)');
    expect(guestDirty).toContain('useFoodProfile.subscribe(mark)');
  });

  it('returns cancelled provider sign-in to the login gate, never auto-guest', () => {
    const authProvider = readFileSync(
      join(process.cwd(), 'src/features/auth/auth-provider.tsx'),
      'utf8',
    );
    expect(authProvider).toContain('authCancelPhase');
    expect(authProvider).toContain('isProviderCancellation(providerError)');
    // Cancel / dismiss must not reuse boot fallbackPhase (that can enter guest).
    const cancelBlock = authProvider.match(
      /if \(isProviderCancellation\(providerError\)\) \{[\s\S]*?\} else \{/,
    )?.[0];
    expect(cancelBlock).toBeDefined();
    expect(cancelBlock).toContain('authCancelPhase');
    expect(cancelBlock).not.toContain('fallbackPhase');
  });

  it('gates app routes on settled guest or authenticated phases only', () => {
    expect(rootLayout).toContain("phase === 'authenticated' || phase === 'guest'");
  });
});
