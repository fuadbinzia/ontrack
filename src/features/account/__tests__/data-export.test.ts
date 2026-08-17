import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { useHealth } from '@/store/health';
import { useJournal } from '@/store/journal';

import {
    ONTRACK_DATA_EXPORT_KIND,
    buildDataExport,
    dataExportFileName,
    serializeDataExport,
} from '../data-export';

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

describe('download my data export', () => {
  beforeEach(() => {
    useJournal.getState().reset();
    useHealth.getState().reset();
  });

  it('pretty-prints per-domain JSON including health and journal', () => {
    useJournal.getState().addText('2026-08-17', 'Private diary');
    useHealth.getState().addCustomEmotion('Sparkly', 2);

    const exportPayload = buildDataExport('2026-08-17T12:00:00.000Z');
    expect(exportPayload.local.journal?.pages[0]?.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'text', text: 'Private diary' }),
      ]),
    );
    expect(exportPayload.local.health?.emotions.some((emotion) => emotion.name === 'Sparkly')).toBe(
      true,
    );

    const json = serializeDataExport(exportPayload);
    expect(json).toContain(`"kind": "${ONTRACK_DATA_EXPORT_KIND}"`);
    expect(json).toMatch(/\n  "domains":/);
    expect(json).toContain('Private diary');
    expect(dataExportFileName(new Date('2026-08-17T12:00:00.000Z'))).toBe(
      'onTrack-data-export-2026-08-17.json',
    );
  });
});

describe('download my data screen copy', () => {
  it('warns that media bytes are not packed into the JSON', () => {
    const source = readFileSync(join(__dirname, '../download-data-screen.tsx'), 'utf8');
    expect(source).toMatch(/does not embed photos, voice notes, or\s+statement PDFs/i);
    expect(source).toContain('Profile → Backup');
  });
});
