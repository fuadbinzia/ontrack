/**
 * Same-JS-session navigation memory for Fast Refresh remounts.
 * Cold starts leave this null so the bootstrap resolver can open Overview.
 */

export const DEFAULT_APP_LANDING_PATH = '/overview';

const TODAY_PATHS = new Set(['/', '/(tabs)', '/(tabs)/', '/index', '/(today)']);

/** Auth / boot shells — never remember or restore these. */
const TRANSIENT_PREFIXES = [
  '/welcome',
  '/onboarding',
  '/auth/',
  '/agent/ui',
] as const;

let lastInAppPathname: string | null = null;
let restoreAttemptedForPath: string | null = null;

function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isTodayPathname(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return TODAY_PATHS.has(path) || path === '/(tabs)/index';
}

export function isTransientPathname(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return TRANSIENT_PREFIXES.some(
    (prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix),
  );
}

export function isRestorablePathname(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (!path || isTodayPathname(path) || isTransientPathname(path)) return false;
  return path.startsWith('/');
}

/**
 * Record the current in-app route so a remount can restore it.
 * Landing on Today clears memory (intentional Today) — call restore
 * consumption first on mount before this runs.
 */
export function rememberNavigationPathname(pathname: string | null | undefined): void {
  if (!pathname) return;
  const path = normalizePathname(pathname);
  if (isTransientPathname(path)) return;
  if (isTodayPathname(path)) {
    lastInAppPathname = null;
    restoreAttemptedForPath = null;
    return;
  }
  if (!isRestorablePathname(path)) return;
  lastInAppPathname = path;
  if (restoreAttemptedForPath && restoreAttemptedForPath !== path) {
    restoreAttemptedForPath = null;
  }
}

export function getRememberedNavigationPathname(): string | null {
  return lastInAppPathname;
}

/**
 * If the navigator remounted on Today but we still remember another in-app
 * route from this JS session, return that path once for `router.replace`.
 */
export function consumeNavigationRestorePath(
  currentPathname: string | null | undefined,
): string | null {
  if (!lastInAppPathname) return null;
  const current = normalizePathname(currentPathname || '/');
  if (!isTodayPathname(current)) return null;
  if (!isRestorablePathname(lastInAppPathname)) return null;
  if (restoreAttemptedForPath === lastInAppPathname) return null;
  restoreAttemptedForPath = lastInAppPathname;
  return lastInAppPathname;
}

/**
 * Resolve the first app-shell destination. A same-session restore wins; a
 * genuine root launch falls through to Overview. The caller invokes this once
 * per mount, so an intentional later tap on Today stays put.
 */
export function resolveInitialNavigationPath(
  currentPathname: string | null | undefined,
): string | null {
  const restoreTo = consumeNavigationRestorePath(currentPathname);
  if (restoreTo) return restoreTo;
  return isTodayPathname(currentPathname || '/')
    ? DEFAULT_APP_LANDING_PATH
    : null;
}

/** Test helper — clears module memory between cases. */
export function resetNavigationSessionForTests(): void {
  lastInAppPathname = null;
  restoreAttemptedForPath = null;
}
