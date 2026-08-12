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

  it('contains native bridge failures instead of creating unhandled promises', () => {
    const hook = readFileSync(
      join(process.cwd(), 'src/features/todos/use-voice-lists-sync.ts'),
      'utf8',
    );

    expect(hook).toMatch(/applyVoicePendingOps\(\)[\s\S]*?\.catch\(\(\) => undefined\)/);
    expect(hook).toContain('publishVoiceSnapshot().catch(() => undefined)');
  });
});
