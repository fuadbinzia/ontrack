import {
  authorizeJournalTranscribe,
  parseJournalTranscribeInput,
  transcribeJournalAudio,
} from '@/services/journal/transcribe-server';

export async function POST(request: Request) {
  const authorization = await authorizeJournalTranscribe(request);
  if ('response' in authorization) return authorization.response;
  const input = parseJournalTranscribeInput(await request.json().catch(() => undefined));
  if (!input) {
    return Response.json(
      { error: 'Provide a valid audio recording.', code: 'INVALID_INPUT' },
      { status: 400 },
    );
  }
  try {
    return Response.json({ text: await transcribeJournalAudio(input.audioDataUrl) });
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
            ? 'Journal dictate is not configured.'
            : invalid
              ? 'That recording could not be transcribed.'
              : 'Journal dictate is temporarily unavailable.',
        code,
      },
      { status: invalid ? 400 : code === 'NOT_CONFIGURED' ? 503 : 502 },
    );
  }
}
