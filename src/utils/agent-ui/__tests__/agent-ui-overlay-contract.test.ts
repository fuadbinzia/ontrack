import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'src/utils/agent-ui/AgentUiOverlay.tsx'),
  'utf8',
);

describe('Agent UI overlay native host contract', () => {
  it('does not mount the full-window native layer while overlay paint is disabled', () => {
    const disabledGuard = source.indexOf('if (!enabled) return probe;');
    const nativeOverlay = source.indexOf('<FullWindowOverlay>');

    expect(disabledGuard).toBeGreaterThan(0);
    expect(nativeOverlay).toBeGreaterThan(disabledGuard);
  });

  it('keeps painted target boxes non-interactive when the overlay is enabled', () => {
    expect(source).toContain('pointerEvents="none"');
    expect(source).toContain('pointerEvents="box-none"');
  });
});
