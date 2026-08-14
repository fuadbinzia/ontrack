import { useEffect } from 'react';
import { AppState } from 'react-native';

import { refreshEventFollows } from '@/services/events/sync';

export function useEventFollowSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void refreshEventFollows().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshEventFollows().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [enabled]);
}
