import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('@/utils/optional-expo-audio', () => ({
  loadOptionalExpoAudio: () => undefined,
  recordingOptionsFor: () => ({ extension: '.m4a' }),
}));

describe('journal expo-audio fallback', () => {
  it('loads the journal canvas when expo-audio throws on options.extension', () => {
    expect(() => require('../use-journal-recorder')).not.toThrow();
    expect(() => require('../journal-block-list')).not.toThrow();
  });

  it('does not require expo-audio from journal chrome', () => {
    const roots = [
      join(__dirname, '../use-journal-recorder.ts'),
      join(__dirname, '../journal-block-list.tsx'),
    ];
    for (const file of roots) {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain('loadOptionalExpoAudio');
      expect(source).not.toMatch(/require\(['"]expo-audio['"]\)/);
    }
  });
});
