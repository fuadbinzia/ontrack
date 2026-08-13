import {
  authorizeTravelTranslator,
  parseTravelTranslatorTurnInput,
  translateTravelTranslatorTurn,
} from '@/services/travel/translator-server';

export async function POST(request: Request) {
  const authorization = await authorizeTravelTranslator(request);
  if ('response' in authorization) return authorization.response;
  const input = parseTravelTranslatorTurnInput(
    await request.json().catch(() => undefined),
  );
  if (!input) {
    return Response.json(
      {
        error: 'Provide valid languages and exactly one text or audio input.',
        code: 'INVALID_INPUT',
      },
      { status: 400 },
    );
  }
  try {
    return Response.json(
      await translateTravelTranslatorTurn(
        input,
        authorization.auth.status === 'ok'
          ? authorization.auth.userId
          : 'local-travel',
      ),
    );
  } catch (error) {
    const providerCode = error instanceof Error ? error.message : '';
    const invalid =
      providerCode === 'INVALID_INPUT' || providerCode === 'INVALID_TRANSCRIPT';
    const code = invalid
      ? 'INVALID_INPUT'
      : providerCode === 'NOT_CONFIGURED'
        ? providerCode
        : 'PROVIDER_FAILURE';
    return Response.json(
      {
        error:
          code === 'NOT_CONFIGURED'
            ? 'Travel translation is not configured.'
            : invalid
              ? 'That phrase or recording could not be translated.'
              : 'Translation is temporarily unavailable.',
        code,
      },
      { status: invalid ? 400 : code === 'NOT_CONFIGURED' ? 503 : 502 },
    );
  }
}
