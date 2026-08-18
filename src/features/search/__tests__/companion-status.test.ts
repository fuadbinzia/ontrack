const mockReport = jest.fn();

jest.mock('@/utils/operational-error', () => {
  const actual = jest.requireActual('@/utils/operational-error') as typeof import('@/utils/operational-error');
  return {
    ...actual,
    reportOperationalFailure: (...args: unknown[]) => mockReport(...args),
  };
});

import { AgentRunError } from '@/services/agents/run-client';

import { COMPANION_UNAVAILABLE, companionStatusMessage } from '../companion-status';

describe('companionStatusMessage', () => {
  beforeEach(() => {
    mockReport.mockReset();
  });

  it('hides backend not-configured copy and reports the outage', () => {
    expect(
      companionStatusMessage(
        new AgentRunError('onTrack companion is not configured.', 'NOT_CONFIGURED', 503),
      ),
    ).toBe(COMPANION_UNAVAILABLE);
    expect(mockReport).toHaveBeenCalledWith(
      'onTrack companion is not configured.',
      'search.companion',
    );
  });

  it('hides a missing local API host the same way', () => {
    expect(
      companionStatusMessage(
        new AgentRunError('onTrack companion is not configured.', 'NOT_CONFIGURED', 503),
      ),
    ).toBe(COMPANION_UNAVAILABLE);
    expect(
      companionStatusMessage(
        new AgentRunError(
          'onTrack companion is temporarily unavailable.',
          'PROVIDER_FAILURE',
          502,
        ),
      ),
    ).toBe(COMPANION_UNAVAILABLE);
  });

  it('keeps actionable companion failures on screen', () => {
    expect(
      companionStatusMessage(new AgentRunError('Connect to the internet to ask onTrack.', 'OFFLINE')),
    ).toBe('Connect to the internet to ask onTrack.');
    expect(
      companionStatusMessage(
        new AgentRunError('onTrack companion limit reached. Try again later.', 'RATE_LIMITED', 429),
      ),
    ).toBe('onTrack companion limit reached. Try again later.');
  });

  it('falls back when the provider returns no message', () => {
    expect(companionStatusMessage(undefined)).toBe(COMPANION_UNAVAILABLE);
    expect(mockReport).not.toHaveBeenCalled();
  });
});
