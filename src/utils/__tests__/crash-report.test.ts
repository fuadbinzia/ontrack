import {
  buildCrashLogText,
  crashReportSubject,
  sendCrashReport,
} from '../crash-report';

jest.mock('@/services/http/api-url', () => ({
  resolveExpoApiUrl: (path: string) => `https://api.example.test${path}`,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    nativeAppVersion: '1.0.0',
    nativeBuildVersion: '42',
    expoConfig: { version: '1.0.0' },
  },
}));

jest.mock('expo-device', () => ({
  brand: 'Apple',
  modelName: 'iPhone',
  osName: 'iOS',
  osVersion: '18.0',
}));

describe('crash-report', () => {
  const originalFetch = global.fetch;
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ sent: true })));
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('builds a log with error stack and device/app fields', () => {
    const error = new Error('Boom');
    error.stack = 'Error: Boom\n    at screen';
    const text = buildCrashLogText({ error, context: 'travel/plan' });
    expect(text).toContain('onTrack crash report');
    expect(text).toContain('Boom');
    expect(text).toContain('Error: Boom');
    expect(text).toContain('Context: travel/plan');
    expect(text).toContain('Version: 1.0.0 (42)');
    expect(text).toContain('Model: iPhone');
  });

  it('keeps the email subject concise', () => {
    const error = new Error('x'.repeat(200));
    expect(crashReportSubject(error).length).toBeLessThanOrEqual(100);
  });

  it('sends the crash report directly to the server without opening system UI', async () => {
    const result = await sendCrashReport({ error: new Error('Direct delivery') });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.test/api/crash-report',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const request = mockFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      subject: expect.stringContaining('Direct delivery'),
      report: expect.stringContaining('Direct delivery'),
    });
    expect(result).toEqual({ method: 'sent' });
  });

  it.each([
    ['server rejection', () => mockFetch.mockResolvedValueOnce(new Response(null, { status: 503 }))],
    ['offline failure', () => mockFetch.mockRejectedValueOnce(new Error('offline'))],
  ])('reports %s without claiming the crash report was sent', async (_label, arrange) => {
    arrange();
    const result = await sendCrashReport({ error: new Error('Not delivered') });
    expect(result).toMatchObject({
      method: 'unavailable',
      reason: expect.stringContaining('could not send'),
    });
  });
});
