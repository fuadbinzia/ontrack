import { initialAvatarPhotoUrl } from '@/features/account/profile-avatar-media';
import {
    emptyAvatarMeta,
    mergeAvatarOnHydrate,
} from '@/features/account/profile-avatar-model';

describe('mergeAvatarOnHydrate', () => {
  it('keeps a customized local avatar when the cloud row is bare initials', () => {
    const local = { kind: 'icon' as const, iconId: 'mdi:bike', color: '#9A7654' };
    expect(mergeAvatarOnHydrate(local, emptyAvatarMeta())).toEqual(local);
  });

  it('keeps a local photo when the cloud row has not stored one yet', () => {
    const local = {
      kind: 'photo' as const,
      localPhotoUri: 'file:///documents/avatar.jpg',
      color: '#2474A8',
    };
    expect(mergeAvatarOnHydrate(local, emptyAvatarMeta())).toMatchObject({
      kind: 'photo',
      localPhotoUri: 'file:///documents/avatar.jpg',
    });
  });

  it('prefers a customized cloud avatar over a local default', () => {
    const remote = { kind: 'icon' as const, iconId: 'mdi:leaf', color: '#2474A8' };
    expect(mergeAvatarOnHydrate(emptyAvatarMeta(), remote)).toEqual(remote);
  });

  it('uses the local photo on first paint so remount does not flash initials', () => {
    expect(
      initialAvatarPhotoUrl({
        kind: 'photo',
        localPhotoUri: 'file:///documents/avatar.jpg',
      }),
    ).toBe('file:///documents/avatar.jpg');
    expect(initialAvatarPhotoUrl({ kind: 'icon', iconId: 'mdi:bike' })).toBeUndefined();
  });

  it('does not let a stale local photo mask a cloud photo path', () => {
    const local = {
      kind: 'photo' as const,
      localPhotoUri: 'file:///documents/old-guest.jpg',
    };
    const remote = {
      kind: 'photo' as const,
      photoPath: 'user-1/avatar.jpg',
      color: '#2474A8',
    };
    expect(mergeAvatarOnHydrate(local, remote)).toEqual({
      kind: 'photo',
      photoPath: 'user-1/avatar.jpg',
      color: '#2474A8',
    });
  });
});
