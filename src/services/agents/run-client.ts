import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';

import type { AgentRunInput } from './run-server';
import type { AgentRunTurn } from './run-types';

export type AgentRunErrorCode =
  | 'INVALID_INPUT'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'NOT_CONFIGURED'
  | 'OFFLINE'
  | 'PROVIDER_FAILURE';

export class AgentRunError extends Error {
  constructor(
    message: string,
    readonly code: AgentRunErrorCode = 'PROVIDER_FAILURE',
    readonly status = 0,
  ) {
    super(message);
    this.name = 'AgentRunError';
  }
}

export function requestAgentRun(
  input: AgentRunInput,
  signal?: AbortSignal,
): Promise<AgentRunTurn> {
  return apiRequest<AgentRunTurn, AgentRunError>({
    url: resolveExpoApiUrl('/api/agents/run', {
      configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      createNotConfiguredError: () =>
        new AgentRunError(
          'onTrack companion requires a connected onTrack server.',
          'NOT_CONFIGURED',
        ),
    }),
    body: input,
    signal,
    timeoutMs: 55_000,
    offlineMessage: 'Connect to the internet to ask onTrack.',
    unavailableMessage: 'onTrack companion is temporarily unavailable.',
    createError: (message, code, status) =>
      new AgentRunError(
        message,
        (code as AgentRunErrorCode | undefined) ?? 'PROVIDER_FAILURE',
        status ?? 0,
      ),
  });
}
