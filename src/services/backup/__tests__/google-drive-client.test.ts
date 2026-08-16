const mockApiRequest = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();

jest.mock('@/services/http/api-client', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));

import {
  connectGoogleDriveBackup,
  googleDriveBackupErrorMessage,
  googleDriveCallbackError,
  googleDriveConnectErrorMessage,
  GoogleDriveBackupError,
  isGoogleDriveAuthError,
} from '../google-drive-client';

it('reads Drive callback success and errors from the return URL', () => {
  expect(googleDriveCallbackError('ontrack://backup/google?driveError=Access+denied'))
    .toBe('Access denied');
  expect(googleDriveCallbackError('ontrack://backup/google?driveConnected=1')).toBeUndefined();
  expect(googleDriveCallbackError('ontrack://backup/google'))
    .toBe('Google Drive did not finish connecting.');
});

it('maps a missing Drive connect route to copy the user can see', () => {
  expect(googleDriveConnectErrorMessage(new GoogleDriveBackupError(
    'Google Drive backup is temporarily unavailable.',
    undefined,
    404,
  ))).toBe('Google Drive could not open. Try again in a moment.');
  expect(googleDriveConnectErrorMessage(new GoogleDriveBackupError(
    'Sign in to onTrack before connecting Google Drive.',
    undefined,
    401,
  ))).toBe('Sign in to onTrack, then connect Google Drive.');
  expect(googleDriveConnectErrorMessage(new GoogleDriveBackupError(
    'Google Drive backup is temporarily unavailable.',
  ))).toBe('Google Drive could not open. Check your connection and try again.');
  expect(googleDriveConnectErrorMessage(new GoogleDriveBackupError(
    'Google Drive connection was cancelled.',
    'CANCELLED',
  ))).toBe('Google Drive connection was cancelled.');
});

it('does not tell a connected Drive account to wait out a broken backup folder', () => {
  expect(googleDriveBackupErrorMessage(
    new Error('Invalid Value'),
    'Backup could not be saved to Google Drive.',
  )).toBe('Google Drive needs to be connected again. Disconnect, then connect.');
  expect(googleDriveBackupErrorMessage(
    new Error('Invalid Value'),
    'Google Drive backups could not be loaded.',
  )).not.toMatch(/try again in a moment/i);
  expect(googleDriveBackupErrorMessage(
    new Error('Invalid Credentials'),
    'Backup could not be saved to Google Drive.',
  )).toBe('Google Drive needs to be connected again. Disconnect, then connect.');
  expect(googleDriveConnectErrorMessage(new Error('Invalid Value'))).not.toMatch(/invalid value/i);
  expect(googleDriveConnectErrorMessage(new Error('Invalid Value'))).not.toMatch(/disconnect/i);
  expect(googleDriveBackupErrorMessage(
    new Error('You appear to be offline. Reconnect and try again.'),
    'Backup could not be saved to Google Drive.',
  )).toBe('Backup could not be saved to Google Drive.');
});

it('treats expired Drive credentials as auth failures, not query noise', () => {
  expect(isGoogleDriveAuthError(new Error('Invalid Value'))).toBe(false);
  expect(isGoogleDriveAuthError(new Error('Invalid Credentials'))).toBe(true);
  expect(isGoogleDriveAuthError(new GoogleDriveBackupError('expired', undefined, 401))).toBe(true);
  expect(isGoogleDriveAuthError(new GoogleDriveBackupError('forbidden', undefined, 403))).toBe(true);
});

it('keeps Drive connect failures visible instead of swallowing outage copy', () => {
  const visible = googleDriveConnectErrorMessage(new GoogleDriveBackupError(
    'Google Drive backup is temporarily unavailable.',
    undefined,
    404,
  ));
  expect(visible).toMatch(/could not open/i);
  expect(visible).not.toMatch(/unavailable/i);
});

it('does not open Google when the hosted connect route is missing', async () => {
  mockApiRequest.mockRejectedValueOnce(new GoogleDriveBackupError(
    'Google Drive backup is temporarily unavailable.',
    undefined,
    404,
  ));

  await expect(connectGoogleDriveBackup()).rejects.toEqual(expect.objectContaining({
    name: 'GoogleDriveBackupError',
    status: 404,
  }));
  expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
});

it('does not open Google when connect returns no authorization URL', async () => {
  mockApiRequest.mockResolvedValueOnce({});
  await expect(connectGoogleDriveBackup()).rejects.toEqual(expect.objectContaining({
    message: 'Google Drive could not open. Try again in a moment.',
  }));
  expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
});

it('opens the native auth session only after connect returns an authorization URL', async () => {
  mockApiRequest.mockResolvedValueOnce({ authorizationUrl: 'https://accounts.google.test/oauth' });
  mockOpenAuthSessionAsync.mockResolvedValueOnce({
    type: 'success',
    url: 'ontrack://backup/google?driveConnected=1',
  });

  await expect(connectGoogleDriveBackup()).resolves.toBeUndefined();
  expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
    'https://accounts.google.test/oauth',
    'ontrack://backup/google',
  );
});

it('does not treat a cancelled Google sheet as a successful connect', async () => {
  mockApiRequest.mockResolvedValueOnce({ authorizationUrl: 'https://accounts.google.test/oauth' });
  mockOpenAuthSessionAsync.mockResolvedValueOnce({ type: 'cancel' });

  await expect(connectGoogleDriveBackup()).rejects.toEqual(expect.objectContaining({
    code: 'CANCELLED',
  }));
});
