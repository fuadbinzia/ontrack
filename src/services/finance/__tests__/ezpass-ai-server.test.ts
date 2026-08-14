import {
  analyzeEzPassFiles,
  authorizeEzPassAi,
  validateEzPassAiFiles,
} from '../ezpass-ai-server';

const mockAuthenticateApiRequest = jest.fn();
const mockIsApiRequestBlocked = jest.fn();
const mockCheckApiRateLimit = jest.fn();

jest.mock('@/services/http/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => mockAuthenticateApiRequest(...args),
  isApiRequestBlocked: (...args: unknown[]) => mockIsApiRequestBlocked(...args),
  apiRateLimitSubject: () => 'user:synthetic-user',
}));
jest.mock('@/services/http/api-rate-limit', () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));

jest.mock('@/services/ai', () => ({
  defaultOpenAIModel: () => 'test-model',
  fetchOpenAIResponses: jest.fn(async () => ({ output_text: JSON.stringify({
    activities: [{
      date: '2026-08-01',
      amount: 6.94,
      description: 'RFK Bridge',
      time: null,
      type: 'Toll',
      reference: null,
    }],
  }) })),
  parseOpenAIJsonResponse: (body: { output_text: string }) => JSON.parse(body.output_text),
}));

const image = {
  name: 'statement.png',
  mimeType: 'image/png',
  dataUrl: `data:image/png;base64,${Buffer.from('synthetic image').toString('base64')}`,
};

describe('E-ZPass AI parser privacy boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    mockAuthenticateApiRequest.mockResolvedValue({ status: 'ok', userId: 'synthetic-user' });
    mockIsApiRequestBlocked.mockReturnValue(false);
    mockCheckApiRateLimit.mockReturnValue('allowed');
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('accepts supported bounded input and returns schema-validated rows', async () => {
    expect(() => validateEzPassAiFiles([image])).not.toThrow();
    await expect(analyzeEzPassFiles([image], 'synthetic-user')).resolves.toEqual([
      expect.objectContaining({ date: '2026-08-01', amount: 6.94, description: 'RFK Bridge' }),
    ]);
  });

  it('rejects unsupported files, mismatched data URLs, and oversized page counts', () => {
    expect(() => validateEzPassAiFiles([{ ...image, mimeType: 'text/csv' }])).toThrow('INVALID_FILE');
    expect(() => validateEzPassAiFiles([{ ...image, mimeType: 'image/jpeg' }])).toThrow('INVALID_FILE');
    const pdf = Buffer.from(Array.from({ length: 13 }, () => '/Type /Page').join('\n')).toString('base64');
    expect(() => validateEzPassAiFiles([{
      name: 'long.pdf',
      mimeType: 'application/pdf',
      dataUrl: `data:application/pdf;base64,${pdf}`,
    }])).toThrow('TOO_MANY_PAGES');
  });

  it('requires authentication and rate-limits raw financial document processing', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({ status: 'missing' });
    mockIsApiRequestBlocked.mockReturnValueOnce(true);
    const denied = await authorizeEzPassAi(new Request('https://ontrack.example/parse'));
    if (!('response' in denied) || !denied.response) {
      throw new Error('Expected a missing-auth response.');
    }
    expect(denied.response.status).toBe(401);
    expect(mockCheckApiRateLimit).not.toHaveBeenCalled();

    mockCheckApiRateLimit.mockReturnValueOnce('limited');
    const limited = await authorizeEzPassAi(new Request('https://ontrack.example/parse'));
    if (!('response' in limited) || !limited.response) {
      throw new Error('Expected a rate-limit response.');
    }
    expect(limited.response.status).toBe(429);
    expect(mockCheckApiRateLimit).toHaveBeenCalledWith('finance', 'user:synthetic-user');
  });
});
