import { useEffect, useState } from 'react';

import {
  flushTravelMapMutations,
  listVisibleFriendMapProfiles,
  loadFriendTravelMaps,
  pullMyTravelMap,
} from '@/services/travel/travel-map-collaboration';

import type { TravelMapFriendLayer, TravelMapFriendProfile } from './types';

export function useTravelMapCollaboration({
  authenticated,
  pendingCount,
  selectedFriendIds,
  onChangeSelectedFriendIds,
}: {
  authenticated: boolean;
  pendingCount: number;
  selectedFriendIds: string[];
  onChangeSelectedFriendIds: (ids: string[]) => void;
}) {
  const [friendProfiles, setFriendProfiles] = useState<
    TravelMapFriendProfile[]
  >([]);
  const [friendLayers, setFriendLayers] = useState<TravelMapFriendLayer[]>([]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void Promise.all([pullMyTravelMap(), listVisibleFriendMapProfiles()])
      .then(([, profiles]) => {
        if (active) setFriendProfiles(profiles);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || pendingCount === 0) return;
    const timeout = setTimeout(() => {
      void flushTravelMapMutations().catch(() => undefined);
    }, 700);
    return () => clearTimeout(timeout);
  }, [authenticated, pendingCount]);

  useEffect(() => {
    if (!authenticated) {
      setFriendLayers([]);
      return;
    }
    const allowed = new Set(friendProfiles.map((profile) => profile.userId));
    const visibleIds = selectedFriendIds.filter((id) => allowed.has(id));
    if (visibleIds.length !== selectedFriendIds.length) {
      onChangeSelectedFriendIds(visibleIds);
    }
    let active = true;
    void loadFriendTravelMaps(visibleIds)
      .then((layers) => {
        if (active) setFriendLayers(layers);
      })
      .catch(() => {
        if (active) setFriendLayers([]);
      });
    return () => {
      active = false;
    };
  }, [
    authenticated,
    friendProfiles,
    onChangeSelectedFriendIds,
    selectedFriendIds,
  ]);

  return { friendProfiles, friendLayers };
}
