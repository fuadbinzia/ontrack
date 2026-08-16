import { restoreBackup } from '../backup-actions';
import type { OnTrackBackup } from '../backup-archive';

const mockApplyBackup = jest.fn();
const mockFlushCloudSync = jest.fn(async () => undefined);
const mockStartSubscriptions = jest.fn();
const mockStop = jest.fn();

jest.mock('../backup-archive', () => ({
  applyBackup: (...args: unknown[]) => mockApplyBackup(...args),
}));
jest.mock('@/services/cloud/sync', () => ({
  flushCloudSync: (...args: unknown[]) => mockFlushCloudSync(...args),
}));
jest.mock('@/services/cloud/sync-session', () => ({
  startSubscriptions: (...args: unknown[]) => mockStartSubscriptions(...args),
  syncRuntime: {
    stopSubscriptions: () => mockStop(),
    activeUserId: 'user-1',
    activeEmail: 'alex@example.com',
  },
}));

const backup = {
  kind: 'ontrack.backup',
  version: 1,
  createdAt: '2026-08-16T00:00:00.000Z',
  appVersion: '1.0.0',
  domains: {},
  local: {},
} as OnTrackBackup;

describe('restoreBackup', () => {
  beforeEach(() => {
    mockApplyBackup.mockClear();
    mockFlushCloudSync.mockClear();
    mockStartSubscriptions.mockClear();
    mockStop.mockClear();
  });

  it('stops cloud pull before replacing data, then pushes the restored copy', async () => {
    await restoreBackup(backup, { pushCloud: true });
    expect(mockStop).toHaveBeenCalled();
    expect(mockApplyBackup).toHaveBeenCalledWith(backup);
    expect(mockFlushCloudSync).toHaveBeenCalled();
    expect(mockStartSubscriptions).not.toHaveBeenCalled();
  });
});
