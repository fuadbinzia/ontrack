import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { appPrompt } from '@/components/primitives/app-prompt';
import { resolveExpoApiUrl } from '@/services/http/api-url';
import { apiRequest } from '@/services/http/api-client';
import { useSchedule } from '@/store/schedule';

import type { GoogleCalendarStatus, GoogleCalendarSyncDirection, GoogleCalendarSyncResult } from './google-types';

export class GoogleCalendarError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = 'GoogleCalendarError';
  }
}

function normalizeGoogleCalendarSyncError(error: unknown) {
  if (error instanceof GoogleCalendarError && /insufficient authentication scopes|permission needs to be renewed|did not grant calendar event access/i.test(error.message)) {
    return new GoogleCalendarError(
      'Google Calendar permission needs to be renewed. Reconnect to grant event access, then sync again.',
      'RECONNECT_REQUIRED',
      error.status,
    );
  }
  return error;
}

function endpoint(path: string) {
  // Calendar OAuth always uses the hosted API in native development. Metro's
  // local API runtime intentionally does not receive server-only credentials.
  const useHostedApi = __DEV__ && Platform.OS !== 'web';
  const configuredBaseUrl = useHostedApi
    ? process.env.EXPO_PUBLIC_CALENDAR_API_BASE_URL || 'https://ontrack.expo.app'
    : process.env.EXPO_PUBLIC_API_BASE_URL;
  return resolveExpoApiUrl(path, {
    configuredBaseUrl,
    preferConfiguredFirst: useHostedApi || !__DEV__,
    requireHttpsInProduction: true,
    createNotConfiguredError: () => new GoogleCalendarError('Calendar sync is not configured in this build.', 'NOT_CONFIGURED'),
  });
}

function request<T>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  signal?: AbortSignal,
  timeoutMs = 30_000,
) {
  return apiRequest<T, GoogleCalendarError>({
    url: endpoint(path), method, body, signal, timeoutMs,
    offlineMessage: 'You appear to be offline. Reconnect and try again.',
    unavailableMessage: 'Google Calendar sync is temporarily unavailable.',
    createError: (message, code, status) => new GoogleCalendarError(message, code, status),
  });
}

export function getGoogleCalendarStatus() {
  return request<GoogleCalendarStatus>('/api/calendar/google/status');
}

export function setGoogleCalendarDirection(direction: GoogleCalendarSyncDirection) {
  return request<{ direction: GoogleCalendarSyncDirection }>('/api/calendar/google/direction', 'POST', { direction });
}

export function googleCalendarCallbackError(url: string | undefined) {
  if (!url) return 'Google Calendar did not return to onTrack.';
  try {
    const callback = new URL(url);
    const error = callback.searchParams.get('calendarError');
    if (error) return error;
    if (callback.searchParams.get('calendarConnected') !== '1') {
      return 'Google Calendar did not finish connecting.';
    }
    return undefined;
  } catch {
    return 'Google Calendar returned an invalid callback.';
  }
}

export async function connectGoogleCalendar() {
  const redirectUri = Platform.OS === 'web'
    ? Linking.createURL('/(tabs)/profile/calendar-sync')
    : 'ontrack://calendar/google';
  const { authorizationUrl } = await request<{ authorizationUrl: string }>(
    '/api/calendar/google/connect', 'POST', { redirectUri },
  );
  if (Platform.OS === 'web') {
    window.location.assign(authorizationUrl);
    return new Promise<never>(() => undefined);
  }
  const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUri);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new GoogleCalendarError('Google Calendar connection was cancelled.', 'CANCELLED');
  }
  if (result.type !== 'success') {
    throw new GoogleCalendarError('Google Calendar did not finish connecting.');
  }
  const callbackError = googleCalendarCallbackError(result.url);
  if (callbackError) throw new GoogleCalendarError(callbackError);
}

export type GoogleCalendarSyncProgress = { phase: 'pull' | 'push'; completedRequests: number; changedEvents: number };

export type GoogleCalendarBackgroundSyncState = {
  running: boolean;
  progress?: GoogleCalendarSyncProgress;
};

const idleBackgroundSyncState: GoogleCalendarBackgroundSyncState = { running: false };
let backgroundSyncState = idleBackgroundSyncState;
let activeBackgroundSync: ReturnType<typeof syncGoogleCalendar> | undefined;
let notifyWhenBackgroundSyncFinishes = false;
const backgroundSyncListeners = new Set<() => void>();

function setBackgroundSyncState(next: GoogleCalendarBackgroundSyncState) {
  backgroundSyncState = next;
  backgroundSyncListeners.forEach((listener) => listener());
}

export function getGoogleCalendarBackgroundSyncState() {
  return backgroundSyncState;
}

export function subscribeToGoogleCalendarBackgroundSync(listener: () => void) {
  backgroundSyncListeners.add(listener);
  return () => backgroundSyncListeners.delete(listener);
}

