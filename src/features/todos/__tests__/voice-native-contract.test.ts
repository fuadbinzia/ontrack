import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Siri voice-list native contract', () => {
  it('does not read an unrelated list when the requested kind is missing', () => {
    const store = readFileSync(
      join(
        process.cwd(),
        'modules/ontrack-voice-lists/ios/OnTrackVoiceStore.swift',
      ),
      'utf8',
    );

    expect(store).not.toContain(
      'let match = matchList(lists, hint: listName, kindHint: kindHint) ?? lists[0]',
    );
    expect(store).toContain('missingListMessage(listName: listName, kindHint: kindHint)');
  });

  it('matches exact generic list names before falling back by recency on every platform', () => {
    const swiftStore = readFileSync(
      join(process.cwd(), 'modules/ontrack-voice-lists/ios/OnTrackVoiceStore.swift'),
      'utf8',
    );
    const generatedSwiftStore = readFileSync(
      join(process.cwd(), 'ios/onTrack/OnTrackVoice/OnTrackVoiceStore.swift'),
      'utf8',
    );
    const kotlinStore = readFileSync(
      join(
        process.cwd(),
        'modules/ontrack-voice-lists/android/src/main/java/expo/modules/ontrackvoicelists/OnTrackVoiceStore.kt',
      ),
      'utf8',
    );

    for (const store of [swiftStore, generatedSwiftStore]) {
      expect(store.indexOf('let exactName = hint?')).toBeLessThan(
        store.indexOf('if let query = nameQuery(hint)'),
      );
      expect(store).toContain('$0.name.lowercased() == exactName');
    }
    expect(kotlinStore.indexOf('val exactName = hint?')).toBeLessThan(
      kotlinStore.indexOf('val query = nameQuery(hint)'),
    );
    expect(kotlinStore).toContain('it.name.lowercase() == exactName');
  });

  it('contains native bridge failures instead of creating unhandled promises', () => {
    const hook = readFileSync(
      join(process.cwd(), 'src/features/todos/use-voice-lists-sync.ts'),
      'utf8',
    );

    expect(hook).toMatch(/applyVoicePendingOps\(\)[\s\S]*?\.catch\(\(\) => undefined\)/);
    expect(hook).toContain('publishVoiceSnapshot().catch(() => undefined)');
  });
});
