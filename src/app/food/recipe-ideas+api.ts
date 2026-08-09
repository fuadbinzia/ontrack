import {
  assertFoodAIEnabled,
  assertFoodAuthenticated,
  foodCorsHeaders,
  foodError,
  foodOptionsResponse,
  generateRecipeIdeas,
  sanitizeRecipeIdeasRequest,
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
  const body = await request.json().catch(() => undefined);
  const input = sanitizeRecipeIdeasRequest(body);
  if (!input) {
    return foodError('List at least one ingredient.', 'INVALID_REQUEST', 400);
  }
  try {
    const response = await generateRecipeIdeas(input);
    return compressResponse(
      request,
      Response.json(response, { headers: foodCorsHeaders }),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PROVIDER_FAILURE';
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Recipe ideas failure:', code);
    }
    if (code === 'OLLAMA_UNAVAILABLE') {
      return foodError(
        'The local food model is unavailable. Start Ollama and install the configured model.',
        'PROVIDER_FAILURE',
        503,
      );
    }
    return foodError('Recipe ideas are temporarily unavailable.', 'PROVIDER_FAILURE', 502);
  }
}
