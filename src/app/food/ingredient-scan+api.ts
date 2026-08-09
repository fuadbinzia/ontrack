import {
  analyzeIngredientScan,
  assertFoodAIEnabled,
  assertFoodAuthenticated,
  foodCorsHeaders,
  foodError,
  foodOptionsResponse,
} from '@/services/food/server';
import { compressResponse } from '@/services/http/compression';

export function OPTIONS() {
  return foodOptionsResponse();
}

export async function POST(request: Request) {
  const disabled = assertFoodAIEnabled();
  if (disabled) return disabled;
  const unauthorized = await assertFoodAuthenticated(request);
  if (unauthorized) return unauthorized;
  const input = (await request.json().catch(() => undefined)) as
    | { imageDataUrl?: string }
    | undefined;
  if (!input?.imageDataUrl || typeof input.imageDataUrl !== 'string') {
    return foodError('A label photo is required.', 'INVALID_IMAGE', 400);
  }
  try {
    const analysis = await analyzeIngredientScan(input.imageDataUrl);
    return compressResponse(
      request,
      Response.json(analysis, { headers: foodCorsHeaders }),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PROVIDER_FAILURE';
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Ingredient scan failure:', code);
    }
    if (code === 'INVALID_IMAGE') {
      return foodError('The image is invalid or too large.', 'INVALID_IMAGE', 400);
    }
    if (code === 'OLLAMA_UNAVAILABLE') {
      return foodError(
        'The local food model is unavailable. Start Ollama and install the configured vision model.',
        'PROVIDER_FAILURE',
        503,
      );
    }
    return foodError('Ingredient scanning is temporarily unavailable.', 'PROVIDER_FAILURE', 502);
  }
}
