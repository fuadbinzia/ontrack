import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { resolveExpoApiUrl } from '@/services/http/api-url';
import { apiRequest } from '@/services/http/api-client';

export class GoogleDriveBackupError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = 'GoogleDriveBackupError';
  }
}

export type GoogleDriveBackupStatus = {
  connected: boolean;
  email?: string;
  lastBackupAt?: string;
};

export type GoogleDriveBackupFile = {
  id: string;
  name: string;
  createdTime?: string;
};

function endpoint(path: string) {
  const useHostedApi = __DEV__ && Platform.OS !== 'web';
  const configuredBaseUrl = useHostedApi
    ? process.env.EXPO_PUBLIC_CALENDAR_API_BASE_URL || 'https://ontrack.expo.app'
    : process.env.EXPO_PUBLIC_API_BASE_URL;
  return resolveExpoApiUrl(path, {
    configuredBaseUrl,
    preferConfiguredFirst: useHostedApi || !__DEV__,
    requireHttpsInProduction: true,
    createNotConfiguredError: () => new GoogleDriveBackupError('Google Drive backup is not configured in this build.', 'NOT_CONFIGURED'),
  });
}

function request<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown) {
  return apiRequest<T, GoogleDriveBackupError>({
    url: endpoint(path),
    method,
    body,
    timeoutMs: 30_000,
    offlineMessage: 'You appear to be offline. Reconnect and try again.',
    unavailableMessage: 'Google Drive backup is temporarily unavailable.',
    createError: (message, code, status) => new GoogleDriveBackupError(message, code, status),
  });
}

export function getGoogleDriveBackupStatus() {
  return request<GoogleDriveBackupStatus>('/api/backup/google/status');
}

export function googleDriveCallbackError(url: string | undefined) {
  if (!url) return 'Google Drive did not return to onTrack.';
  try {
    const callback = new URL(url);
    const error = callback.searchParams.get('driveError');
    if (error) return error;
    if (callback.searchParams.get('driveConnected') !== '1') {
      return 'Google Drive did not finish connecting.';
    }
    return undefined;
  } catch {
    return 'Google Drive returned an invalid callback.';
  }
}

export async function connectGoogleDriveBackup() {
  const redirectUri = Platform.OS === 'web'
    ? Linking.createURL('/(tabs)/profile/backup')
    : 'ontrack://backup/google';
  const { authorizationUrl } = await request<{ authorizationUrl: string }>(
    '/api/backup/google/connect',
    'POST',
    { redirectUri },
  );
  if (Platform.OS === 'web') {
    window.location.assign(authorizationUrl);
    return new Promise<never>(() => undefined);
  }
  const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUri);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new GoogleDriveBackupError('Google Drive connection was cancelled.', 'CANCELLED');
  }
  if (result.type !== 'success') {
    throw new GoogleDriveBackupError('Google Drive did not finish connecting.');
  }
  const callbackError = googleDriveCallbackError(result.url);
  if (callbackError) throw new GoogleDriveBackupError(callbackError);
}

export async function disconnectGoogleDriveBackup() {
  return request<{ disconnected: boolean }>('/api/backup/google/disconnect', 'POST');
}

export async function googleDriveUploadSession() {
  return request<{ accessToken: string; folderId: string; email?: string }>(
    '/api/backup/google/token',
    'POST',
  );
}

export async function markGoogleDriveBackupComplete() {
  return request<{ lastBackupAt: string }>('/api/backup/google/complete', 'POST');
}
