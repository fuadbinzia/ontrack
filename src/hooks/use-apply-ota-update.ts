import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { beginRuntimeOperation, removeRuntimeActivity, setRuntimeActivity } from '@/features/performance/runtime-activity';
import { applyAvailableOtaUpdate } from '@/services/updates/apply-ota';

/**
 * Production builds: download OTAs on launch/foreground. Apply happens on the
 * next cold start — same-session `reloadAsync` races AppContext/Fabric on iOS
 * and aborts via expo-updates ErrorRecovery (itinerary open after OTA).
 */
export function useApplyOtaUpdate() {
  const checkingRef = useRef(false);

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;
    setRuntimeActivity(
      { id: 'system.ota', label: 'OTA update checks', category: 'system' },
      { status: 'idle', detail: 'Checks on launch and foreground' },
    );

    const check = () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      const finishActivity = beginRuntimeOperation(
        { id: 'system.ota', label: 'OTA update checks', category: 'system' },
      );
      void applyAvailableOtaUpdate({
        isEnabled: Updates.isEnabled,
        checkForUpdateAsync: () => Updates.checkForUpdateAsync(),
        fetchUpdateAsync: () => Updates.fetchUpdateAsync(),
        reloadAsync: () => Updates.reloadAsync(),
      })
        .then(() => finishActivity())
        .catch(() => finishActivity({ error: true }))
        .finally(() => {
          checkingRef.current = false;
        });
    };

    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      sub.remove();
      removeRuntimeActivity('system.ota');
    };
  }, []);
}
