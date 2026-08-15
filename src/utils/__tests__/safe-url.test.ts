import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { openHttpsUrl } from '../safe-url';

describe('openHttpsUrl', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue({
      type: WebBrowser.WebBrowserResultType.OPENED,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps YouTube links inside onTrack before the user chooses an app handoff', async () => {
    const url = 'https://www.youtube.com/results?search_query=fight+updates';

    await expect(openHttpsUrl(url)).resolves.toBe(true);

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      enableBarCollapsing: true,
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('uses the system browser only when the in-app browser cannot be presented', async () => {
    const url = 'https://www.youtube.com/results?search_query=fight+updates';
    jest.mocked(WebBrowser.openBrowserAsync).mockRejectedValueOnce(new Error('Unavailable'));

    await expect(openHttpsUrl(url)).resolves.toBe(true);

    expect(Linking.openURL).toHaveBeenCalledWith(url);
  });

  it.each([
    'youtube://results?search_query=fight+updates',
    'javascript:alert(1)',
    'not a URL',
    undefined,
  ])('rejects unsafe or invalid values without opening anything: %s', async (value) => {
    await expect(openHttpsUrl(value)).resolves.toBe(false);

    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
});
