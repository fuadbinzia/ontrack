import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('travel map country header contract', () => {
  it('keeps back and city search without a redundant close action', () => {
    const screen = read('src/features/travel/map/travel-map-screen.tsx');

    expect(screen).toContain('testID={AgentUiIds.travel.map.backToWorld}');
    expect(screen).toContain('testID={AgentUiIds.travel.map.citySearchOpen}');
    expect(screen.match(/testID={AgentUiIds\.travel\.map\.close}/g)).toHaveLength(1);
  });
});
