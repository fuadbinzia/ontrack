const encoder = new TextEncoder();

export const MAX_CLOCK_SKEW_MS = 5 * 60_000;

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function signGatewayRequest(
  secret: string,
  timestamp: string,
  nonce: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${nonce}.${body}`),
  )));
}

export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function validTimestamp(value: string, now = Date.now()): boolean {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && Math.abs(now - timestamp) <= MAX_CLOCK_SKEW_MS;
}
