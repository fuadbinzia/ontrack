const GOOGLE_API_TIMEOUT_MS = 20_000;

export class GoogleCalendarProviderTimeoutError extends Error {
  readonly code = 'PROVIDER_TIMEOUT';

  constructor() {
    super('Google Calendar took too long to respond. Tap Sync Now to continue.');
    this.name = 'GoogleCalendarProviderTimeoutError';
  }
}

/** Bound provider calls so a stalled Google endpoint cannot consume the whole API invocation. */
export async function fetchGoogleApi(
  url: string,
  init: RequestInit = {},
  timeoutMs = GOOGLE_API_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  if (externalSignal?.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut && !externalSignal?.aborted) {
      throw new GoogleCalendarProviderTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
