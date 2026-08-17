import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('travel map friend sharing controls', () => {
  it('keeps map sharing inside the friend-overlay sheet', () => {
    const mapScreen = read('src/features/travel/map/travel-map-screen.tsx');
    const mapChrome = read('src/features/travel/map/travel-map-screen-chrome.tsx');
    const peoplePicker = read('src/features/social/people-picker.tsx');
    const sharingRow = read('src/features/travel/map/travel-map-sharing-row.tsx');

    expect(mapScreen).toContain('<TravelMapPeoplePicker');
    expect(mapChrome).toContain('headerContent={');
    expect(mapChrome).toContain('<TravelMapSharingRow');
    expect(mapScreen).not.toContain('<ShareToggle');
    expect(peoplePicker).toContain('{headerContent}');
    expect(sharingRow).toContain('AgentUiIds.travel.map.shareToggle');
    expect(sharingRow).toContain('Accepted friends can see your pins and trip summaries.');
  });

  it('lists only sharing friends and names the empty overlay state', () => {
    const mapChrome = read('src/features/travel/map/travel-map-screen-chrome.tsx');
    expect(mapChrome).toContain('travelMapOverlayPickerState');
    expect(mapChrome).toContain('includeIds={includeIds}');
    expect(mapChrome).toContain('travelMapOverlayEmptyCopy');
    expect(mapChrome).toContain('emptyTestID={AgentUiIds.travel.map.overlayEmpty}');
    expect(mapChrome).not.toContain('disabledIds');
  });

  it('keeps map sharing errors friendly even if the service returns a raw message', () => {
    const mapChrome = read('src/features/travel/map/travel-map-screen-chrome.tsx');
    expect(mapChrome).not.toContain('error.message');
    expect(mapChrome).toContain("Couldn’t update your map sharing setting");
  });
});
