import { openCreditProviderUrlOrAlert, openCreditProviderUrl } from '../finance-credit-sheet';

const mockOpenHttpsUrl = jest.fn(async () => true);

jest.mock('@/utils/safe-url', () => ({
  openHttpsUrl: (...args: unknown[]) => mockOpenHttpsUrl(...args),
}));

describe('finance credit provider URL launch', () => {
  beforeEach(() => {
    mockOpenHttpsUrl.mockReset().mockResolvedValue(true);
  });

  it('uses the shared HTTPS opener for provider links', async () => {
    await expect(openCreditProviderUrl('https://example.com')).resolves.toBe(true);

    expect(mockOpenHttpsUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('warns callers when a provider URL cannot be opened', async () => {
    const onInvalid = jest.fn();
    mockOpenHttpsUrl.mockResolvedValue(false);

    const opened = await openCreditProviderUrlOrAlert('javascript:alert(1)', onInvalid);

    expect(opened).toBe(false);
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  it('returns false when shared HTTPS opener rejects unsafe links', async () => {
    mockOpenHttpsUrl.mockResolvedValue(false);

    await expect(openCreditProviderUrl('javascript:alert(1)')).resolves.toBe(false);
  });
});
