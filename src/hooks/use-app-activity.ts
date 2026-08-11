import { useIsFocused } from 'expo-router';
import { useSyncExternalStore } from 'react';
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';

let status: AppStateStatus = AppState.currentState;
let nativeSubscription: NativeEventSubscription | undefined;
const listeners = new Set<() => void>();

function emit(nextStatus: AppStateStatus): void {
  if (nextStatus === status) return;
  status = nextStatus;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  nativeSubscription ??= AppState.addEventListener('change', emit);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      nativeSubscription?.remove();
      nativeSubscription = undefined;
    }
  };
}

function isForeground(): boolean {
  return status === 'active';
}

/** One shared native AppState subscription for foreground-sensitive work. */
export function useAppIsActive(): boolean {
  return useSyncExternalStore(subscribe, isForeground, () => true);
}

/** True only while this route is visible and the app is in the foreground. */
export function useRouteIsActive(): boolean {
  const focused = useIsFocused();
  const appIsActive = useAppIsActive();
  return focused && appIsActive;
}
