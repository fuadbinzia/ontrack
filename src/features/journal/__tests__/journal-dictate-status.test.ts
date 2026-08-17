const mockReport = jest.fn();

jest.mock('@/utils/operational-error', () => {
  const actual = jest.requireActual('@/utils/operational-error') as typeof import('@/utils/operational-error');
  return {
    ...actual,
    reportOperationalFailure: (...args: unknown[]) => mockReport(...args),
  };
});

import { journalDictateStatusMessage } from '../journal-dictate-status';

describe('journalDictateStatusMessage', () => {
  beforeEach(() => {
    mockReport.mockReset();
  });

  it('hides backend not-configured copy and reports the outage', () => {
    expect(journalDictateStatusMessage(new Error('Journal dictate is not configured.'))).toBe(
      'Dictate is temporarily unavailable. Typing still works.',
    );
    expect(mockReport).toHaveBeenCalledWith(
      'Journal dictate is not configured.',
      'journal.dictate',
    );
  });

  it('keeps actionable dictate failures on screen', () => {
    expect(journalDictateStatusMessage(new Error('Connect to the internet to dictate.'))).toBe(
      'Connect to the internet to dictate.',
    );
    expect(journalDictateStatusMessage(new Error('Sign in is required to transcribe journal audio.'))).toBe(
      'Sign in is required to transcribe journal audio.',
    );
  });

  it('falls back when the provider returns no message', () => {
    expect(journalDictateStatusMessage(undefined)).toBe(
      'Dictate is temporarily unavailable. Typing still works.',
    );
    expect(mockReport).not.toHaveBeenCalled();
  });
});
