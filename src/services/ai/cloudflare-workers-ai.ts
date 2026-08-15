import { guardedFetch } from '@/services/http/dependency-guard';

type CloudflarePlantAIResponse = {
  response?: unknown;
};

function requiredCloudflarePlantAIConfig() {
  const url = process.env.CLOUDFLARE_PLANT_AI_URL?.trim();
  const secret = process.env.CLOUDFLARE_PLANT_AI_SHARED_SECRET?.trim();
  if (!url || !secret) throw new Error('CLOUDFLARE_AI_UNAVAILABLE');
  let endpoint: URL;
  try {
    endpoint = new URL('/v1/structured', url);
  } catch {
    throw new Error('CLOUDFLARE_AI_UNAVAILABLE');
  }
  if (endpoint.protocol !== 'https:') throw new Error('CLOUDFLARE_AI_UNAVAILABLE');
  return { endpoint, secret };
}

function parseStructuredResponse(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const start = normalized.indexOf('{');
  let depth = 0;
  let inString = false;
  let escaped = false;
  let candidate = normalized;
  if (start >= 0) {
    for (let index = start; index < normalized.length; index += 1) {
      const character = normalized[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          candidate = normalized.slice(start, index + 1);
          break;
        }
      }
    }
  }
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    throw new Error('INVALID_ANALYSIS');
  }
}

export function cloudflarePlantAIConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_PLANT_AI_URL?.trim() &&
    process.env.CLOUDFLARE_PLANT_AI_SHARED_SECRET?.trim(),
  );
}

/** Server-only call to the protected onTrack Workers AI gateway. */
export async function fetchCloudflarePlantJson(options: {
  prompt: string;
  schema: Record<string, unknown>;
  imageDataUrl?: string;
  maxTokens?: number;
}): Promise<unknown> {
  const { endpoint, secret } = requiredCloudflarePlantAIConfig();
  let response: Response;
  try {
    response = await guardedFetch(
      'cloudflare-workers-ai',
      endpoint,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: options.prompt,
          schema: options.schema,
          imageDataUrl: options.imageDataUrl,
          maxTokens: options.maxTokens ?? 1800,
        }),
      },
      { timeoutMs: 75_000, maxConcurrency: 2 },
    );
  } catch {
    throw new Error('CLOUDFLARE_AI_UNAVAILABLE');
  }
  if (!response.ok) throw new Error('CLOUDFLARE_AI_UNAVAILABLE');
  const body = await response.json().catch(() => undefined) as CloudflarePlantAIResponse | undefined;
  if (!body || body.response === undefined) throw new Error('INVALID_ANALYSIS');
  return parseStructuredResponse(body.response);
}
