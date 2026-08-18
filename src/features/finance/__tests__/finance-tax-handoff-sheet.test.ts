import { openTaxHandoffUrl, openTaxHandoffUrlOrAlert } from '../finance-tax-handoff-sheet';

const mockOpenHttpsUrl = jest.fn(async () => true);

jest.mock('@/utils/safe-url', () => ({
  openHttpsUrl: (...args: unknown[]) => mockOpenHttpsUrl(...args),
}));

describe('finance tax handoff URL helpers', () => {
  beforeEach(() => {
    mockOpenHttpsUrl.mockReset().mockResolvedValue(true);
  });

  it('opens known URLs through the HTTPS safe opener', async () => {
    await expect(openTaxHandoffUrl('https://www.irs.gov/')).resolves.toBe(true);

    expect(mockOpenHttpsUrl).toHaveBeenCalledWith('https://www.irs.gov/');
  });

  it('calls the provided callback when a destination cannot be opened', async () => {
    const onInvalid = jest.fn();
    mockOpenHttpsUrl.mockResolvedValue(false);

    const opened = await openTaxHandoffUrlOrAlert('javascript:alert(1)', onInvalid);

    expect(opened).toBe(false);
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });
});
