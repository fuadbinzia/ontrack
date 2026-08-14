import {
  dismissEzPassNyAccount,
  EZPASS_NY_ACCOUNT_URL,
  openEzPassNyAccount,
} from '../ezpass-official-site';

const mockOpenBrowserAsync = jest.fn();
const mockDismissBrowser = jest.fn();

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowserAsync(...args),
  dismissBrowser: (...args: unknown[]) => mockDismissBrowser(...args),
}));

describe('E-ZPass official-site document return', () => {
  beforeEach(() => {
    mockOpenBrowserAsync.mockReset();
    mockDismissBrowser.mockReset();
  });

  it('opens the picker after the user manually closes the account site', async () => {
    mockOpenBrowserAsync.mockResolvedValue({ type: 'cancel' });
    await expect(openEzPassNyAccount()).resolves.toBe(true);
    expect(mockOpenBrowserAsync).toHaveBeenCalledWith(EZPASS_NY_ACCOUNT_URL);
  });

  it('skips the picker when a downloaded document dismisses the browser', async () => {
    mockOpenBrowserAsync.mockResolvedValue({ type: 'dismiss' });
    await expect(openEzPassNyAccount()).resolves.toBe(false);
  });

  it('dismisses an active download preview and tolerates no browser being open', async () => {
    mockDismissBrowser.mockResolvedValue({ type: 'dismiss' });
    await expect(dismissEzPassNyAccount()).resolves.toBeUndefined();
    expect(mockDismissBrowser).toHaveBeenCalledTimes(1);

    mockDismissBrowser.mockRejectedValue(new Error('No browser is open'));
    await expect(dismissEzPassNyAccount()).resolves.toBeUndefined();
  });
});
