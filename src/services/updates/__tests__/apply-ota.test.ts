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
});

describe('otaReloadPlanForOs', () => {
  it('reloads Android in-session and defers iOS until background', () => {
    expect(otaReloadPlanForOs('android')).toBe('immediate');
    expect(otaReloadPlanForOs('ios')).toBe('on-background');
    expect(otaReloadPlanForOs('web')).toBe('next-cold-start');
  });
});

describe('otaAppStateAction', () => {
  it('reloads iOS only after a downloaded update is backgrounded', () => {
    expect(otaAppStateAction('background', true)).toBe('reload');
    expect(otaAppStateAction('background', false)).toBe('none');
    expect(otaAppStateAction('inactive', true)).toBe('none');
    expect(otaAppStateAction('active', true)).toBe('none');
    expect(otaAppStateAction('active', false)).toBe('check');
  });
});
