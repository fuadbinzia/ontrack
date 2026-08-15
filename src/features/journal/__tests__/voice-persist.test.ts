const mockCopy = jest.fn(async () => undefined);
const mockDelete = jest.fn();
const created: string[] = [];

jest.mock('expo-file-system', () => ({
  Paths: { document: '/documents' },
  Directory: class MockDirectory {
    exists = true;
    constructor(_root: string, name: string) {
      created.push(name);
    }
    create() {
      return undefined;
    }
    async delete() {
      mockDelete();
    }
  },
  File: class MockFile {
    uri: string;
    exists = true;
    constructor(uriOrDir: { uri?: string } | string, name?: string) {
      this.uri =
        typeof uriOrDir === 'string'
          ? uriOrDir
          : `${uriOrDir.uri ?? '/documents/journal-voice'}/${name ?? 'file.m4a'}`;
    }
    async copy(dest: { uri: string }) {
      await mockCopy(this.uri, dest.uri);
    }
    delete() {
      mockDelete();
    }
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { persistJournalVoice } from '../voice-persist';

describe('journal voice persist', () => {
  beforeEach(() => {
    mockCopy.mockClear();
    mockDelete.mockClear();
    created.length = 0;
  });

  it('copies a recorder cache URI into journal-voice documents', async () => {
    const uri = await persistJournalVoice('file:///tmp/Recorder.m4a', 'voice-stem');
    expect(created).toContain('journal-voice');
    expect(mockCopy).toHaveBeenCalled();
    expect(uri).toContain('voice-stem.m4a');
    expect(uri).not.toContain('/tmp/Recorder.m4a');
  });
});
