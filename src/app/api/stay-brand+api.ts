import {
    STAY_BRAND_UA,
    lookupStayBrandDomain,
} from '@/features/travel/stay-brand-lookup';
import { lookupStayProviderBrandLogoUrl } from '@/features/travel/stays/stay-provider-logo-lookup';
import { gatePublicApiRequest } from '@/services/http/api-gate';
import { apiCorsHeaders, apiOptionsResponse } from '@/services/http/cors';

export function OPTIONS(request: Request) {
  return apiOptionsResponse(request, 'GET, OPTIONS');
}

/** Resolve a hotel/OTA brand domain (+ homepage logo) from stay title. */
export async function GET(request: Request) {
  const gate = await gatePublicApiRequest(request);
  if (gate === 'rate_limited') {
    return Response.json(
      { error: 'Too many brand lookups. Try again later.' },
      { status: 429, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
    );
  }
  const params = new URL(request.url).searchParams;
  const title = params.get('title')?.trim() ?? '';
  const bookingUrl = params.get('bookingUrl')?.trim() || undefined;

  if (title.length < 2 || title.length > 160) {
    return Response.json(
      { error: 'Stay title must be between 2 and 160 characters.' },
      { status: 400, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
    );
  }

  const domain = await lookupStayBrandDomain(
    { title, bookingUrl },
    { userAgent: STAY_BRAND_UA },
  );

  if (!domain) {
    return Response.json(
      { error: 'No brand domain found.' },
      { status: 404, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
    );
  }

  const logoUri = await lookupStayProviderBrandLogoUrl(domain);

  return Response.json(
    { domain, logoUri: logoUri ?? null },
    {
      headers: {
        ...apiCorsHeaders(request, 'GET, OPTIONS'),
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
}
