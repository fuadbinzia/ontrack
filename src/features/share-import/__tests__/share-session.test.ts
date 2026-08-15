import fs from 'node:fs';
import path from 'node:path';

import {
  hasIncomingSharePayloads,
  shouldConfirmShareDiscard,
} from '../share-session';

const payload = {
  value: 'Dinner tomorrow at 7',
  shareType: 'text' as const,
  mimeType: 'text/plain',
};

describe('incoming share session lifecycle', () => {
  it('does not confirm discard when a cleared share route is restored after restart', () => {
    expect(hasIncomingSharePayloads([])).toBe(false);
    expect(shouldConfirmShareDiscard([], false)).toBe(false);
  });

  it('still protects active shared content from accidental navigation', () => {
    expect(shouldConfirmShareDiscard([payload], false)).toBe(true);
    expect(shouldConfirmShareDiscard([payload], true)).toBe(false);
  });

  it('initializes the screen leave guard from the native payload state', () => {
    const screen = fs.readFileSync(
      path.resolve(__dirname, '../../../app/share-import.tsx'),
      'utf8',
    );
    expect(screen).toContain('useRef(!hasIncomingSharePayloads(payloads))');
    expect(screen).toContain('if (!hasIncomingSharePayloads(payloads))');
    expect(screen).toContain('shouldConfirmShareDiscard(payloads, allowLeave.current)');
    expect(screen).toContain('appPrompt.dismiss()');
    expect(screen).toContain("router.replace('/')");
  });
});
