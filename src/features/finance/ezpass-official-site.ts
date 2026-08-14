import * as WebBrowser from 'expo-web-browser';

export const EZPASS_NY_ACCOUNT_URL = 'https://www.e-zpassny.com/';

/**
 * Opens the official account site without collecting E-ZPass credentials.
 * Returns whether the caller should show the document picker after the browser
 * closes. A native document handoff dismisses the browser itself and routes the
 * downloaded file directly, so it must not open a second picker.
 */
export async function openEzPassNyAccount(): Promise<boolean> {
  const result = await WebBrowser.openBrowserAsync(EZPASS_NY_ACCOUNT_URL);
  return result.type !== 'dismiss';
}

export async function dismissEzPassNyAccount(): Promise<void> {
  try {
    await WebBrowser.dismissBrowser();
  } catch {
    // Files and other apps can hand off documents without an in-app browser.
  }
}
