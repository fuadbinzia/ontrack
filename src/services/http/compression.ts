const DEFAULT_THRESHOLD_BYTES = 1_024;
const COMPRESSIBLE_CONTENT_TYPE =
  /^(?:application\/(?:json|javascript|xml)|text\/|image\/svg\+xml)/i;

function acceptsGzip(request: Request): boolean {
  const accepted = new Map(
    (request.headers.get('accept-encoding') ?? '')
      .split(',')
      .map((entry) => {
        const [encoding, ...parameters] = entry.trim().toLowerCase().split(';');
        const qualityParameter = parameters.find((parameter) =>
          parameter.trim().startsWith('q='),
        );
        const quality = qualityParameter
          ? Number(qualityParameter.trim().slice(2))
          : 1;
        return [encoding, Number.isFinite(quality) ? quality : 0] as const;
      }),
  );
  return (accepted.get('gzip') ?? accepted.get('*') ?? 0) > 0;
}

function appendVary(headers: Headers, value: string) {
  const values = new Set(
    (headers.get('Vary') ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  values.add(value);
  headers.set('Vary', [...values].join(', '));
}

/**
 * Compresses sufficiently large JSON/text responses when the user agent asks
 * for gzip. Native and browser fetch implementations decode the body before it
 * reaches response.json(), so callers do not need a separate parse path.
 */
export async function compressResponse(
  request: Request,
  response: Response,
  thresholdBytes = DEFAULT_THRESHOLD_BYTES,
): Promise<Response> {
  if (
    request.method === 'HEAD' ||
    !response.body ||
    response.headers.has('Content-Encoding') ||
    !COMPRESSIBLE_CONTENT_TYPE.test(response.headers.get('Content-Type') ?? '')
  ) {
    return response;
  }

  appendVary(response.headers, 'Accept-Encoding');
  if (!acceptsGzip(request)) return response;

  // Keep an untouched response available. Some local/native runtimes advertise
  // gzip while lacking a working CompressionStream implementation.
  const fallback = response.clone();
  const body = await response.arrayBuffer();
  if (body.byteLength < thresholdBytes) {
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  try {
    const compressedBody = await new Response(
      new Blob([body]).stream().pipeThrough(new CompressionStream('gzip')),
    ).arrayBuffer();
    const headers = new Headers(response.headers);
    headers.set('Content-Encoding', 'gzip');
    headers.set('Content-Length', String(compressedBody.byteLength));

    return new Response(compressedBody, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return fallback;
  }
}
