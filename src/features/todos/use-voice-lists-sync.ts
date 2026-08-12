import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useTodos } from '@/store/todos';
import {
  applyVoicePendingOps,
  publishVoiceSnapshot,
  subscribeVoicePending,
} from './voice-lists';

/** Keep Siri / Assistant snapshot in sync and drain voice adds into the todo store. */
export function useVoiceListsSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let active = true;

    const sync = () => {
      void applyVoicePendingOps()
        .then(() => {
          if (active) return publishVoiceSnapshot();
        })
        .catch(() => undefined);
    };

    sync();
    const unsubscribe = useTodos.subscribe(() => {
      if (active) void publishVoiceSnapshot().catch(() => undefined);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const stopPending = subscribeVoicePending(sync);

    return () => {
      active = false;
      unsubscribe();
      appState.remove();
      stopPending();
    };
  }, [enabled]);
}
