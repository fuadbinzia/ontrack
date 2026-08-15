import { canUsePlantIdentityForCare, validatePlantCarePlan, validatePlantHealth, validatePlantIdentity } from '@/services/plants/validate';
import { compressResponse } from '@/services/http/compression';
import {
  assertPlantAnalysisEnabled,
  assertPlantAuthenticated,
  checkPlantHealth,
  plantCorsHeaders,
  plantError,
  plantOptionsResponse,
  validImageDataUrl,
  validRoomProfile,
} from '@/services/plants/server';

export function OPTIONS() { return plantOptionsResponse(); }

export async function POST(request: Request) {
  const disabled = assertPlantAnalysisEnabled();
  if (disabled) return disabled;
  const unauthorized = await assertPlantAuthenticated(request);
  if (unauthorized) return unauthorized;
  const input = await request.json().catch(() => undefined) as Record<string, unknown> | undefined;
  const identity = validatePlantIdentity(input?.identity);
  const previousHealth = validatePlantHealth(input?.previousHealth);
  const currentCarePlan = validatePlantCarePlan(input?.currentCarePlan);
  const room = input?.room;
  if (!validImageDataUrl(input?.imageDataUrl) || !identity || !canUsePlantIdentityForCare(identity) || !previousHealth || !currentCarePlan || !validRoomProfile(room)) {
    return plantError('A valid check-in image and plant profile are required.', 'INVALID_INPUT', 400);
  }
  try {
    return compressResponse(
      request,
      Response.json(await checkPlantHealth({
        imageDataUrl: input.imageDataUrl, identity, previousHealth, currentCarePlan, room,
      }), { headers: plantCorsHeaders }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'OLLAMA_UNAVAILABLE') {
      return plantError(
        'The local plant model is unavailable. Start Ollama and install the configured vision model.',
        'PROVIDER_FAILURE',
        503,
      );
    }
    if (error instanceof Error && error.message === 'CLOUDFLARE_AI_UNAVAILABLE') {
      return plantError(
        'Plant check-in analysis is temporarily unavailable. Try again shortly.',
        'PROVIDER_FAILURE',
        503,
      );
    }
    return plantError('Plant check-in analysis is temporarily unavailable.', 'PROVIDER_FAILURE', 502);
  }
}
