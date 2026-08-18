import { gateGuestPaidApiRequest } from '@/services/http/api-gate';
import { parseAgentRunInput, runAgentTurn } from '@/services/agents/run-server';

export async function POST(request: Request) {
  const gate = await gateGuestPaidApiRequest(request, 'agents');
  if (gate === 'rate_limited') {
    return Response.json(
      { error: 'onTrack companion limit reached. Try again later.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }
  const input = parseAgentRunInput(await request.json().catch(() => undefined));
  if (!input) {
    return Response.json(
      { error: 'Provide a message or tool result.', code: 'INVALID_INPUT' },
      { status: 400 },
    );
  }
  try {
    return Response.json(await runAgentTurn(input));
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PROVIDER_FAILURE';
    const notConfigured = code === 'NOT_CONFIGURED';
    return Response.json(
      {
        error: notConfigured
          ? 'onTrack companion is not configured.'
          : 'onTrack companion is temporarily unavailable.',
        code: notConfigured ? 'NOT_CONFIGURED' : 'PROVIDER_FAILURE',
      },
      { status: notConfigured ? 503 : 502 },
    );
  }
}
