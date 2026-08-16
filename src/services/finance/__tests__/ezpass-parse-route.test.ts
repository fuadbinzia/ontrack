/* eslint-disable import/first -- Jest mocks must initialize before the route module. */
const mockAnalyzeEzPassFiles = jest.fn();
const mockAuthorizeEzPassAi = jest.fn();
const mockApiCorsHeaders = jest.fn((_request?: Request) => ({
  'Access-Control-Allow-Origin': 'https://ontrack.example',
}));
const mockApiOptionsResponse = jest.fn((_request?: Request) => new Response(null, { status: 204 }));

jest.mock('@/services/finance/ezpass-ai-server', () => ({
  analyzeEzPassFiles: (files: unknown, safetyIdentifier: string) =>
    mockAnalyzeEzPassFiles(files, safetyIdentifier),
  authorizeEzPassAi: (request: Request) => mockAuthorizeEzPassAi(request),
}));

jest.mock('@/services/http/cors', () => ({
  apiCorsHeaders: (request: Request) => mockApiCorsHeaders(request),
  apiOptionsResponse: (request: Request) => mockApiOptionsResponse(request),
}));

import * as route from '@/app/api/finance/ezpass/parse+api';

function request(body: string): Request {
  return new Request('https://ontrack.example/api/finance/ezpass/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://ontrack.example' },
    body,
  });
}

describe('E-ZPass statement parsing API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthorizeEzPassAi.mockResolvedValue({ auth: { status: 'ok', userId: 'user-synthetic' } });
  });

  it('delegates preflight requests to the shared CORS boundary', () => {
    const incoming = new Request('https://ontrack.example/api/finance/ezpass/parse', {
      method: 'OPTIONS',
    });

    expect(route.OPTIONS(incoming).status).toBe(204);
    expect(mockApiOptionsResponse).toHaveBeenCalledWith(incoming);
  });

  it('returns an authorization response without parsing files', async () => {
    mockAuthorizeEzPassAi.mockResolvedValueOnce({
      response: Response.json({ code: 'RATE_LIMITED' }, { status: 429 }),
    });

    const response = await route.POST(request(JSON.stringify({ files: [] })));

    expect(response!.status).toBe(429);
    expect(mockAnalyzeEzPassFiles).not.toHaveBeenCalled();
  });

  it.each(['{', '{}', JSON.stringify({ files: 'statement.pdf' })])(
    'rejects malformed or missing file arrays for %s',
    async (body) => {
      const response = await route.POST(request(body));

      expect(response!.status).toBe(400);
      await expect(response!.json()).resolves.toEqual({ error: 'Files are required.' });
      expect(mockAnalyzeEzPassFiles).not.toHaveBeenCalled();
    },
  );

  it('analyzes files with the authenticated user and applies CORS headers', async () => {
    const files = [{ name: 'statement.pdf', mimeType: 'application/pdf', data: 'synthetic' }];
    mockAnalyzeEzPassFiles.mockResolvedValueOnce([{ merchant: 'Synthetic Toll', amount: 3.25 }]);
    const incoming = request(JSON.stringify({ files }));

    const response = await route.POST(incoming);

    expect(mockAuthorizeEzPassAi).toHaveBeenCalledWith(incoming);
    expect(mockAnalyzeEzPassFiles).toHaveBeenCalledWith(files, 'user-synthetic');
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('https://ontrack.example');
    await expect(response!.json()).resolves.toEqual({
      activities: [{ merchant: 'Synthetic Toll', amount: 3.25 }],
    });
  });

  it.each([
    ['INVALID_FILE', 400, 'INVALID_FILE'],
    ['FILE_TOO_LARGE', 400, 'FILE_TOO_LARGE'],
    ['TOO_MANY_PAGES', 400, 'TOO_MANY_PAGES'],
    ['NOT_CONFIGURED', 503, 'NOT_CONFIGURED'],
    ['provider detail that must not leak', 502, 'PROVIDER_FAILURE'],
  ])('maps %s failures to a safe response', async (message, status, code) => {
    mockAnalyzeEzPassFiles.mockRejectedValueOnce(new Error(message));

    const response = await route.POST(request(JSON.stringify({ files: [] })));

    expect(response!.status).toBe(status);
    await expect(response!.json()).resolves.toMatchObject({ code });
  });
});
