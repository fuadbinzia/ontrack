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

import {
  deleteJournalVoice,
  persistJournalVoice,
  resolveJournalVoiceUri,
} from '../voice-persist';

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

  it('re-anchors a stale container URI to the current documents directory', () => {
    const stale =
      'file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/journal-voice/voice-abc.m4a';
    expect(resolveJournalVoiceUri(stale)).toBe('/documents/journal-voice/voice-abc.m4a');
  });

  it('resolves a current-container URI to the same file name', () => {
    const current = '/documents/journal-voice/voice-abc.m4a';
    expect(resolveJournalVoiceUri(current)).toBe(current);
  });

  it('leaves non journal-voice URIs unchanged', () => {
    expect(resolveJournalVoiceUri('file:///tmp/Recorder.m4a')).toBe(
      'file:///tmp/Recorder.m4a',
    );
    expect(resolveJournalVoiceUri('ontrack-media:abc')).toBe('ontrack-media:abc');
  });

  it('does not re-anchor when a nested path follows the voice directory', () => {
    const nested = 'file:///old/Documents/journal-voice/sub/voice.m4a';
    expect(resolveJournalVoiceUri(nested)).toBe(nested);
  });

  it('deletes through the re-anchored path so stale references still clean up', async () => {
    await deleteJournalVoice(
      'file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/journal-voice/voice-abc.m4a',
    );
    expect(mockDelete).toHaveBeenCalled();
  });
});
