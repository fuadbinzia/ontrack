const mockGateGuestPaidApiRequest = jest.fn();
const mockParseAgentRunInput = jest.fn();
const mockRunAgentTurn = jest.fn();

jest.mock('@/services/http/api-gate', () => ({
  gateGuestPaidApiRequest: (...args: unknown[]) => mockGateGuestPaidApiRequest(...args),
}));

jest.mock('@/services/agents/run-server', () => ({
  parseAgentRunInput: (...args: unknown[]) => mockParseAgentRunInput(...args),
  runAgentTurn: (...args: unknown[]) => mockRunAgentTurn(...args),
}));

const route = require('../run+api') as typeof import('../run+api');

describe('agents run API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGateGuestPaidApiRequest.mockResolvedValue('ok');
    mockParseAgentRunInput.mockReturnValue({ message: 'Open plants' });
    mockRunAgentTurn.mockResolvedValue({ type: 'text', text: 'Opened Plants.' });
  });

  function request(body: unknown = { message: 'Open plants' }) {
    return new Request('https://api.example.test/api/agents/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('lets guests run companion turns without a sign-in 401', async () => {
    const response = await route.POST(request());
    expect(mockGateGuestPaidApiRequest).toHaveBeenCalledWith(expect.any(Request), 'agents');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ type: 'text', text: 'Opened Plants.' });
  });

  it('still rate-limits companion turns', async () => {
    mockGateGuestPaidApiRequest.mockResolvedValue('rate_limited');
    const response = await route.POST(request());
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: 'onTrack companion limit reached. Try again later.',
      code: 'RATE_LIMITED',
    });
    expect(mockRunAgentTurn).not.toHaveBeenCalled();
  });

  it('rejects invalid input after the guest gate', async () => {
    mockParseAgentRunInput.mockReturnValue(null);
    const response = await route.POST(request({}));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
