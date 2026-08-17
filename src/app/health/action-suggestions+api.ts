import { openaiSafetyIdentifier } from '@/services/ai/openai-safety-id';
import { authorizeMoodSuggestions, createMoodSuggestions, parseMoodSuggestionInput } from '@/services/health/action-suggestions';

export async function POST(request: Request) {
  const authorization = await authorizeMoodSuggestions(request);
  if ('response' in authorization) return authorization.response;
  const input = parseMoodSuggestionInput(await request.json().catch(() => undefined));
  if (!input) return Response.json({ error: 'Only feeling labels, intensities, factors, and desired feelings are accepted.', code: 'INVALID_INPUT' }, { status: 400 });
  try {
    return Response.json({ suggestions: await createMoodSuggestions(input, openaiSafetyIdentifier(authorization.auth.status === 'ok' ? authorization.auth.userId : 'local-health')) });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PROVIDER_FAILURE';
    return Response.json({ error: code === 'NOT_CONFIGURED' ? 'AI suggestions are not configured.' : 'AI suggestions are temporarily unavailable.', code }, { status: code === 'NOT_CONFIGURED' ? 503 : 502 });
  }
}
