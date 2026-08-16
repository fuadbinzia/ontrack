import { createCalendarOAuthState } from '@/services/calendar/google-oauth';
import {
  createDriveOAuthState,
  hasGoogleDriveFileScope,
  readDriveOAuthState,
} from '../google-drive-oauth';

const originalSecret = process.env.GOOGLE_CALENDAR_STATE_SECRET;

beforeEach(() => {
  process.env.GOOGLE_CALENDAR_STATE_SECRET = 'drive-state-test-secret';
});

afterEach(() => {
  jest.useRealTimers();
  if (originalSecret === undefined) delete process.env.GOOGLE_CALENDAR_STATE_SECRET;
  else process.env.GOOGLE_CALENDAR_STATE_SECRET = originalSecret;
});

it('round-trips the authenticated user and Drive return URI', async () => {
  const state = await createDriveOAuthState('user-1', 'ontrack://backup/google');

  await expect(readDriveOAuthState(state)).resolves.toEqual(expect.objectContaining({
    purpose: 'drive-backup',
    userId: 'user-1',
    returnUri: 'ontrack://backup/google',
  }));
});

it('rejects a Drive OAuth state whose signed payload was changed', async () => {
  const state = await createDriveOAuthState('user-1', 'https://ontrack.example/profile/backup');
  const [payload, signature] = state.split('.');
  const tamperedPayload = `${payload.slice(0, -1)}${payload.endsWith('a') ? 'b' : 'a'}`;

  await expect(readDriveOAuthState(`${tamperedPayload}.${signature}`))
    .rejects.toThrow('Invalid OAuth state.');
});

it('rejects a Calendar OAuth state that is not a Drive backup purpose', async () => {
  const state = await createCalendarOAuthState('user-1', 'ontrack://backup/google');

  await expect(readDriveOAuthState(state)).rejects.toThrow('Expired OAuth state.');
});

it('requires the Drive file scope when Google returns an explicit scope list', () => {
  expect(hasGoogleDriveFileScope('openid email https://www.googleapis.com/auth/drive.file')).toBe(true);
  expect(hasGoogleDriveFileScope('openid email https://www.googleapis.com/auth/calendar.events')).toBe(false);
});