export async function syncGoogleCalendar(onProgress?: (progress: GoogleCalendarSyncProgress) => void) {
  const totals = { imported: 0, exported: 0, updated: 0, removed: 0 };
  let phase: 'pull' | 'push' = 'pull';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    for (let chunk = 0; chunk < 100; chunk += 1) {
      onProgress?.({ phase, completedRequests: chunk, changedEvents: Object.values(totals).reduce((sum, value) => sum + value, 0) });
      const state = useSchedule.getState();
      const result: GoogleCalendarSyncResult = await request<GoogleCalendarSyncResult>('/api/calendar/google/sync', 'POST', {
        activities: state.activities,
        deletions: state.googleCalendarDeletions,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        phase,
      }, controller.signal, 60_000);
      // Clear only provider-acknowledged tombstones before reconciliation.
      // Any deletion queued while this request was in flight remains present,
      // allowing the store to reject the response's now-stale activity copy.
      useSchedule.getState().clearGoogleCalendarDeletions(result.acknowledgedDeletionIds);
      useSchedule.getState().replaceGoogleCalendarActivities(result.activities);
      totals.imported += result.imported;
      totals.exported += result.exported;
      totals.updated += result.updated;
      totals.removed += result.removed;
      if (!result.hasMore) return { ...result, ...totals };
      phase = result.nextPhase ?? 'push';
    }
    throw new GoogleCalendarError('Calendar sync still has pending changes. Tap Sync Now again to continue.');
  } catch (error) {
    if (controller.signal.aborted) throw new GoogleCalendarError('Calendar sync timed out. Completed changes were saved; tap Sync Now to continue.', 'TIMEOUT');
    throw normalizeGoogleCalendarSyncError(error);
  } finally {
    clearTimeout(timeout);
  }
}

export function startGoogleCalendarBackgroundSync(options?: { notifyWhenComplete?: boolean }) {
  notifyWhenBackgroundSyncFinishes ||= options?.notifyWhenComplete === true;
  if (activeBackgroundSync) return activeBackgroundSync;

  setBackgroundSyncState({ running: true, progress: { phase: 'pull', completedRequests: 0, changedEvents: 0 } });
  const task = syncGoogleCalendar((progress) => setBackgroundSyncState({ running: true, progress }));
  activeBackgroundSync = task;
  void task.then((result) => {
    if (notifyWhenBackgroundSyncFinishes) {
      appPrompt.alert(
        'Google Calendar sync complete',
        `${result.imported} imported · ${result.exported} exported · ${result.updated} updated · ${result.removed} removed.`,
      );
    }
  }).catch((error) => {
    if (notifyWhenBackgroundSyncFinishes) {
      if (error instanceof GoogleCalendarError && error.code === 'RECONNECT_REQUIRED') {
        appPrompt.alert('Reconnect Google Calendar', error.message, [
          { text: 'Not Now', style: 'cancel' },
          {
            text: 'Reconnect',
            style: 'primary',
            onPress: () => {
              void connectGoogleCalendar()
                .then(() => startGoogleCalendarBackgroundSync({ notifyWhenComplete: true }))
                .catch((reconnectError) => appPrompt.alert(
                  'Google Calendar could not reconnect',
                  reconnectError instanceof Error ? reconnectError.message : 'Try again later.',
                ));
            },
          },
        ]);
      } else {
        appPrompt.alert(
          'Google Calendar sync stopped',
          error instanceof Error ? error.message : 'Calendar sync could not finish.',
        );
      }
    }
  }).finally(() => {
    if (activeBackgroundSync !== task) return;
    activeBackgroundSync = undefined;
    notifyWhenBackgroundSyncFinishes = false;
    setBackgroundSyncState(idleBackgroundSyncState);
  });
  return task;
}

let lastAutomaticSyncAt = 0;

/** Quiet, throttled sync used when the user returns to the Calendar tab. */
export async function syncGoogleCalendarIfConnected() {
  if (Date.now() - lastAutomaticSyncAt < 5 * 60_000) return;
  const status = await getGoogleCalendarStatus();
  if (!status.connected) return;
  lastAutomaticSyncAt = Date.now();
  try {
    await startGoogleCalendarBackgroundSync();
  } catch (error) {
    lastAutomaticSyncAt = 0;
    throw error;
  }
}

export async function disconnectGoogleCalendar(options: {
  removeImported: boolean;
  removeExported: boolean;
}) {
  let disconnected = false;
  for (let chunk = 0; chunk < 100 && !disconnected; chunk += 1) {
    const result = await request<{ disconnected: boolean; hasMore: boolean }>(
      '/api/calendar/google/disconnect', 'POST', options, undefined, 60_000,
    );
    disconnected = result.disconnected;
  }
  if (!disconnected) throw new GoogleCalendarError('Calendar cleanup still has pending changes. Try disconnecting again.');
  if (options.removeImported) useSchedule.getState().removeGoogleCalendarImports();
  useSchedule.setState((state) => ({
    activities: state.activities.map((activity) => {
      if (!activity.googleCalendar) return activity;
      const { googleCalendar: _googleCalendar, ...local } = activity;
      return local;
    }),
    googleCalendarDeletions: [],
  }));
}
