import { constantTimeEqual, signGatewayRequest, validTimestamp } from './security';

type Fetcher = { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
type ReplayStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
};

type Env = {
  TELLER_MTLS: Fetcher;
  TELLER_REPLAY: ReplayStore;
  TELLER_GATEWAY_SHARED_SECRET: string;
  TELLER_USE_MTLS?: string;
};

type GatewayBody = {
  operation?: 'accounts' | 'balances' | 'transactions' | 'disconnect';
  accessToken?: string;
  accountId?: string;
  query?: Record<string, string>;
};

const ACCOUNT_ID = /^acc_[A-Za-z0-9]+$/;
const QUERY_KEYS = new Set(['count', 'from_id', 'start_date', 'end_date']);

function jsonError(message: string, status: number, code: string): Response {
  return Response.json({ error: { message }, code }, { status });
}

function upstreamRequest(body: GatewayBody): { url: string; method: 'GET' | 'DELETE' } | undefined {
  if (!body.accessToken || body.accessToken.length > 512) return undefined;
  if (body.operation === 'accounts') {
    return { url: 'https://api.teller.io/accounts', method: 'GET' };
  }
  if (body.operation === 'disconnect') {
    return { url: 'https://api.teller.io/accounts', method: 'DELETE' };
  }
  if (!body.accountId || !ACCOUNT_ID.test(body.accountId)) return undefined;
  if (body.operation === 'balances') {
    return {
      url: `https://api.teller.io/accounts/${body.accountId}/balances`,
      method: 'GET',
    };
  }
  if (body.operation === 'transactions') {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(body.query ?? {})) {
      if (!QUERY_KEYS.has(key) || typeof value !== 'string' || value.length > 128) return undefined;
      search.set(key, value);
    }
    const suffix = search.size ? `?${search.toString()}` : '';
    return {
      url: `https://api.teller.io/accounts/${body.accountId}/transactions${suffix}`,
      method: 'GET',
    };
  }
  return undefined;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/teller') {
      return jsonError('Not found.', 404, 'NOT_FOUND');
    }
    const timestamp = request.headers.get('X-OnTrack-Timestamp') ?? '';
    const nonce = request.headers.get('X-OnTrack-Nonce') ?? '';
    const receivedSignature = request.headers.get('X-OnTrack-Signature') ?? '';
    const rawBody = await request.text();
    if (!validTimestamp(timestamp) || !/^[A-Za-z0-9_-]{20,128}$/.test(nonce)) {
      return jsonError('Request signature expired.', 401, 'SIGNATURE_EXPIRED');
    }
    const expectedSignature = await signGatewayRequest(
      env.TELLER_GATEWAY_SHARED_SECRET,
      timestamp,
      nonce,
      rawBody,
    );
    if (!constantTimeEqual(expectedSignature, receivedSignature)) {
      return jsonError('Request signature is invalid.', 401, 'INVALID_SIGNATURE');
    }
    if (await env.TELLER_REPLAY.get(nonce)) {
      return jsonError('Request was already used.', 409, 'REPLAYED_REQUEST');
    }
    await env.TELLER_REPLAY.put(nonce, timestamp, { expirationTtl: 600 });

    let body: GatewayBody;
    try {
      body = JSON.parse(rawBody) as GatewayBody;
    } catch {
      return jsonError('Request body is invalid.', 400, 'INVALID_BODY');
    }
    const upstream = upstreamRequest(body);
    if (!upstream || !body.accessToken) {
      return jsonError('Unsupported Teller operation.', 400, 'INVALID_OPERATION');
    }
    const init: RequestInit = {
      method: upstream.method,
      headers: {
        Authorization: `Basic ${btoa(`${body.accessToken}:`)}`,
        'Teller-Version': '2020-10-12',
      },
    };
    const fetcher = env.TELLER_USE_MTLS === 'false' ? { fetch } : env.TELLER_MTLS;
    const response = await fetcher.fetch(upstream.url, init);
    if (response.status === 204) return new Response(null, { status: 204 });
    const payload = await response.text();
    return new Response(payload, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
    });
  },
};
