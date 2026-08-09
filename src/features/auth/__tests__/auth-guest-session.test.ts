import {
  authCancelPhase,
  guestEntryNeedsSignOut,
  guestShellConflictsWithDiskSession,
} from '@/features/auth/auth-guest-session';

describe('guestEntryNeedsSignOut', () => {
  it('signs out when only a SecureStore session remains after a failed unlock', () => {
    expect(
      guestEntryNeedsSignOut({
        reactSession: false,
        locked: false,
        diskSession: true,
      }),
    ).toBe(true);
  });

  it('signs out for an active React session or locked gate', () => {
    expect(
      guestEntryNeedsSignOut({
        reactSession: true,
        locked: false,
        diskSession: false,
      }),
    ).toBe(true);
    expect(
      guestEntryNeedsSignOut({
        reactSession: false,
        locked: true,
        diskSession: false,
      }),
    ).toBe(true);
  });

  it('skips sign-out for a true guest device', () => {
    expect(
      guestEntryNeedsSignOut({
        reactSession: false,
        locked: false,
        diskSession: false,
      }),
    ).toBe(false);
  });
});

describe('guestShellConflictsWithDiskSession', () => {
  it('flags guest phase when a disk session is still present', () => {
    expect(guestShellConflictsWithDiskSession('guest', true)).toBe(true);
    expect(guestShellConflictsWithDiskSession('guest', false)).toBe(false);
    expect(guestShellConflictsWithDiskSession('authenticated', true)).toBe(false);
  });
});

describe('authCancelPhase', () => {
  it('keeps a cancelled sign-in on the login gate instead of auto-guest', () => {
    expect(authCancelPhase(false)).toBe('welcome');
    expect(authCancelPhase(true)).toBe('locked');
  });
});
