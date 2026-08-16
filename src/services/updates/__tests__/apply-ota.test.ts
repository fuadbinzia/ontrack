import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    applyAvailableOtaUpdate,
    otaAppStateAction,
    otaReloadPlanForOs,
    type OtaUpdatesClient,
} from '../apply-ota';

function client(partial: Partial<OtaUpdatesClient> = {}): OtaUpdatesClient {
  return {
    isEnabled: true,
    checkForUpdateAsync: async () => ({ isAvailable: false }),
    fetchUpdateAsync: async () => ({ isNew: false }),
    ...partial,
  };
}

describe('applyAvailableOtaUpdate', () => {
  it('skips when updates are disabled', async () => {
    const fetchUpdateAsync = jest.fn(async () => ({ isNew: true }));
    await expect(
      applyAvailableOtaUpdate(client({ isEnabled: false, fetchUpdateAsync })),
    ).resolves.toBe('skipped');
    expect(fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('noops when no update is available', async () => {
    const fetchUpdateAsync = jest.fn(async () => ({ isNew: true }));
    await expect(
      applyAvailableOtaUpdate(client({ fetchUpdateAsync })),
    ).resolves.toBe('noop');
    expect(fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('fetches and returns downloaded without reloading', async () => {
    const fetchUpdateAsync = jest.fn(async () => ({ isNew: true }));
    await expect(
      applyAvailableOtaUpdate(
        client({
          checkForUpdateAsync: async () => ({ isAvailable: true }),
          fetchUpdateAsync,
        }),
      ),
    ).resolves.toBe('downloaded');
    expect(fetchUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('does not treat a stale fetch as downloaded', async () => {
    await expect(
      applyAvailableOtaUpdate(
        client({
          checkForUpdateAsync: async () => ({ isAvailable: true }),
          fetchUpdateAsync: async () => ({ isNew: false }),
        }),
      ),
    ).resolves.toBe('noop');
  });

  it('treats a native pending update as downloaded without another fetch', async () => {
    const checkForUpdateAsync = jest.fn(async () => ({ isAvailable: false }));
    const fetchUpdateAsync = jest.fn(async () => ({ isNew: false }));
    await expect(
      applyAvailableOtaUpdate(
        client({
          isUpdatePending: () => true,
          checkForUpdateAsync,
          fetchUpdateAsync,
        }),
      ),
    ).resolves.toBe('downloaded');
    expect(checkForUpdateAsync).not.toHaveBeenCalled();
    expect(fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('still applies when fetch reports stale but native already has a pending update', async () => {
    let pending = false;
    await expect(
      applyAvailableOtaUpdate(
        client({
          isUpdatePending: () => pending,
          checkForUpdateAsync: async () => ({ isAvailable: true }),
          fetchUpdateAsync: async () => {
            pending = true;
            return { isNew: false };
          },
        }),
      ),
    ).resolves.toBe('downloaded');
  });

  it('applies when the check finds nothing but a pending update landed during the check', async () => {
    let pending = false;
    await expect(
      applyAvailableOtaUpdate(
        client({
          isUpdatePending: () => pending,
          checkForUpdateAsync: async () => {
            pending = true;
            return { isAvailable: false };
          },
        }),
      ),
    ).resolves.toBe('downloaded');
  });
});

describe('otaReloadPlanForOs', () => {
  it('reloads Android in-session and defers iOS until background', () => {
    expect(otaReloadPlanForOs('android')).toBe('immediate');
    expect(otaReloadPlanForOs('ios')).toBe('on-background');
    expect(otaReloadPlanForOs('web')).toBe('next-cold-start');
  });
});

describe('otaAppStateAction', () => {
  it('reloads iOS when leaving the foreground, including app-switcher inactive', () => {
    expect(otaAppStateAction('inactive', true)).toBe('reload');
    expect(otaAppStateAction('background', true)).toBe('reload');
    expect(otaAppStateAction('background', false)).toBe('none');
    expect(otaAppStateAction('inactive', false)).toBe('none');
    expect(otaAppStateAction('active', true)).toBe('none');
    expect(otaAppStateAction('active', false)).toBe('check');
  });
});

describe('useApplyOtaUpdate apply contract', () => {
  it('honors native pending updates and does not drop an iOS reload if reloadAsync fails', () => {
    const hook = readFileSync(
      join(__dirname, '../../../hooks/use-apply-ota-update.ts'),
      'utf8',
    );
    expect(hook).toContain('useUpdates');
    expect(hook).toContain('isUpdatePending');
    expect(hook).toContain('isUpdatePendingRef');
    expect(hook).not.toContain('pendingBackgroundReloadRef.current = false');
    expect(hook).toContain('reloadingRef');
  });
});
