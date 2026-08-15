import { compressResponse } from '@/services/http/compression';
import {
  assertEventsAuthenticated,
  eventCorsHeaders,
  eventError,
  eventOptionsResponse,
  eventsForFollow,
  isEventKind,
  providerErrorResponse,
} from '@/services/events/server';
import type { EventFollow } from '@/services/events/types';

export function OPTIONS(request: Request) {
  return eventOptionsResponse(request);
}

function validFollow(value: unknown): value is EventFollow {
  if (!value || typeof value !== 'object') return false;
  const follow = value as Partial<EventFollow>;
  const id = typeof follow.id === 'string' ? follow.id.trim() : '';
  const providerTargetId = typeof follow.providerTargetId === 'string'
    ? follow.providerTargetId.trim()
    : '';
  const name = typeof follow.name === 'string' ? follow.name.trim() : '';
  return id.length > 0
    && id.length <= 100
    && providerTargetId.length > 0
    && providerTargetId.length <= 100
    && name.length > 0
    && name.length <= 120
    && (follow.provider === 'thesportsdb' || follow.provider === 'ticketmaster')
    && isEventKind(follow.kind)
    && (follow.targetKind === 'team' || follow.targetKind === 'league' || follow.targetKind === 'promotion' || follow.targetKind === 'artist')
    && (follow.provider !== 'ticketmaster' || (follow.kind === 'concert' && follow.targetKind === 'artist'))
    && (follow.provider !== 'thesportsdb' || follow.kind !== 'concert')
    && (follow.mode === 'auto' || follow.mode === 'review');
}

export async function POST(request: Request) {
  const unauthorized = await assertEventsAuthenticated(request);
  if (unauthorized) return unauthorized;
  const body = await request.json().catch(() => undefined) as { follows?: unknown } | undefined;
  if (!Array.isArray(body?.follows) || body.follows.length > 25 || !body.follows.every(validFollow)) {
    return eventError('Choose valid event follows.', 400, 'INVALID_FOLLOWS');
  }
  try {
    const results = await Promise.all((body.follows as EventFollow[]).map(async (follow) => ({
      followId: follow.id,
      events: await eventsForFollow(follow),
    })));
    return compressResponse(request, Response.json({
      results,
      syncedAt: new Date().toISOString(),
    }, { headers: eventCorsHeaders }));
  } catch (error) {
    return providerErrorResponse(error);
  }
}
