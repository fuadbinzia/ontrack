import { createClient } from '@supabase/supabase-js';

import {
  ingestFlowAnalytics,
  resetFlowAnalyticsRateLimitsForTests,
  validateFlowEventBatch,
} from '../flow-server';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const rpc = jest.fn();
const base = {
  schemaVersion: 1,
  installId: 'inst_abcdefgh_12345678',
  platform: 'ios',
  environment: 'production',
  appVersion: '1.0.71',
  events: [{
    id: '00000000-0000-4000-8000-000000000001',
    sessionId: 'flow-session-abc123',
    occurredAt: new Date().toISOString(),
    lifecycle: 'visit',
    route: '/travel/[id]',
  }],
} as const;

describe('flow analytics ingestion', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    resetFlowAnalyticsRateLimitsForTests();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
    process.env.ANALYTICS_INSTALL_HASH_SECRET = 'synthetic-install-hash-secret';
    rpc.mockResolvedValue({ error: null });
    (createClient as jest.Mock).mockReturnValue({ rpc });
  });

  afterAll(() => { process.env = originalEnv; });

  it('accepts only the versioned content-free contract', () => {
    expect(validateFlowEventBatch(base)).toBeDefined();
    expect(validateFlowEventBatch({ ...base, privateNote: 'nope' })).toBeUndefined();
    expect(validateFlowEventBatch({
      ...base,
      events: [{ ...base.events[0], route: '/travel/person@example.com' }],
    })).toBeUndefined();
    expect(validateFlowEventBatch({
      ...base,
      events: [{ ...base.events[0], lifecycle: 'fail' }],
    })).toBeUndefined();
  });

  it('accepts bounded performance samples and rejects malformed timing or free-text metrics', () => {
    expect(validateFlowEventBatch({
      ...base,
      events: [{
        ...base.events[0], lifecycle: 'measure', metric: 'page-load',
        durationMs: 840, fromRoute: '/travel',
      }],
    })).toBeDefined();
    expect(validateFlowEventBatch({
      ...base,
      events: [{
        ...base.events[0], lifecycle: 'measure', metric: 'action',
        durationMs: 420, outcomeId: 'travel.trip.save',
      }],
    })).toBeDefined();
    for (const event of [
      { ...base.events[0], lifecycle: 'measure', metric: 'database-query', durationMs: 200 },
      { ...base.events[0], lifecycle: 'measure', metric: 'page-load', durationMs: 120_001 },
      { ...base.events[0], lifecycle: 'measure', metric: 'action', durationMs: 200 },
      { ...base.events[0], lifecycle: 'visit', metric: 'page-load', durationMs: 200 },
    ]) {
      expect(validateFlowEventBatch({ ...base, events: [event] })).toBeUndefined();
    }
  });

  it('hashes install and session identifiers before service-role storage', async () => {
    const request = new Request('https://api.example.test/api/analytics/flows', {
      method: 'POST', headers: { 'x-forwarded-for': '192.0.2.5' }, body: JSON.stringify(base),
    });
    const response = await ingestFlowAnalytics(request, base);
    expect(response.status).toBe(200);
    const args = rpc.mock.calls[0][1];
    expect(args.p_install_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain(base.installId);
    expect(JSON.stringify(args)).not.toContain(base.events[0].sessionId);
    expect(args.p_events[0].sessionHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails closed when server-only analytics configuration is missing', async () => {
    delete process.env.ANALYTICS_INSTALL_HASH_SECRET;
    const response = await ingestFlowAnalytics(
      new Request('https://api.example.test/api/analytics/flows', { method: 'POST' }),
      base,
    );
    expect(response.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
});
