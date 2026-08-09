/**
 * Shared HTTPS-only opener for untrusted URLs (AI sources, synced recipe links).
 * Blocks javascript:, custom schemes, and protocol-relative abuse.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

export function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function safeHttpsUrl(value: unknown): string | undefined {
  return typeof value === 'string' && isHttpsUrl(value.trim()) ? value.trim() : undefined;
}

/**
 * Web links stay inside onTrack (SFSafariViewController / Chrome Custom Tabs)
 * so the user keeps their place. Falls back to the system browser only when the
 * in-app tab cannot be presented.
 */
export async function openInAppBrowser(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      enableBarCollapsing: true,
    });
  } catch {
    await Linking.openURL(url);
  }
}

export async function openHttpsUrl(value: unknown): Promise<boolean> {
  const url = safeHttpsUrl(value);
  if (!url) return false;
  await openInAppBrowser(url);
  return true;
}
