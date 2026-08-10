import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('trackers screen contract', () => {
  it('keeps Sections chrome on glass with agent-ui stamps', () => {
    const screen = read('src/features/trackers/trackers-screen.tsx');
    const route = read('src/app/(tabs)/trackers.tsx');
    expect(route).toContain('TrackersScreen');
    expect(screen).toContain('GlassPlate');
    expect(screen).toContain('GlassIconWell');
    expect(screen).toContain('AgentUiIds');
    expect(screen).not.toContain('surface="solid"');
    expect(screen).not.toContain('backgroundElevated');
    expect(screen).toContain('splitTrackerOrder');
    expect(screen).toContain('NAV_PIN_LIMIT');
  });
});
