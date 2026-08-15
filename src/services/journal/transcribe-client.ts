import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';

export type JournalTranscribeErrorCode =
  | 'INVALID_INPUT'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'NOT_CONFIGURED'
  | 'OFFLINE'
  | 'PROVIDER_FAILURE'
  | 'TRANSCRIPTION_FAILED'
  | 'INVALID_TRANSCRIPT';

export class JournalTranscribeError extends Error {
  constructor(
    message: string,
    readonly code: JournalTranscribeErrorCode = 'PROVIDER_FAILURE',
    readonly status = 0,
  ) {
    super(message);
    this.name = 'JournalTranscribeError';
  }
}

export function requestJournalTranscribe(
  audioDataUrl: string,
  signal?: AbortSignal,
): Promise<{ text: string }> {
  return apiRequest<{ text: string }, JournalTranscribeError>({
    url: resolveExpoApiUrl('/journal/transcribe', {
      configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      createNotConfiguredError: () =>
        new JournalTranscribeError(
          'Journal dictate requires a connected onTrack server.',
          'NOT_CONFIGURED',
        ),
    }),
    body: { audioDataUrl },
    signal,
    timeoutMs: 55_000,
    offlineMessage: 'Connect to the internet to dictate.',
    unavailableMessage: 'Journal dictate is temporarily unavailable.',
    createError: (message, code, status) =>
      new JournalTranscribeError(
        message,
        (code as JournalTranscribeErrorCode | undefined) ?? 'PROVIDER_FAILURE',
        status ?? 0,
      ),
  });
}
