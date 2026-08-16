const mockSendCrashReport = jest.fn();
const mockRecordFlowOutcome = jest.fn();

jest.mock('@/utils/crash-report', () => ({
  sendCrashReport: (...args: unknown[]) => mockSendCrashReport(...args),
}));

jest.mock('@/store/flow-analytics', () => ({
  recordFlowOutcome: (...args: unknown[]) => mockRecordFlowOutcome(...args),
}));

import {
  isOperationalErrorMessage,
  isOperationalFailure,
  reportOperationalFailure,
  resetOperationalFailureReportsForTests,
  userVisibleError,
} from '../operational-error';

describe('operational errors stay off the screen', () => {
  beforeEach(() => {
    mockSendCrashReport.mockReset();
    mockRecordFlowOutcome.mockReset();
    mockSendCrashReport.mockResolvedValue({ method: 'sent' });
    resetOperationalFailureReportsForTests();
  });

  it('hides backend outages and keeps form validation visible', () => {
    expect(userVisibleError('Sports schedules are not configured.')).toBeUndefined();
    expect(userVisibleError('Event discovery is temporarily unavailable.')).toBeUndefined();
    expect(userVisibleError('Event discovery is offline. Your saved events and follows are still available.')).toBeUndefined();
    expect(userVisibleError('Choose a title, date, time, duration, and category for every event.')).toBe(
      'Choose a title, date, time, duration, and category for every event.',
    );
    expect(userVisibleError('Sign in to discover and follow events.')).toBe(
      'Sign in to discover and follow events.',
    );
    expect(userVisibleError('This list link is invalid or incomplete.')).toBe(
      'This list link is invalid or incomplete.',
    );
  });

  it('treats provider 5xx and offline statuses as operational even without stock copy', () => {
    expect(isOperationalFailure('Something went wrong.', 503)).toBe(true);
    expect(isOperationalFailure('Something went wrong.', 0)).toBe(true);
    expect(isOperationalFailure('Something went wrong.', 429)).toBe(true);
    expect(isOperationalFailure('Sign in to continue.', 401)).toBe(false);
    expect(isOperationalFailure('Choose a valid sport.', 400)).toBe(false);
    expect(isOperationalErrorMessage('Choose a valid sport.')).toBe(false);
  });

  it('alerts the living system map and support email once per outage', () => {
    reportOperationalFailure('Sports schedules are not configured.', 'events.search');
    reportOperationalFailure('Sports schedules are not configured.', 'events.search');

    expect(mockRecordFlowOutcome).toHaveBeenCalledTimes(1);
    expect(mockRecordFlowOutcome).toHaveBeenCalledWith('backend.service', 'fail');
    expect(mockSendCrashReport).toHaveBeenCalledTimes(1);
    expect(mockSendCrashReport).toHaveBeenCalledWith({
      error: expect.objectContaining({
        name: 'OperationalError',
        message: 'Sports schedules are not configured.',
      }),
      context: 'events.search',
    });
  });

  it('does not email ordinary validation copy', () => {
    reportOperationalFailure('Choose a title, date, time, duration, and category for every event.');
    expect(mockRecordFlowOutcome).not.toHaveBeenCalled();
    expect(mockSendCrashReport).not.toHaveBeenCalled();
  });
});
