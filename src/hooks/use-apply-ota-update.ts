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
 * Android reloads in-session. iOS waits until the app leaves the foreground
 * (`inactive` / `background`) so Fabric views are not swapped mid-frame
 * (itinerary-open SIGABRT). Do not drop a pending reload if `reloadAsync` fails —
 * force-quit from the switcher must still retry on the next leave.
 */
export function useApplyOtaUpdate() {
  const { isUpdatePending } = Updates.useUpdates();
  const checkingRef = useRef(false);
  const pendingBackgroundReloadRef = useRef(false);
  const reloadingRef = useRef(false);
  const isUpdatePendingRef = useRef(isUpdatePending);
  isUpdatePendingRef.current = isUpdatePending;

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;
    const plan = otaReloadPlanForOs(Platform.OS);
    setRuntimeActivity(
      { id: 'system.ota', label: 'OTA update checks', category: 'system' },
      { status: 'idle', detail: 'Checks on launch and foreground' },
    );

    const reloadNow = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      void Updates.reloadAsync().catch(() => {
        reloadingRef.current = false;
      });
    };

    const onDownloaded = () => {
      if (plan === 'immediate') {
        reloadNow();
        return;
      }
      if (plan === 'on-background') {
        pendingBackgroundReloadRef.current = true;
      }
    };

    const check = () => {
      if (
        checkingRef.current ||
        pendingBackgroundReloadRef.current ||
        reloadingRef.current
      ) {
        return;
      }
      checkingRef.current = true;
      const finishActivity = beginRuntimeOperation(
        { id: 'system.ota', label: 'OTA update checks', category: 'system' },
      );
      void applyAvailableOtaUpdate({
        isEnabled: Updates.isEnabled,
        isUpdatePending: () => isUpdatePendingRef.current,
        checkForUpdateAsync: () => Updates.checkForUpdateAsync(),
        fetchUpdateAsync: () => Updates.fetchUpdateAsync(),
      })
        .then((result) => {
          finishActivity();
          if (result === 'downloaded') onDownloaded();
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
        reloadNow();
        return;
      }
      if (action === 'check') check();
    });
    return () => {
      sub.remove();
      removeRuntimeActivity('system.ota');
    };
  }, []);

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;
    if (!isUpdatePending) return;
    const plan = otaReloadPlanForOs(Platform.OS);
    if (plan === 'immediate') {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      void Updates.reloadAsync().catch(() => {
        reloadingRef.current = false;
      });
      return;
    }
    if (plan === 'on-background') {
      pendingBackgroundReloadRef.current = true;
    }
  }, [isUpdatePending]);
}
