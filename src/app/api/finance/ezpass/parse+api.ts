import { openaiSafetyIdentifier } from '@/services/ai/openai-safety-id';
import {
    analyzeEzPassFiles,
    authorizeEzPassAi,
    type EzPassAiFile,
} from '@/services/finance/ezpass-ai-server';
import { apiCorsHeaders, apiOptionsResponse } from '@/services/http/cors';

export function OPTIONS(request: Request) {
  return apiOptionsResponse(request);
}

function json(request: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: apiCorsHeaders(request) });
}

export async function POST(request: Request) {
  const authorization = await authorizeEzPassAi(request);
  if ('response' in authorization) return authorization.response;
  const body = await request.json().catch(() => undefined) as { files?: EzPassAiFile[] } | undefined;
  if (!Array.isArray(body?.files)) return json(request, { error: 'Files are required.' }, 400);
  try {
    const activities = await analyzeEzPassFiles(
      body.files,
      openaiSafetyIdentifier(
        authorization.auth.status === 'ok' ? authorization.auth.userId : 'finance-import',
      ),
    );
    return json(request, { activities });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PROVIDER_FAILURE';
    if (code === 'INVALID_FILE' || code === 'FILE_TOO_LARGE' || code === 'TOO_MANY_PAGES') {
      return json(request, { error: 'Choose up to six supported images or a PDF of 12 pages or fewer (20 MB total).', code }, 400);
    }
    if (code === 'NOT_CONFIGURED') {
      return json(request, { error: 'AI statement parsing is not configured.', code }, 503);
    }
    return json(request, { error: 'The statement could not be analyzed.', code: 'PROVIDER_FAILURE' }, 502);
  }
}
