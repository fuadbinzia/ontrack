import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    travelMapOverlayConfirmIds,
    travelMapOverlayPickerIds,
} from '../travel-map-overlay-picker';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

const friends = [
  { userId: 'friend-alex' },
  { userId: 'friend-jordan' },
  { userId: 'friend-riley' },
];

describe('travel map overlay friend picker', () => {
  it('still lists accepted friends when none of them are sharing a map', () => {
    const { excludeIds, disabledIds } = travelMapOverlayPickerIds({
      friends,
      sharingUserIds: [],
      selectedFriendIds: [],
    });

    expect(excludeIds).toEqual([]);
    expect(disabledIds).toEqual([
      'friend-alex',
      'friend-jordan',
      'friend-riley',
    ]);
  });

  it('only hides friends already on the map, not friends who have not shared', () => {
    const { excludeIds, disabledIds } = travelMapOverlayPickerIds({
      friends,
      sharingUserIds: ['friend-jordan'],
      selectedFriendIds: ['friend-jordan'],
    });

    expect(excludeIds).toEqual(['friend-jordan']);
    expect(disabledIds).toEqual(['friend-alex', 'friend-riley']);
  });

  it('keeps sharing friends selectable when they are not already overlaid', () => {
    const { excludeIds, disabledIds } = travelMapOverlayPickerIds({
      friends,
      sharingUserIds: ['friend-alex', 'friend-jordan'],
      selectedFriendIds: [],
    });

    expect(excludeIds).toEqual([]);
    expect(disabledIds).toEqual(['friend-riley']);
  });

  it('confirms only friends who are currently sharing a map', () => {
    expect(
      travelMapOverlayConfirmIds(
        ['friend-alex', 'friend-riley'],
        ['friend-jordan', 'friend-riley'],
        ['friend-jordan'],
      ),
    ).toEqual(['friend-jordan', 'friend-riley']);
  });

  it('loads friend profiles even if the owner map pull fails', () => {
    const hook = read('src/features/travel/map/use-travel-map-collaboration.ts');
    expect(hook).not.toContain('Promise.all([');
    expect(hook).toContain('void pullMyTravelMap()');
    expect(hook).toContain('void listVisibleFriendMapProfiles()');
  });
});
