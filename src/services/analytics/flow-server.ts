import { createClient } from '@supabase/supabase-js';

import {
  FLOW_ANALYTICS_SCHEMA_VERSION,
  FLOW_EVENT_BATCH_MAX,
  FLOW_PERFORMANCE_METRICS,
  collapseFlowPath,
  isKnownAnalyticsRoute,
  isOutcomeId,
  type FlowAnalyticsEvent,
  type FlowEventBatchV1,
} from './flow-model';
import { apiCorsHeaders } from '@/services/http/cors';

const MAX_REQUEST_BYTES = 32_768;
const MAX_REQUESTS_PER_MINUTE = 30;
const ALLOWED_BATCH_KEYS = new Set(['schemaVersion', 'installId', 'platform', 'environment', 'appVersion', 'events']);
const ALLOWED_EVENT_KEYS = new Set(['id', 'sessionId', 'occurredAt', 'lifecycle', 'route', 'fromRoute', 'outcomeId', 'path', 'metric', 'durationMs']);
const recentRequests = new Map<string, number[]>();

function exactKeys(value: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function requestSubject(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

function rateLimited(subject: string, now = Date.now()) {
  const cutoff = now - 60_000;
  const recent = (recentRequests.get(subject) ?? []).filter((stamp) => stamp > cutoff);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) return true;
  recent.push(now);
  recentRequests.set(subject, recent);
  return false;
}

function validTimestamp(value: unknown, now = Date.now()) {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed >= now - 7 * 86_400_000 && parsed <= now + 5 * 60_000;
}

function validEvent(value: unknown): value is FlowAnalyticsEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!exactKeys(item, ALLOWED_EVENT_KEYS)) return false;
  if (typeof item.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(item.id)) return false;
  if (typeof item.sessionId !== 'string' || !/^flow-session-[a-z0-9-]{4,80}$/i.test(item.sessionId)) return false;
  if (!validTimestamp(item.occurredAt) || !isKnownAnalyticsRoute(item.route)) return false;
  if (item.fromRoute !== undefined && !isKnownAnalyticsRoute(item.fromRoute)) return false;
  if (!['visit', 'complete', 'fail', 'measure', 'heartbeat', 'session-end'].includes(String(item.lifecycle))) return false;
  if (item.outcomeId !== undefined && !isOutcomeId(item.outcomeId)) return false;
  if (item.lifecycle === 'fail' && !isOutcomeId(item.outcomeId)) return false;
  if (item.lifecycle === 'measure') {
    if (!FLOW_PERFORMANCE_METRICS.includes(item.metric as never)) return false;
    if (!Number.isInteger(item.durationMs) || Number(item.durationMs) < 0 || Number(item.durationMs) > 120_000) return false;
    if (item.metric === 'action' && !isOutcomeId(item.outcomeId)) return false;
    if (item.metric === 'page-load' && item.outcomeId !== undefined) return false;
  } else if (item.metric !== undefined || item.durationMs !== undefined) return false;
  if (item.path !== undefined) {
    if (!Array.isArray(item.path) || item.path.length > 30 || !item.path.every(isKnownAnalyticsRoute)) return false;
    if (collapseFlowPath(item.path).length !== item.path.length) return false;
  }
  return true;
}

export function validateFlowEventBatch(value: unknown): FlowEventBatchV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const batch = value as Record<string, unknown>;
  if (!exactKeys(batch, ALLOWED_BATCH_KEYS)) return undefined;
  if (batch.schemaVersion !== FLOW_ANALYTICS_SCHEMA_VERSION) return undefined;
  if (typeof batch.installId !== 'string' || !/^inst_[a-z0-9_]{8,80}$/i.test(batch.installId)) return undefined;
  if (!['ios', 'android', 'web', 'unknown'].includes(String(batch.platform))) return undefined;
  if (!['production', 'testflight', 'preview', 'development'].includes(String(batch.environment))) return undefined;
  if (typeof batch.appVersion !== 'string' || !/^[a-zA-Z0-9._+-]{1,32}$/.test(batch.appVersion)) return undefined;
  if (!Array.isArray(batch.events) || batch.events.length === 0 || batch.events.length > FLOW_EVENT_BATCH_MAX) return undefined;
  if (!batch.events.every(validEvent)) return undefined;
  return batch as FlowEventBatchV1;
}

