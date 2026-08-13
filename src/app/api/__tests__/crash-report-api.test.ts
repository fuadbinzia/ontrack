import * as route from '../crash-report+api';

import { resetCrashReportRateLimitsForTests } from '@/services/crash-report/server';

const originalFetch = global.fetch;
const mockFetch = jest.fn();

describe('Crash report API route', () => {
  const originalEnv = {
    apiKey: process.env.RESEND_API_KEY,
    to: process.env.CRASH_REPORT_TO_EMAIL,
    support: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
    from: process.env.CRASH_REPORT_FROM_EMAIL,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    resetCrashReportRateLimitsForTests();
    process.env.RESEND_API_KEY = 'synthetic-resend-key';
    process.env.CRASH_REPORT_TO_EMAIL = 'support@example.com';
    process.env.CRASH_REPORT_FROM_EMAIL = 'onTrack <reports@example.com>';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 'email-1' })));
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalEnv.apiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalEnv.apiKey;
    if (originalEnv.to === undefined) delete process.env.CRASH_REPORT_TO_EMAIL;
    else process.env.CRASH_REPORT_TO_EMAIL = originalEnv.to;
    if (originalEnv.support === undefined) delete process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
    else process.env.EXPO_PUBLIC_SUPPORT_EMAIL = originalEnv.support;
    if (originalEnv.from === undefined) delete process.env.CRASH_REPORT_FROM_EMAIL;
    else process.env.CRASH_REPORT_FROM_EMAIL = originalEnv.from;
  });

  function request(body: unknown, forwardedFor = '192.0.2.1') {
    return new Request('https://api.example.test/api/crash-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': forwardedFor,
      },
      body: JSON.stringify(body),
    });
  }

  it('delivers a valid crash report through the server-only email provider', async () => {
    const response = await route.POST(
      request({ subject: 'onTrack crash: Boom', report: 'Error: Boom\nstack' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sent: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer synthetic-resend-key',
        }),
      }),
    );
    const providerRequest = mockFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(providerRequest.body as string)).toEqual({
      from: 'onTrack <reports@example.com>',
      to: ['support@example.com'],
      subject: 'onTrack crash: Boom',
      text: 'Error: Boom\nstack',
    });
  });

  it.each([
    ['missing report', { subject: 'onTrack crash: Boom' }],
    ['oversized subject', { subject: 'x'.repeat(121), report: 'Error' }],
    ['oversized report', { subject: 'Crash', report: 'x'.repeat(40_001) }],
  ])('rejects %s before contacting the provider', async (_label, body) => {
    const response = await route.POST(request(body));
    expect(response.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not claim success when delivery is unconfigured or rejected', async () => {
    delete process.env.RESEND_API_KEY;
    const unconfigured = await route.POST(
      request({ subject: 'Crash', report: 'Error' }),
    );
    expect(unconfigured.status).toBe(503);

    process.env.RESEND_API_KEY = 'synthetic-resend-key';
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 422 }));
    const rejected = await route.POST(
      request({ subject: 'Crash', report: 'Error' }, '192.0.2.2'),
    );
    expect(rejected.status).toBe(502);
  });

  it('rate-limits repeated reports from the same network address', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await route.POST(
        request({ subject: 'Crash', report: 'Error' }),
      );
      expect(response.status).toBe(200);
    }
    const limited = await route.POST(
      request({ subject: 'Crash', report: 'Error' }),
    );
    expect(limited.status).toBe(429);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
