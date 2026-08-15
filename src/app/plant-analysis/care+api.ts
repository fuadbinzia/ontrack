import { buildFallbackCarePlan } from '@/services/plants/fallback-care';
import { canUsePlantIdentityForCare, validatePlantHealth, validatePlantIdentity } from '@/services/plants/validate';
import { compressResponse } from '@/services/http/compression';
import {
  assertPlantAnalysisEnabled,
  assertPlantAuthenticated,
  createCarePlan,
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
  const health = validatePlantHealth(input?.health);
  if (!identity || !canUsePlantIdentityForCare(identity) || !health || !validRoomProfile(input?.room)) {
    return plantError('Confirmed plant identity and valid room details are required.', 'INVALID_INPUT', 400);
  }
  const roomImageDataUrl = input?.roomImageDataUrl;
  if (roomImageDataUrl !== undefined && !validImageDataUrl(roomImageDataUrl)) {
    return plantError('The room image is invalid or too large.', 'INVALID_IMAGE', 400);
  }
  try {
    const carePlan = await createCarePlan({ identity, health, room: input.room, roomImageDataUrl });
    return compressResponse(request, Response.json({ carePlan }, { headers: plantCorsHeaders }));
  } catch {
    const carePlan = buildFallbackCarePlan({ identity, health, room: input.room });
    return compressResponse(request, Response.json({ carePlan }, { headers: plantCorsHeaders }));
  }
}
