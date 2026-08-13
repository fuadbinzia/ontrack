import {
  authorizeTravelTranslator,
  parseTravelTranslatorLanguagesInput,
  resolveTravelTranslatorLanguages,
} from '@/services/travel/translator-server';

export async function POST(request: Request) {
  const authorization = await authorizeTravelTranslator(request);
  if ('response' in authorization) return authorization.response;
  const input = parseTravelTranslatorLanguagesInput(
    await request.json().catch(() => undefined),
  );
  if (!input) {
    return Response.json(
      { error: 'Destination and home locale are required.', code: 'INVALID_INPUT' },
      { status: 400 },
    );
  }
  try {
    return Response.json(
      await resolveTravelTranslatorLanguages(
        input,
        authorization.auth.status === 'ok'
          ? authorization.auth.userId
          : 'local-travel',
      ),
    );
  } catch (error) {
    const providerCode = error instanceof Error ? error.message : '';
    const code = providerCode === 'NOT_CONFIGURED' ? providerCode : 'PROVIDER_FAILURE';
    return Response.json(
      {
        error:
          code === 'NOT_CONFIGURED'
            ? 'Travel translation is not configured.'
            : 'Destination languages are temporarily unavailable.',
        code,
      },
      { status: code === 'NOT_CONFIGURED' ? 503 : 502 },
    );
  }
}
