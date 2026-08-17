import {
    parseRpcJsonArray,
    parseTravelMapFriendProfiles,
} from '../travel-map-collaboration';

describe('travel map friend profile parsing', () => {
  it('keeps camelCase RPC rows that already share a map', () => {
    expect(
      parseTravelMapFriendProfiles([
        { userId: 'friend-alex', displayName: 'Alex Rivera' },
      ]),
    ).toEqual([
      expect.objectContaining({
        userId: 'friend-alex',
        displayName: 'Alex Rivera',
      }),
    ]);
  });

  it('still lists friends when PostgREST returns a stringified jsonb array', () => {
    expect(
      parseTravelMapFriendProfiles(
        JSON.stringify([
          { userId: 'friend-jordan', displayName: 'Jordan Lee' },
        ]),
      ),
    ).toEqual([
      expect.objectContaining({
        userId: 'friend-jordan',
        displayName: 'Jordan Lee',
      }),
    ]);
  });

  it('accepts snake_case keys and a missing display name', () => {
    expect(
      parseTravelMapFriendProfiles([
        { user_id: 'friend-riley', display_name: '  ' },
      ]),
    ).toEqual([
      expect.objectContaining({
        userId: 'friend-riley',
        displayName: 'Friend',
      }),
    ]);
  });

  it('drops rows without a user id', () => {
    expect(
      parseTravelMapFriendProfiles([{ displayName: 'Alex Rivera' }, null]),
    ).toEqual([]);
  });
});

describe('travel map RPC array coercion', () => {
  it('returns an empty list for non-array payloads', () => {
    expect(parseRpcJsonArray({ userId: 'friend-alex' })).toEqual([]);
    expect(parseRpcJsonArray('{"userId":"friend-alex"}')).toEqual([]);
    expect(parseRpcJsonArray('not-json')).toEqual([]);
  });
});
