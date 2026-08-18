import { isDateKey } from '@/utils/date';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** NANP-style phones. ISO dates like 2026-08-17 must not match. */
const PHONE_RE =
  /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\d)/g;
const DASHED_DAY_YEAR_RE = /^\d{2}-\d{2}-\d{4}$/;

const OMIT_KEYS = new Set([
  'attendeeEmails',
  'email',
  'reservationEmail',
  'appleHealth',
  'vin',
  'policyNumber',
  'goal',
]);

function keepPhoneMatch(match: string): boolean {
  return isDateKey(match) || DASHED_DAY_YEAR_RE.test(match);
}

function redactString(value: string): string {
  return value
    .replace(EMAIL_RE, '[redacted]')
    .replace(PHONE_RE, (match) => (keepPhoneMatch(match) ? match : '[redacted]'));
}

/** Strip emails, phones, Health raw payloads, and preference names from tool results. Keep dates. */
export function redactToolResult(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value);
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return value.map(redactToolResult);
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (OMIT_KEYS.has(key)) continue;
    output[key] = redactToolResult(nested);
  }
  return output;
}
