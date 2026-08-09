import {
    dismissForceWelcomePreview,
    isForceShowWelcomeEnabled,
    resetForceWelcomePreviewForTests,
    shouldShowWelcome,
} from '@/features/auth/welcome-preview';

describe('isForceShowWelcomeEnabled', () => {
  it('is true only in __DEV__ when the env value is true', () => {
    expect(isForceShowWelcomeEnabled('true', true)).toBe(true);
    expect(isForceShowWelcomeEnabled(' TRUE ', true)).toBe(true);
  });

  it('ignores the env outside __DEV__ and rejects non-true values', () => {
    expect(isForceShowWelcomeEnabled('true', false)).toBe(false);
    expect(isForceShowWelcomeEnabled('false', true)).toBe(false);
    expect(isForceShowWelcomeEnabled('1', true)).toBe(false);
    expect(isForceShowWelcomeEnabled(undefined, true)).toBe(false);
  });
});

describe('shouldShowWelcome', () => {
  beforeEach(() => {
    resetForceWelcomePreviewForTests();
  });

  it('shows for first-run even when force is off', () => {
    expect(shouldShowWelcome(false, false)).toBe(true);
  });

  it('hides for onboarded users unless force is on', () => {
    expect(shouldShowWelcome(true, false)).toBe(false);
    expect(shouldShowWelcome(true, true)).toBe(true);
  });

  it('stops force-preview after a session dismiss', () => {
    expect(shouldShowWelcome(true, true)).toBe(true);
    dismissForceWelcomePreview();
    expect(shouldShowWelcome(true, true)).toBe(false);
  });

  it('keeps the first-run canvas off for onboarded devices when force is off', () => {
    // Sign-out preserves hasOnboarded; with force off this must stay false so
    // /welcome renders AuthScreen instead of the name/goal canvas.
    expect(shouldShowWelcome(true, false, false)).toBe(false);
  });
});
