import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { beginRuntimeOperation, removeRuntimeActivity, setRuntimeActivity } from '@/features/performance/runtime-activity';
import {
  applyAvailableOtaUpdate,
  otaAppStateAction,
  otaReloadPlanForOs,
} from '@/services/updates/apply-ota';

/**
 * Production builds: download OTAs on launch/foreground.
 * Android reloads in-session. iOS waits until background so Fabric views are
 * not swapped mid-frame (itinerary-open SIGABRT).
 */
export function useApplyOtaUpdate() {
  const checkingRef = useRef(false);
  const pendingBackgroundReloadRef = useRef(false);

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;
    const plan = otaReloadPlanForOs(Platform.OS);
    setRuntimeActivity(
      { id: 'system.ota', label: 'OTA update checks', category: 'system' },
      { status: 'idle', detail: 'Checks on launch and foreground' },
    );

    const check = () => {
      if (checkingRef.current || pendingBackgroundReloadRef.current) return;
      checkingRef.current = true;
      const finishActivity = beginRuntimeOperation(
        { id: 'system.ota', label: 'OTA update checks', category: 'system' },
      );
      void applyAvailableOtaUpdate({
        isEnabled: Updates.isEnabled,
        checkForUpdateAsync: () => Updates.checkForUpdateAsync(),
        fetchUpdateAsync: () => Updates.fetchUpdateAsync(),
      })
        .then(async (result) => {
          finishActivity();
          if (result !== 'downloaded') return;
          if (plan === 'immediate') {
            await Updates.reloadAsync();
            return;
          }
          if (plan === 'on-background') {
            pendingBackgroundReloadRef.current = true;
          }
        })
        .catch(() => finishActivity({ error: true }))
        .finally(() => {
          checkingRef.current = false;
        });
    };

    check();
    const sub = AppState.addEventListener('change', (state) => {
      const action = otaAppStateAction(state, pendingBackgroundReloadRef.current);
      if (action === 'reload') {
        pendingBackgroundReloadRef.current = false;
        void Updates.reloadAsync();
        return;
      }
      if (action === 'check') check();
    });
    return () => {
      sub.remove();
      removeRuntimeActivity('system.ota');
    };
  }, []);
}
