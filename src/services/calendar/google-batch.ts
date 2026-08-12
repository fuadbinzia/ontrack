export type GoogleBatchOperation = {
  id: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
};

export type GoogleBatchResult<T = unknown> = {
  status: number;
  body?: T;
};

export function buildGoogleBatchBody(boundary: string, operations: GoogleBatchOperation[]) {
  const lines: string[] = [];
  for (const operation of operations) {
    lines.push(
      `--${boundary}`,
      'Content-Type: application/http',
      `Content-ID: <${operation.id}>`,
      '',
      `${operation.method} ${operation.path} HTTP/1.1`,
    );
    if (operation.body !== undefined) lines.push('Content-Type: application/json; charset=UTF-8');
    lines.push('');
    if (operation.body !== undefined) lines.push(JSON.stringify(operation.body));
  }
  lines.push(`--${boundary}--`, '');
  return lines.join('\r\n');
}

export function parseGoogleBatchResponse<T>(contentType: string | null, responseText: string) {
  const boundary = contentType?.match(/boundary="?([^";]+)"?/i)?.[1];
  if (!boundary) throw new Error('Google Calendar returned an invalid batch response.');
  const results = new Map<string, GoogleBatchResult<T>>();
  for (const part of responseText.split(`--${boundary}`)) {
    const httpStart = part.search(/HTTP\/\d(?:\.\d)?\s+\d{3}/i);
    if (httpStart < 0) continue;
    const contentId = part.slice(0, httpStart).match(/Content-ID:\s*<?(?:response-)?([^>\r\n]+)>?/i)?.[1]?.trim();
    const embedded = part.slice(httpStart);
    const status = Number(embedded.match(/HTTP\/\d(?:\.\d)?\s+(\d{3})/i)?.[1]);
    if (!contentId || !Number.isFinite(status)) continue;
    const headerEnd = embedded.indexOf('\r\n\r\n');
    const rawBody = headerEnd >= 0 ? embedded.slice(headerEnd + 4).trim() : '';
    let body: T | undefined;
    if (rawBody) {
      try { body = JSON.parse(rawBody) as T; }
      catch { body = undefined; }
    }
    results.set(contentId, { status, body });
  }
  return results;
}
