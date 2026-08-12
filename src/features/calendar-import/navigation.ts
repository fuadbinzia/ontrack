const SHARE_LINK_HOST = 'ontrack--links.expo.app';
const SHARE_PATH_PREFIXES = ['/i/', '/j/', '/f/', '/c/', '/l/', '/v/', '/p/'] as const;

function isSharePath(pathname: string): boolean {
  return (
    pathname === '/invite/travel' ||
    SHARE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/** Normalize OS-delivered share URLs into Expo Router paths. */
export function redirectIncomingSystemPath(path: string): string {
  try {
    const url = new URL(path, 'ontrack://app');
    if (url.hostname === 'expo-sharing') return '/share-event';

    // Universal / App Links arrive as full https://… URLs. Strip the host so
    // Expo Router always lands on the shared route (`/l/…`, `/i/…`, …).
    if (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.hostname === SHARE_LINK_HOST &&
      isSharePath(url.pathname)
    ) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return '/';
  }
  return path;
}
