import { openaiSafetyIdentifier } from '@/services/ai/openai-safety-id';
import {
    analyzeRewardCardLink,
    manualFallbackRewardDraft,
} from '@/services/finance/rewards-link-server';
import { authenticateApiRequest } from '@/services/http/api-auth';
import { gatePaidApiRequest } from '@/services/http/api-gate';
import { apiOptionsResponse } from '@/services/http/cors';

export function OPTIONS(request: Request) {
  return apiOptionsResponse(request);
}

export async function POST(request: Request) {
  const gate = await gatePaidApiRequest(request, 'finance');
  if (gate === 'unauthenticated') {
    return Response.json(
      { error: 'Sign in to analyze a credit-card link.', code: 'PERMISSION_DENIED' },
      { status: 401 },
    );
  }
  if (gate === 'rate_limited') {
    return Response.json(
      { error: 'Card link analysis limit reached. Try again later.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }
  let url = '';
  try {
    const body = await request.json() as { url?: unknown };
    url = typeof body.url === 'string' ? body.url.trim() : '';
  } catch {
    return Response.json({ error: 'Invalid JSON body.', code: 'INVALID_REQUEST' }, { status: 400 });
  }
  if (!url) {
    return Response.json({ error: 'A credit-card URL is required.', code: 'INVALID_URL' }, { status: 400 });
  }
  try {
    const auth = await authenticateApiRequest(request);
    const safetyIdentifier = openaiSafetyIdentifier(
      auth.status === 'ok' ? auth.userId : 'finance-reward-import',
    );
    return Response.json(await analyzeRewardCardLink(url, safetyIdentifier));
  } catch (error) {
    const code = error instanceof Error ? error.message : 'IMPORT_FAILED';
    const warning = code === 'INVALID_URL'
      ? 'Enter a complete public HTTPS credit-card link.'
      : code === 'UNSUPPORTED_CONTENT'
        ? 'Only public HTML card pages are supported in this release.'
        : 'The page could not be analyzed safely. Enter the card details manually.';
    return Response.json(manualFallbackRewardDraft(url, warning));
  }
}

