import { apiCorsHeaders } from '@/services/http/cors';

const MAX_SUBJECT_CHARS = 120;
const MAX_REPORT_CHARS = 40_000;
const MAX_REPORTS_PER_WINDOW = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RESEND_API_URL = 'https://api.resend.com/emails';

type CrashReportPayload = {
  subject?: unknown;
  report?: unknown;
};

const recentReportsBySubject = new Map<string, number[]>();

function requestSubject(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

function isRateLimited(subject: string, now = Date.now()): boolean {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (recentReportsBySubject.get(subject) ?? []).filter(
    (stamp) => stamp > windowStart,
  );
  if (recent.length >= MAX_REPORTS_PER_WINDOW) {
    recentReportsBySubject.set(subject, recent);
    return true;
  }
  recent.push(now);
  recentReportsBySubject.set(subject, recent);
  return false;
}

function json(request: Request, body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: apiCorsHeaders(request, 'POST, OPTIONS'),
  });
}

export function resetCrashReportRateLimitsForTests() {
  recentReportsBySubject.clear();
}

export async function deliverCrashReport(
  request: Request,
  payload: CrashReportPayload,
): Promise<Response> {
  const subject =
    typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const report = typeof payload.report === 'string' ? payload.report.trim() : '';
  if (
    !subject ||
    subject.length > MAX_SUBJECT_CHARS ||
    !report ||
    report.length > MAX_REPORT_CHARS
  ) {
    return json(request, { error: 'Invalid crash report.' }, 400);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = (
    process.env.CRASH_REPORT_TO_EMAIL ?? process.env.EXPO_PUBLIC_SUPPORT_EMAIL
  )?.trim();
  const from = process.env.CRASH_REPORT_FROM_EMAIL?.trim();
  if (!apiKey || !to || !from) {
    return json(
      request,
      { error: 'Crash report delivery is not configured.' },
      503,
    );
  }

  if (isRateLimited(requestSubject(request))) {
    return json(request, { error: 'Too many crash reports.' }, 429);
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text: report }),
    });
    if (!response.ok) {
      return json(request, { error: 'Crash report delivery failed.' }, 502);
    }
    return json(request, { sent: true });
  } catch {
    return json(request, { error: 'Crash report delivery failed.' }, 502);
  }
}
