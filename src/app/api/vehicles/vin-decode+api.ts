import { gatePublicApiRequest } from '@/services/http/api-gate';
import {
    decodeVinWithNhtsa,
    jsonResponse,
    optionsResponse,
} from '@/services/vehicles/server';

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function GET(request: Request) {
  const gate = await gatePublicApiRequest(request);
  if (gate === 'rate_limited') {
    return jsonResponse(request, { error: 'Too many VIN lookups. Try again later.' }, 429);
  }
  const vin = new URL(request.url).searchParams.get('vin')?.trim() ?? '';
  if (!vin) {
    return jsonResponse(request, { error: 'VIN is required.' }, 400);
  }
  try {
    const result = await decodeVinWithNhtsa(vin);
    if (result.errorText && !result.make && !result.model) {
      return jsonResponse(request, { error: result.errorText }, 422);
    }
    return jsonResponse(request, { result });
  } catch {
    return jsonResponse(
      request,
      { error: 'VIN decode failed.' },
      502,
    );
  }
}

export async function POST(request: Request) {
  const gate = await gatePublicApiRequest(request);
  if (gate === 'rate_limited') {
    return jsonResponse(request, { error: 'Too many VIN lookups. Try again later.' }, 429);
  }
  let body: { vin?: string } = {};
  try {
    body = (await request.json()) as { vin?: string };
  } catch {
    return jsonResponse(request, { error: 'Invalid JSON body.' }, 400);
  }
  const vin = body.vin?.trim() ?? '';
  if (!vin) return jsonResponse(request, { error: 'VIN is required.' }, 400);
  try {
    const result = await decodeVinWithNhtsa(vin);
    if (result.errorText && !result.make && !result.model) {
      return jsonResponse(request, { error: result.errorText }, 422);
    }
    return jsonResponse(request, { result });
  } catch {
    return jsonResponse(request, { error: 'VIN decode failed.' }, 502);
  }
}
