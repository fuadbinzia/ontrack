import { resolveSessionLock } from '@/features/auth/session-lock';

describe('resolveSessionLock', () => {
  const base = { unlocked: false, isDevice: true, staySignedIn: false };

  it('locks a physical device on a fresh launch', () => {
    expect(resolveSessionLock(base)).toBe(true);
  });

  it('never locks simulators or emulators', () => {
    expect(resolveSessionLock({ ...base, isDevice: false })).toBe(false);
  });

  it('honours the Stay signed in developer toggle', () => {
    expect(resolveSessionLock({ ...base, staySignedIn: true })).toBe(false);
  });

  it('stays unlocked for the rest of the launch once the gate is passed', () => {
    expect(resolveSessionLock({ ...base, unlocked: true })).toBe(false);
  });
});
