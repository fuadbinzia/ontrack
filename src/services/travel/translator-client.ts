import type {
  TravelTranslatorLanguagesInput,
  TravelTranslatorLanguagesResponse,
  TravelTranslatorTurnInput,
  TravelTranslatorTurnResponse,
} from '@/features/travel/translator/travel-translator-types';
import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';

export type TravelTranslatorErrorCode =
  | 'INVALID_INPUT'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'NOT_CONFIGURED'
  | 'OFFLINE'
  | 'PROVIDER_FAILURE'
  | 'TRANSCRIPTION_FAILED'
  | 'INVALID_TRANSCRIPT'
  | 'INVALID_RESPONSE';

export class TravelTranslatorError extends Error {
  constructor(
    message: string,
    readonly code: TravelTranslatorErrorCode = 'PROVIDER_FAILURE',
    readonly status = 0,
  ) {
    super(message);
    this.name = 'TravelTranslatorError';
  }
}

const languageResolutionCache = new Map<string, TravelTranslatorLanguagesResponse>();

function translatorUrl(path: string): string {
  return resolveExpoApiUrl(path, {
    configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    createNotConfiguredError: () =>
      new TravelTranslatorError(
        'Travel translation requires a connected onTrack server.',
        'NOT_CONFIGURED',
      ),
  });
}

function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return apiRequest<T, TravelTranslatorError>({
    url: translatorUrl(path),
    body,
    signal,
    timeoutMs: 55_000,
    offlineMessage: 'Connect to the internet to translate.',
    unavailableMessage: 'Travel translation is temporarily unavailable.',
    createError: (message, code, status) =>
      new TravelTranslatorError(
        message,
        (code as TravelTranslatorErrorCode | undefined) ?? 'PROVIDER_FAILURE',
        status ?? 0,
      ),
  });
}

export function requestTravelTranslatorLanguages(
  input: TravelTranslatorLanguagesInput,
  signal?: AbortSignal,
) {
  const key = `${input.homeLocale.toLowerCase()}|${input.destination.trim().toLowerCase()}`;
  const cached = languageResolutionCache.get(key);
  if (cached) return Promise.resolve(cached);
  return post<TravelTranslatorLanguagesResponse>(
    '/travel/translator/languages',
    input,
    signal,
  ).then((response) => {
    languageResolutionCache.set(key, response);
    return response;
  });
}

export function requestTravelTranslatorTurn(
  input: TravelTranslatorTurnInput,
  signal?: AbortSignal,
) {
  return post<TravelTranslatorTurnResponse>(
    '/travel/translator/turn',
    input,
    signal,
  );
}
