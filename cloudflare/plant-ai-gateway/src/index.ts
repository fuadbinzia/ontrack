type StructuredRequest = {
  prompt: string;
  schema: Record<string, unknown>;
  imageDataUrl?: string;
  maxTokens: number;
};

const MODEL = '@cf/google/gemma-4-26b-a4b-it' as const;
const MAX_IMAGE_LENGTH = 5_500_000;
const MAX_PROMPT_LENGTH = 12_000;
const MAX_SCHEMA_LENGTH = 20_000;

function jsonError(message: string, status: number, code: string): Response {
  return Response.json({ error: message, code }, { status });
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : undefined;
}

function validRequest(value: unknown): StructuredRequest | undefined {
  const body = object(value);
  const prompt = body?.prompt;
  const schema = object(body?.schema);
  const imageDataUrl = body?.imageDataUrl;
  const maxTokens = body?.maxTokens;
  if (
    typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT_LENGTH ||
    !schema || JSON.stringify(schema).length > MAX_SCHEMA_LENGTH ||
    typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens < 64 || maxTokens > 2500
  ) {
    return undefined;
  }
  if (
    imageDataUrl !== undefined &&
    (typeof imageDataUrl !== 'string' ||
      !/^data:image\/(jpeg|png|webp);base64,/.test(imageDataUrl) ||
      imageDataUrl.length > MAX_IMAGE_LENGTH)
  ) {
    return undefined;
  }
  return { prompt: prompt.trim(), schema, imageDataUrl, maxTokens };
}

async function equalSecret(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

async function authorized(request: Request, env: Env): Promise<boolean> {
  const authorization = request.headers.get('Authorization') ?? '';
  const provided = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  return equalSecret(provided, env.PLANT_AI_GATEWAY_SHARED_SECRET);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true });
    }
    if (request.method !== 'POST' || url.pathname !== '/v1/structured') {
      return jsonError('Not found.', 404, 'NOT_FOUND');
    }
    if (!(await authorized(request, env))) {
      return jsonError('Unauthorized.', 401, 'UNAUTHORIZED');
    }
    const input = validRequest(await request.json<unknown>().catch(() => undefined));
    if (!input) return jsonError('Invalid request.', 400, 'INVALID_REQUEST');

    try {
      const content: UserMessageContentPart[] = [
        { type: 'text', text: input.prompt },
      ];
      if (input.imageDataUrl) {
        content.push({
          type: 'image_url',
          image_url: { url: input.imageDataUrl, detail: 'high' },
        });
      }
      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: 'system',
            content: 'Return only valid JSON matching the supplied schema. Do not use Markdown fences or add fields.',
          },
          {
            role: 'user',
            content,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'plant_analysis',
            schema: input.schema,
            strict: true,
          },
        },
        temperature: 0,
        chat_template_kwargs: { enable_thinking: false },
        max_completion_tokens: input.maxTokens,
      });
      const response = result.choices[0]?.message.content;
      if (typeof response !== 'string' || !response.trim()) {
        return jsonError('The model returned no result.', 502, 'EMPTY_MODEL_RESPONSE');
      }
      return Response.json({ response });
    } catch (error) {
      console.error(JSON.stringify({
        message: 'Workers AI request failed',
        error: error instanceof Error ? error.message : String(error),
        path: url.pathname,
      }));
      return jsonError('Plant AI is temporarily unavailable.', 503, 'MODEL_UNAVAILABLE');
    }
  },
} satisfies ExportedHandler<Env>;
