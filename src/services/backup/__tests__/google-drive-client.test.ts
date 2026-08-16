import { googleDriveCallbackError } from '../google-drive-client';

it('reads Drive callback success and errors from the return URL', () => {
  expect(googleDriveCallbackError('ontrack://backup/google?driveError=Access+denied'))
    .toBe('Access denied');
  expect(googleDriveCallbackError('ontrack://backup/google?driveConnected=1')).toBeUndefined();
  expect(googleDriveCallbackError('ontrack://backup/google'))
    .toBe('Google Drive did not finish connecting.');
});
