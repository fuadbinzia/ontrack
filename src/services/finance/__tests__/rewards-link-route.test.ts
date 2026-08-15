import * as route from '../../../app/api/finance/rewards/import-link+api';

const mockGatePaidApiRequest = jest.fn();
const mockAuthenticateApiRequest = jest.fn();
const mockAnalyzeRewardCardLink = jest.fn();

jest.mock('@/services/http/api-gate', () => ({
  gatePaidApiRequest: (...args: unknown[]) => mockGatePaidApiRequest(...args),
}));

jest.mock('@/services/http/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => mockAuthenticateApiRequest(...args),
}));

jest.mock('../rewards-link-server', () => ({
  analyzeRewardCardLink: (...args: unknown[]) => mockAnalyzeRewardCardLink(...args),
  manualFallbackRewardDraft: (url: string, warning: string) => ({
    issuer: '',
    name: '',
    ownership: 'owned',
    rewardCurrency: 'points',
    pointValueCents: 1,
    baseMultiplier: 1,
    annualFee: 0,
    rules: [],
    benefits: [],
    source: { url, kind: 'third_party', warnings: [warning] },
    editedFields: [],
  }),
}));

function request(body: unknown): Request {
  return new Request('https://ontrack.example/api/finance/rewards/import-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('reward-card link import route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGatePaidApiRequest.mockResolvedValue('allowed');
    mockAuthenticateApiRequest.mockResolvedValue({ status: 'ok', userId: 'user-1' });
    mockAnalyzeRewardCardLink.mockResolvedValue({ name: 'Example Card' });
  });

  it('requires authentication before reading or fetching a URL', async () => {
    mockGatePaidApiRequest.mockResolvedValue('unauthenticated');
    const response = await route.POST(request({ url: 'https://issuer.example/card' }));

    expect(response.status).toBe(401);
    expect(mockAnalyzeRewardCardLink).not.toHaveBeenCalled();
  });

  it('enforces the finance rate limit', async () => {
    mockGatePaidApiRequest.mockResolvedValue('rate_limited');
    const response = await route.POST(request({ url: 'https://issuer.example/card' }));

    expect(response.status).toBe(429);
    expect(mockAnalyzeRewardCardLink).not.toHaveBeenCalled();
  });

  it('uses the authenticated user as the fetch-safety identifier', async () => {
    const response = await route.POST(request({ url: 'https://issuer.example/card' }));

    expect(response.status).toBe(200);
    expect(mockAnalyzeRewardCardLink).toHaveBeenCalledWith(
      'https://issuer.example/card',
      'user-1',
    );
  });

  it('returns a retained-URL manual draft when safe extraction fails', async () => {
    mockAnalyzeRewardCardLink.mockRejectedValue(new Error('UNSUPPORTED_CONTENT'));
    const response = await route.POST(request({ url: 'https://issuer.example/terms.pdf' }));
    const body = await response.json() as { source: { url: string; warnings: string[] } };

    expect(response.status).toBe(200);
    expect(body.source.url).toBe('https://issuer.example/terms.pdf');
    expect(body.source.warnings[0]).toContain('public HTML');
  });
});
