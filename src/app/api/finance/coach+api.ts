import {
  authorizeFinanceCoach,
  polishFinanceCoachInsights,
  type CoachInsightPayload,
} from '@/services/finance/coach-server';

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  let body: {
    insights?: CoachInsightPayload[];
    referenceSavingsApr?: number;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const insights = Array.isArray(body.insights) ? body.insights : [];
  const referenceSavingsApr =
    typeof body.referenceSavingsApr === 'number' && Number.isFinite(body.referenceSavingsApr)
      ? body.referenceSavingsApr
      : 4.25;

  const disclaimer =
    'Educational tips only — not personalized financial, tax, or investment advice.';

  if (!insights.length) {
    return json({ insights: [], source: 'local', disclaimer });
  }

  // Prefer AI polish when configured; fall back to local heuristics silently.
  if (!process.env.OPENAI_API_KEY) {
    return json({ insights, source: 'local', disclaimer });
  }

  const authorization = await authorizeFinanceCoach(request);
  if ('response' in authorization) {
    // Unauthenticated / rate-limited → still return local tips.
    return json({ insights, source: 'local', disclaimer });
  }

  try {
    const polished = await polishFinanceCoachInsights(insights, {
      referenceSavingsApr,
      safetyIdentifier:
        authorization.auth.status === 'ok' ? authorization.auth.userId : 'finance-local',
    });
    return json({ insights: polished, source: 'ai', disclaimer });
  } catch {
    return json({ insights, source: 'local', disclaimer });
  }
}