async function hmac(value: string) {
  const secret = process.env.ANALYTICS_INSTALL_HASH_SECRET?.trim();
  if (!secret) throw new Error('ANALYTICS_INSTALL_HASH_SECRET is not configured.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function adminClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('Flow analytics storage is not configured.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function json(request: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: apiCorsHeaders(request, 'POST, OPTIONS') });
}

export function resetFlowAnalyticsRateLimitsForTests() {
  recentRequests.clear();
}

export async function ingestFlowAnalytics(request: Request, payload: unknown): Promise<Response> {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) return json(request, { error: 'Analytics batch is too large.' }, 413);
  const batch = validateFlowEventBatch(payload);
  if (!batch) {
    if (process.env.NODE_ENV !== 'production') {
      const candidate = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : undefined;
      const events = Array.isArray(candidate?.events) ? candidate.events : [];
      console.error('[flow-analytics] invalid batch', {
        batchKeys: candidate ? Object.keys(candidate).sort() : [],
        schemaVersionValid: candidate?.schemaVersion === FLOW_ANALYTICS_SCHEMA_VERSION,
        installIdValid: typeof candidate?.installId === 'string'
          && /^inst_[a-z0-9_]{8,80}$/i.test(candidate.installId),
        platformValid: ['ios', 'android', 'web', 'unknown'].includes(String(candidate?.platform)),
        environmentValid: ['production', 'testflight', 'preview', 'development'].includes(String(candidate?.environment)),
        appVersionValid: typeof candidate?.appVersion === 'string'
          && /^[a-zA-Z0-9._+-]{1,32}$/.test(candidate.appVersion),
        eventCount: events.length,
        eventChecks: events.slice(0, FLOW_EVENT_BATCH_MAX).map((value) => {
          const item = value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {};
          return {
            keys: Object.keys(item).sort(),
            idValid: typeof item.id === 'string' && /^[0-9a-f-]{36}$/i.test(item.id),
            sessionIdValid: typeof item.sessionId === 'string'
              && /^flow-session-[a-z0-9-]{4,80}$/i.test(item.sessionId),
            timestampValid: validTimestamp(item.occurredAt),
            routeKnown: isKnownAnalyticsRoute(item.route),
            fromRouteKnown: item.fromRoute === undefined || isKnownAnalyticsRoute(item.fromRoute),
            lifecycleValid: ['visit', 'complete', 'fail', 'measure', 'heartbeat', 'session-end'].includes(String(item.lifecycle)),
            outcomeValid: item.outcomeId === undefined || isOutcomeId(item.outcomeId),
            performanceValid: item.lifecycle !== 'measure' || (
              FLOW_PERFORMANCE_METRICS.includes(item.metric as never)
              && Number.isInteger(item.durationMs)
            ),
          };
        }),
      });
    }
    return json(request, { error: 'Invalid analytics batch.' }, 400);
  }
  if (rateLimited(requestSubject(request))) return json(request, { error: 'Too many analytics requests.' }, 429);
  try {
    const installHash = await hmac(batch.installId);
    const events = await Promise.all(batch.events.map(async (item) => ({
      ...item,
      sessionHash: await hmac(`${batch.installId}:${item.sessionId}`),
      pathHash: item.path ? await hmac(JSON.stringify(item.path)) : undefined,
      sessionId: undefined,
    })));
    const { error } = await adminClient().rpc('record_analytics_flow_batch', {
      p_install_hash: installHash,
      p_platform: batch.platform,
      p_environment: batch.environment,
      p_app_version: batch.appVersion,
      p_events: events,
    });
    if (error) {
      console.error('[flow-analytics] storage rejected batch', {
        code: error.code,
        message: error.message,
      });
      return json(request, { error: 'Analytics storage rejected the batch.' }, 502);
    }
    return json(request, { accepted: batch.events.map((item) => item.id) });
  } catch (error) {
    console.error('[flow-analytics] ingestion unavailable', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown ingestion failure',
    });
    return json(request, { error: 'Flow analytics is unavailable.' }, 503);
  }
}
