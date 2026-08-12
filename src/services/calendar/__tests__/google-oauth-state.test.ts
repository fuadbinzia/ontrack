import { createCalendarOAuthState, readCalendarOAuthState } from '../google-oauth';

const originalSecret = process.env.GOOGLE_CALENDAR_STATE_SECRET;

beforeEach(() => {
  process.env.GOOGLE_CALENDAR_STATE_SECRET = 'calendar-state-test-secret';
});

afterEach(() => {
  jest.useRealTimers();
  if (originalSecret === undefined) delete process.env.GOOGLE_CALENDAR_STATE_SECRET;
  else process.env.GOOGLE_CALENDAR_STATE_SECRET = originalSecret;
});

it('round-trips the authenticated user and exact Calendar return URI', async () => {
  const state = await createCalendarOAuthState('user-1', 'ontrack://calendar/google');

  await expect(readCalendarOAuthState(state)).resolves.toEqual(expect.objectContaining({
    userId: 'user-1',
    returnUri: 'ontrack://calendar/google',
  }));
});

it('rejects a Calendar OAuth state whose signed payload was changed', async () => {
  const state = await createCalendarOAuthState('user-1', 'https://ontrack.example/profile/calendar-sync');
  const [payload, signature] = state.split('.');
  const tamperedPayload = `${payload.slice(0, -1)}${payload.endsWith('a') ? 'b' : 'a'}`;

  await expect(readCalendarOAuthState(`${tamperedPayload}.${signature}`))
    .rejects.toThrow('Invalid OAuth state.');
});

it('rejects a validly signed Calendar OAuth state after its ten-minute lifetime', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-08-12T10:00:00.000Z'));
  const state = await createCalendarOAuthState('user-1', 'ontrack://calendar/google');

  jest.setSystemTime(new Date('2026-08-12T10:10:00.001Z'));

  await expect(readCalendarOAuthState(state)).rejects.toThrow('Expired OAuth state.');
});

it('rejects malformed Calendar OAuth state before using any return URI', async () => {
  await expect(readCalendarOAuthState('missing-signature')).rejects.toThrow('Invalid OAuth state.');
});
