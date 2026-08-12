/**
 * Fetch with an AbortController timeout. Merges an optional external signal
 * so callers can cancel early without losing the timeout.
 */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = 8_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const external = init?.signal;
  const onExternalAbort = () => controller.abort();
  external?.addEventListener('abort', onExternalAbort, { once: true });
  if (external?.aborted) controller.abort();
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }
}
