import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  travelMapOverlayConfirmIds,
  travelMapOverlayEmptyCopy,
  travelMapOverlayPickerState,
} from '../travel-map-overlay-picker';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

const friends = [
  { userId: 'friend-alex' },
  { userId: 'friend-jordan' },
  { userId: 'friend-riley' },
];

describe('travel map overlay friend picker', () => {
  it('hides accepted friends who are not sharing and explains the empty list', () => {
    const state = travelMapOverlayPickerState({
      friends,
      sharingUserIds: [],
      selectedFriendIds: [],
    });

    expect(state).toEqual({
      includeIds: [],
      excludeIds: [],
      showSearch: false,
      emptyKind: 'none-sharing',
    });
    expect(travelMapOverlayEmptyCopy('none-sharing')).toEqual({
      icon: 'globe',
      title: 'Waiting On Their Maps',
      message: expect.stringContaining('Share My Map'),
    });
  });

  it('lists only sharing friends who are not already on the map', () => {
    expect(
      travelMapOverlayPickerState({
        friends,
        sharingUserIds: ['friend-jordan', 'friend-riley'],
        selectedFriendIds: ['friend-jordan'],
      }),
    ).toEqual({
      includeIds: ['friend-jordan', 'friend-riley'],
      excludeIds: ['friend-jordan'],
      showSearch: true,
      emptyKind: null,
    });
  });

  it('says the maps are already overlaid when every sharing friend is selected', () => {
    expect(
      travelMapOverlayPickerState({
        friends,
        sharingUserIds: ['friend-jordan'],
        selectedFriendIds: ['friend-jordan'],
      }),
    ).toMatchObject({
      showSearch: false,
      emptyKind: 'all-overlaid',
    });
  });

  it('asks the user to add friends when the social list is empty', () => {
    expect(
      travelMapOverlayPickerState({
        friends: [],
        sharingUserIds: [],
        selectedFriendIds: [],
      }).emptyKind,
    ).toBe('no-friends');
    expect(travelMapOverlayEmptyCopy('no-friends').title).toBe('Invite a Friend First');
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

  it('deduplicates ids when selected friends and picked friends overlap', () => {
    expect(
      travelMapOverlayConfirmIds(
        ['friend-riley', 'friend-jordan', 'friend-riley'],
        ['friend-jordan', 'friend-riley'],
        ['friend-jordan', 'friend-riley'],
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
