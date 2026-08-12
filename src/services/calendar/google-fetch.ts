const GOOGLE_API_TIMEOUT_MS = 20_000;

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
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
