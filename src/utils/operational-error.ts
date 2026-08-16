import { recordFlowOutcome } from '@/store/flow-analytics';

import { sendCrashReport } from './crash-report';

const DEDUPE_MS = 10 * 60 * 1000;
const recentReports = new Map<string, number>();

const OPERATIONAL_MESSAGE =
  /temporarily unavailable|(?<![a-z])unavailable(?![a-z])|not configured|is offline|(?<![a-z])offline(?![a-z])|provider is busy|too many .{0,40}requests|could not be (loaded|refreshed|sent)|discovery failed|delivery failed|HTTP_\d{3}|PROVIDER_UNAVAILABLE|SPORTS_NOT_CONFIGURED|CONCERTS_NOT_CONFIGURED/i;

export function resetOperationalFailureReportsForTests() {
  recentReports.clear();
}

export function isOperationalErrorMessage(message: string | undefined): boolean {
  const value = message?.trim();
  if (!value) return false;
  return OPERATIONAL_MESSAGE.test(value);
}

export function isOperationalFailure(message: string | undefined, status?: number): boolean {
  if (status === 401 || status === 403) return false;
  if (status === 0 || status === 429 || (status !== undefined && status >= 500)) return true;
  return isOperationalErrorMessage(message);
}

/** User-facing copy only. Backend / provider outages stay off the screen. */
export function userVisibleError(message: string | undefined): string | undefined {
  const value = message?.trim();
  if (!value || isOperationalErrorMessage(value)) return undefined;
  return value;
}

export function reportOperationalFailure(message: string, context = 'backend'): void {
  const key = message.trim();
  if (!key || !isOperationalFailure(key)) return;
  const now = Date.now();
  const last = recentReports.get(key) ?? 0;
  if (now - last < DEDUPE_MS) return;
  recentReports.set(key, now);

  recordFlowOutcome('backend.service', 'fail');
  const error = new Error(key);
  error.name = 'OperationalError';
  void sendCrashReport({ error, context }).catch(() => undefined);
}
