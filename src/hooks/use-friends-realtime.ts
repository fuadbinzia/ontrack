import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  removeRuntimeActivity,
  setRuntimeActivity,
} from '@/features/performance/runtime-activity';
import { subscribeToFriendChanges } from '@/services/friends';
import { useFriends } from '@/store/friends';

/** Keeps a signed-in user's friend cache current when another user responds. */
export function useFriendsRealtime(userId: string | undefined, enabled = true) {
  useEffect(() => {
    if (!userId || !enabled) return;
    setRuntimeActivity(
      { id: 'sync.friends', label: 'Friends realtime', category: 'sync' },
      { status: 'running', detail: 'Social screen subscription' },
    );
    const refresh = () => {
      void useFriends
        .getState()
        .refresh()
        .catch(() => undefined);
    };
    refresh();
    const channel = subscribeToFriendChanges(userId, refresh);
    const appState = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refresh();
    });
    return () => {
      appState.remove();
      void channel?.unsubscribe();
      removeRuntimeActivity('sync.friends');
    };
  }, [enabled, userId]);
}
