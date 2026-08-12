import { defaultOpenAIModel, fetchOpenAIResponses, parseOpenAIJsonResponse } from '@/services/ai';
import {
  apiRateLimitSubject,
  authenticateApiRequest,
  isApiRequestBlocked,
} from '@/services/http/api-auth';
import { checkApiRateLimit } from '@/services/http/api-rate-limit';

export type CoachInsightPayload = {
  id: string;
  title: string;
  body: string;
  priority?: number;
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['insights'],
  properties: {
    insights: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'body'],
        properties: {
          id: { type: 'string', maxLength: 40 },
          title: { type: 'string', maxLength: 80 },
          body: { type: 'string', maxLength: 280 },
          priority: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
        },
      },
    },
  },
} as const;

export async function authorizeFinanceCoach(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (isApiRequestBlocked(auth)) {
    return {
      response: Response.json(
        { error: 'Sign in is required for AI coach polish.', code: 'PERMISSION_DENIED' },
        { status: 401 },
      ),
    };
  }
  if (checkApiRateLimit('finance', apiRateLimitSubject(request, auth)) === 'limited') {
    return {
      response: Response.json(
        { error: 'Coach limit reached. Try again later.', code: 'RATE_LIMITED' },
        { status: 429 },
      ),
    };
  }
  return { auth };
}

function validateInsights(value: unknown): CoachInsightPayload[] {
  if (!value || typeof value !== 'object') throw new Error('INVALID_INSIGHTS');
  const list = (value as { insights?: unknown }).insights;
  if (!Array.isArray(list) || !list.length) throw new Error('INVALID_INSIGHTS');
  return list.slice(0, 4).map((item) => {
    const row = item as Partial<CoachInsightPayload>;
    if (typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.body !== 'string') {
      throw new Error('INVALID_INSIGHTS');
    }
    return {
      id: row.id.slice(0, 40),
      title: row.title.slice(0, 80),
      body: row.body.slice(0, 280),
      priority: typeof row.priority === 'number' ? row.priority : undefined,
    };
  });
}

/** Polish local heuristics — never invent trades or claim fiduciary advice. */
export async function polishFinanceCoachInsights(
  insights: CoachInsightPayload[],
  context: {
    referenceSavingsApr: number;
    safetyIdentifier: string;
  },
): Promise<CoachInsightPayload[]> {
  if (!process.env.OPENAI_API_KEY) throw new Error('NOT_CONFIGURED');
  const body = await fetchOpenAIResponses({
    model: defaultOpenAIModel(process.env.OPENAI_FINANCE_MODEL),
    safetyIdentifier: context.safetyIdentifier,
    payload: {
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Rewrite these money-coach tips to be clearer and more actionable.',
                'Keep the same ids and intent. Do not add investment picks, tax filing claims, or guaranteed outcomes.',
                'Educational tips only — not personalized financial advice.',
                `Reference cash/HYSA yield context: ~${context.referenceSavingsApr}% APR.`,
                'Input JSON:',
                JSON.stringify({ insights }),
              ].join('\n'),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'finance_coach_insights',
          strict: true,
          schema: SCHEMA,
        },
      },
    },
  });
  return validateInsights(parseOpenAIJsonResponse(body));
}
