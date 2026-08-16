import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import {
  applyBackup,
  backupFileName,
  buildBackup,
  parseBackup,
  serializeBackup,
} from '../backup-archive';
import { useJournal } from '@/store/journal';
import { useTodos } from '@/store/todos';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async () => 'test-backup-encryption-key'),
  setItemAsync: jest.fn(async () => undefined),
}));
jest.mock('@/features/journal/voice-persist', () => ({
  deleteJournalVoice: jest.fn(async () => undefined),
}));
jest.mock('@/features/account/release-notes-format', () => ({
  getAppVersion: () => '1.0.0-test',
}));

describe('user-owned backup archive', () => {
  beforeEach(() => {
    useJournal.getState().reset();
    useTodos.getState().reset();
  });

  it('names backup files with a filesystem-safe timestamp', () => {
    expect(backupFileName(new Date('2026-08-16T18:22:05.123Z'))).toBe(
      'onTrack-backup-2026-08-16-18-22-05.json',
    );
  });

  it('round-trips journal text that cloud sync does not store', () => {
    useJournal.getState().addText('2026-08-16', 'Keep this page');
    const backup = buildBackup('2026-08-16T18:00:00.000Z');
    expect(backup.kind).toBe('ontrack.backup');
    expect(backup.local.journal?.pages[0]?.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'text', text: 'Keep this page' })]),
    );

    useJournal.getState().reset();
    expect(useJournal.getState().pages).toEqual([]);
    applyBackup(backup);
    expect(useJournal.getState().pages[0]?.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'text', text: 'Keep this page' })]),
    );
  });

  it('includes private checklist data and restores it onto an empty store', () => {
    const list = useTodos.getState().createList('Packing');
    useTodos.getState().addTask(list!.id, 'Passport');
    const json = serializeBackup(buildBackup());
    expect(json).toContain('Packing');
    expect(json).toContain('Passport');
    expect(json).not.toMatch(/refresh_token|access_token|ciphertext/i);

    useTodos.getState().reset();
    applyBackup(parseBackup(json));
    expect(useTodos.getState().lists.some((list) => list.name === 'Packing')).toBe(true);
    expect(useTodos.getState().tasks.some((task) => task.title === 'Passport')).toBe(true);
  });

  it('writes restored domains without restarting cloud pull subscriptions', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/features/account/backup-archive.ts'),
      'utf8',
    );
    expect(source).toContain('domain.write(payload)');
    expect(source).not.toContain('restoreSyncedDomains');
    expect(source).not.toContain('startSubscriptions');
  });

  it('rejects files that are not onTrack backups', () => {
    expect(() => parseBackup('{')).toThrow('This file is not a readable onTrack backup.');
    expect(() => parseBackup(JSON.stringify({ kind: 'notes', version: 1 }))).toThrow(
      'This file is not an onTrack backup.',
    );
    expect(() => parseBackup(JSON.stringify({
      kind: 'ontrack.backup',
      version: 2,
      createdAt: '2026-08-16T00:00:00.000Z',
    }))).toThrow('newer onTrack');
  });
});
