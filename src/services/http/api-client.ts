import { fetch } from 'expo/fetch';

import { beginRuntimeOperation } from '@/features/performance/runtime-activity';
import { authHeader } from '@/services/cloud/access-token';

export type ApiErrorBody = {
  error?: string;
  code?: string;
};

export type ApiRequestOptions<TError extends Error> = {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
  /** Extra headers merged after auth (Content-Type is set automatically for JSON bodies). */
  headers?: Record<string, string>;
  offlineMessage: string;
  unavailableMessage: string;
  defaultErrorCode?: string;
  createError: (message: string, code?: string, status?: number) => TError;
  /** When false, skip attaching the cloud access token. Default true. */
  authenticate?: boolean;
};

function abortError(): Error {
  const error = new Error('The request was aborted.');
  error.name = 'AbortError';
  return error;
}

function waitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Authenticated JSON fetch with AbortError passthrough and offline/error mapping.
 * Resolve the URL before calling so domain NotConfigured errors stay outside this catch.
 */
export async function apiRequest<T, TError extends Error>(
  options: ApiRequestOptions<TError>,
): Promise<T> {
  const {
    url,
    method = options.body === undefined ? 'GET' : 'POST',
    body,
    signal,
    timeoutMs,
    headers = {},
    offlineMessage,
    unavailableMessage,
    defaultErrorCode,
    createError,
    authenticate = true,
  } = options;

  const controller = timeoutMs !== undefined ? new AbortController() : undefined;
  const timer =
    controller && timeoutMs !== undefined
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;
  const onExternalAbort = () => controller?.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });
  if (signal?.aborted) controller?.abort();
  const requestSignal = controller?.signal ?? signal;
  const serializedBody = body === undefined ? undefined : JSON.stringify(body);
  const finishActivity = beginRuntimeOperation(
    { id: 'network.api', label: 'API requests', category: 'network' },
    { sentBytes: serializedBody?.length ?? 0, detail: method },
  );

  let response: Response;
  try {
    const auth = authenticate
      ? await waitWithSignal(authHeader(), requestSignal)
      : {};
    response = await fetch(url, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...auth,
        ...headers,
      },
      body: serializedBody,
      signal: requestSignal,
    });
  } catch (error) {
    finishActivity({ error: true });
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw createError(
      offlineMessage,
      defaultErrorCode === undefined ? 'OFFLINE' : defaultErrorCode,
    );
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  if (!response.ok) {
    const parsed = (await response.json().catch(() => undefined)) as
      | ApiErrorBody
      | undefined;
    finishActivity({
      error: true,
      receivedBytes: Number(response.headers.get('content-length')) || 0,
    });
    throw createError(
      parsed?.error ?? unavailableMessage,
      parsed?.code ?? defaultErrorCode,
      response.status,
    );
  }

  finishActivity({ receivedBytes: Number(response.headers.get('content-length')) || 0 });
  return response.json() as Promise<T>;
}
