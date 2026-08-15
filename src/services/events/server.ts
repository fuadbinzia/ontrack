import { gatePaidApiRequest } from '@/services/http/api-gate';
import { apiCorsHeaders } from '@/services/http/cors';
import { guardedFetch } from '@/services/http/dependency-guard';

import {
  normalizeSportsDbEvent,
  normalizeSportsDbTarget,
  normalizeTicketmasterAttraction,
  normalizeTicketmasterEvent,
} from './normalize';
import {
  ESPN_UFC_REQUEST_HEADERS,
  ESPN_UFC_SCOREBOARD_URL,
  enrichTimeTbaUfcEvent,
  normalizeEspnUfcAthleteProfile,
  parseEspnUfcScoreboard,
  usesEspnUfcDiscovery,
} from './espn-ufc';
import type {
  EventFollow,
  EventFollowTarget,
  EventKind,
  EventSearchResult,
  EventSport,
} from './types';

const SPORTSDB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';
const ESPN_UFC_ATHLETE_URL = 'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/athletes';
const MAX_RESULTS = 20;
const ROLLING_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const ESPN_CACHE_MS = 5 * 60 * 1000;
const ESPN_LIVE_CACHE_MS = 30 * 1000;
const ESPN_ATHLETE_CACHE_MS = 24 * 60 * 60 * 1000;
const espnResponseCache = new Map<string, { expiresAt: number; value: Record<string, unknown> }>();
const espnRequestsInFlight = new Map<string, Promise<Record<string, unknown>>>();

export function resetEventProviderCachesForTests() {
  espnResponseCache.clear();
  espnRequestsInFlight.clear();
}
const SPORT_CONFIG = {
  basketball: { label: 'Basketball', providerSport: 'Basketball', leagueId: '4387', aliases: ['nba'] },
  football: { label: 'Football', providerSport: 'American Football', leagueId: '4391', aliases: ['nfl'] },
  baseball: { label: 'Baseball', providerSport: 'Baseball', leagueId: '4424', aliases: ['mlb'] },
  hockey: { label: 'Hockey', providerSport: 'Ice Hockey', leagueId: '4380', aliases: ['nhl'] },
  soccer: { label: 'Soccer', providerSport: 'Soccer', leagueId: '4346', aliases: ['mls'] },
  combat: { label: 'Combat sports', providerSport: 'Fighting', leagueId: '4443', aliases: ['ufc', 'mma'] },
  motorsport: { label: 'Motorsports', providerSport: 'Motorsport', leagueId: '4370', aliases: ['f1', 'formula 1'] },
} as const satisfies Record<Exclude<EventSport, 'all'>, {
  label: string;
  providerSport: string;
  leagueId: string;
  aliases: readonly string[];
}>;
type SportsEventKind = 'sports' | 'nba' | 'ufc';

export const eventCorsHeaders = apiCorsHeaders(undefined, 'GET, POST, OPTIONS');

export function eventOptionsResponse(request?: Request) {
  return new Response(null, {
    status: 204,
    headers: apiCorsHeaders(request, 'GET, POST, OPTIONS'),
  });
}

export function eventError(error: string, status: number, code?: string) {
  return Response.json({ error, ...(code ? { code } : {}) }, { status, headers: eventCorsHeaders });
}

export async function assertEventsAuthenticated(request: Request) {
  const gate = await gatePaidApiRequest(request, 'events');
  if (gate === 'unauthenticated') return eventError('Sign in to discover and follow events.', 401, 'UNAUTHENTICATED');
  if (gate === 'rate_limited') return eventError('Too many event requests. Please try again later.', 429, 'RATE_LIMITED');
  return undefined;
}

export function resolveSportsDbKey(
  configuredKey = process.env.THESPORTSDB_API_KEY,
  environment = process.env.NODE_ENV,
) {
  const key = configuredKey?.trim();
  if (key) return key;
  return environment === 'development' || environment === 'test' ? '123' : undefined;
}

function sportsDbKey() {
  return resolveSportsDbKey();
}

function ticketmasterKey() {
  return process.env.TICKETMASTER_API_KEY?.trim();
}

async function providerJson(provider: 'thesportsdb' | 'ticketmaster' | 'espn-ufc', url: string) {
  try {
    const response = await guardedFetch(provider, url, {
      headers: {
        Accept: 'application/json',
        ...(provider === 'espn-ufc' ? ESPN_UFC_REQUEST_HEADERS : {}),
      },
    }, {
      timeoutMs: 8_000,
      maxConcurrency: 8,
    });
    if (response.status === 429) throw new Error('RATE_LIMITED');
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return await response.json() as Record<string, unknown>;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[events] provider request failed', {
        provider,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorCode: error instanceof Error ? error.message : 'UNKNOWN',
      });
    }
    if (error instanceof Error && error.message === 'RATE_LIMITED') throw error;
    throw new Error('PROVIDER_UNAVAILABLE');
  }
}

async function cachedEspnJson(
  url: string,
  cacheMs = ESPN_CACHE_MS,
  namespace = 'discovery',
) {
  const cacheKey = `${namespace}:${url}`;
  const cached = espnResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const existing = espnRequestsInFlight.get(cacheKey);
  if (existing) return existing;
  const request = providerJson('espn-ufc', url).then((value) => {
    espnResponseCache.set(cacheKey, { expiresAt: Date.now() + cacheMs, value });
    return value;
  }).finally(() => {
    espnRequestsInFlight.delete(cacheKey);
  });
  espnRequestsInFlight.set(cacheKey, request);
  return request;
}

async function espnUfcScoreboard(date: string) {
  try {
    const compactDate = date.replaceAll('-', '');
    return await cachedEspnJson(`${ESPN_UFC_SCOREBOARD_URL}?dates=${compactDate}`);
  } catch {
    // Enrichment is optional: never lose a primary-provider result when it fails.
    return undefined;
  }
}

function sportsDbUrl(path: string, params: Record<string, string> = {}) {
  const key = sportsDbKey();
  if (!key) throw new Error('SPORTS_NOT_CONFIGURED');
  const query = new URLSearchParams(params);
  return `${SPORTSDB_BASE_URL}/${encodeURIComponent(key)}/${path}${query.size ? `?${query}` : ''}`;
}

function ticketmasterUrl(path: string, params: Record<string, string>) {
  const key = ticketmasterKey();
  if (!key) throw new Error('CONCERTS_NOT_CONFIGURED');
  const query = new URLSearchParams({ ...params, apikey: key, locale: 'en-us' });
  return `${TICKETMASTER_BASE_URL}/${path}?${query}`;
}

function bodyList(body: Record<string, unknown>, key: string) {
  return Array.isArray(body[key]) ? body[key] : [];
}

/** Date-scoped, short-cache feed used only while an opened UFC event may be live. */
export async function liveUfcEvents(date: string) {
  const compact = date.replaceAll('-', '');
  const body = await cachedEspnJson(
    `${ESPN_UFC_SCOREBOARD_URL}?dates=${compact}`,
    ESPN_LIVE_CACHE_MS,
    'live',
  );
  return parseEspnUfcScoreboard(body);
}

/** Fetch only the two opened-bout profiles; failures degrade to available card data. */
export async function ufcAthleteProfiles(providerAthleteIds: readonly string[]) {
  const profiles = await Promise.all(providerAthleteIds.slice(0, 2).map(async (id) => {
    try {
      const body = await cachedEspnJson(
        `${ESPN_UFC_ATHLETE_URL}/${encodeURIComponent(id)}?lang=en&region=us`,
        ESPN_ATHLETE_CACHE_MS,
        'athlete',
      );
      return normalizeEspnUfcAthleteProfile(body);
    } catch {
      return undefined;
    }
  }));
  return profiles.filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));
}

function embeddedList(body: Record<string, unknown>, key: string) {
  const embedded = body._embedded && typeof body._embedded === 'object'
    ? body._embedded as Record<string, unknown>
    : {};
  return Array.isArray(embedded[key]) ? embedded[key] : [];
}

async function normalizeSportsEvents(values: unknown[], kind: SportsEventKind) {
  const limited = values.slice(0, MAX_RESULTS);
  const normalized = limited
    .map((value) => normalizeSportsDbEvent(value, kind))
    .filter((item): item is EventSearchResult => Boolean(item));

  const enrichmentDates = [...new Set(normalized
    .filter((item) => /\bufc\b/i.test(item.title))
    .map((item) => item.date))];
  const scoreboards = new Map(await Promise.all(enrichmentDates.map(async (date) =>
    [date, await espnUfcScoreboard(date)] as const,
  )));
  return normalized.map((item) => {
    const scoreboard = scoreboards.get(item.date);
    return scoreboard ? enrichTimeTbaUfcEvent(item, scoreboard) : item;
  });
}

function compactDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

async function espnUfcEvents(query: string) {
  const now = new Date();
  const end = new Date(now.getTime() + ROLLING_WINDOW_MS);
  let body: Record<string, unknown>;
  try {
    body = await cachedEspnJson(
      `${ESPN_UFC_SCOREBOARD_URL}?dates=${compactDate(now)}-${compactDate(end)}&limit=100`,
    );
  } catch {
    // The undated scoreboard is much smaller and still contains the next UFC
    // event, so a transient range/payload failure should not blank discovery.
    body = await cachedEspnJson(ESPN_UFC_SCOREBOARD_URL);
  }
  return parseEspnUfcScoreboard(body, query);
}

export function sportsLeagueId(sport: Exclude<EventSport, 'all'> | 'nba' | 'ufc') {
  if (sport === 'nba') return SPORT_CONFIG.basketball.leagueId;
  if (sport === 'ufc') return SPORT_CONFIG.combat.leagueId;
  return SPORT_CONFIG[sport].leagueId;
}

export function nbaSeasonForDate(date: Date) {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function eventFallsInRollingWindow(value: unknown, now: Date) {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const raw = typeof item.strTimestamp === 'string' && item.strTimestamp
    ? item.strTimestamp
    : typeof item.dateEvent === 'string'
      ? `${item.dateEvent}T23:59:59Z`
      : '';
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) && timestamp >= now.getTime() &&
    timestamp <= now.getTime() + ROLLING_WINDOW_MS;
}

function sportForLegacyKind(kind: SportsEventKind, sport: EventSport): EventSport {
  if (kind === 'nba') return 'basketball';
  if (kind === 'ufc') return 'combat';
  return sport;
}

function configForQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  return Object.entries(SPORT_CONFIG).find(([, config]) =>
    (config.aliases as readonly string[]).includes(normalized),
  ) as [Exclude<EventSport, 'all'>, (typeof SPORT_CONFIG)[Exclude<EventSport, 'all'>]] | undefined;
}

async function leagueUpcomingEvents(leagueId: string) {
  const body = await providerJson(
    'thesportsdb',
    sportsDbUrl('eventsnextleague.php', { id: leagueId }),
  );
  return bodyList(body, 'events');
}

async function defaultSportsEvents(kind: SportsEventKind, sport: EventSport) {
  const selectedSport = sportForLegacyKind(kind, sport);
  if (selectedSport === 'basketball') {
    const now = new Date();
    const seasonBody = await providerJson(
      'thesportsdb',
      sportsDbUrl('eventsseason.php', {
        id: SPORT_CONFIG.basketball.leagueId,
        s: nbaSeasonForDate(now),
      }),
    );
    const upcoming = bodyList(seasonBody, 'events').filter((value) =>
      eventFallsInRollingWindow(value, now),
    );
    if (upcoming.length > 0) return normalizeSportsEvents(upcoming, kind);
  }
  const configs = selectedSport === 'all'
    ? Object.values(SPORT_CONFIG)
    : [SPORT_CONFIG[selectedSport]];
  const eventGroups = await Promise.all(
    configs.map((config) => leagueUpcomingEvents(config.leagueId)),
  );
  return normalizeSportsEvents(eventGroups.flat(), kind);
}

async function sportsEvents(kind: SportsEventKind, query: string, sport: EventSport) {
  const selectedSport = sportForLegacyKind(kind, sport);
  if (
    usesEspnUfcDiscovery(kind, query, selectedSport)
    || configForQuery(query)?.[0] === 'combat'
  ) {
    return espnUfcEvents(query);
  }
  if (query.trim()) {
    const aliasConfig = configForQuery(query);
    if (aliasConfig) return defaultSportsEvents(kind, aliasConfig[0]);
    const [teamsBody, namedEventsBody] = await Promise.all([
      providerJson('thesportsdb', sportsDbUrl('searchteams.php', { t: query.trim() })),
      providerJson('thesportsdb', sportsDbUrl('searchevents.php', { e: query.trim() })),
    ]);
    const teams = bodyList(teamsBody, 'teams').filter((value) => {
      const item = value as Record<string, unknown>;
      if (selectedSport === 'all') return true;
      return String(item.strSport ?? '').toLowerCase() ===
        SPORT_CONFIG[selectedSport].providerSport.toLowerCase();
    }).slice(0, 3);
    const eventGroups = await Promise.all(teams.map(async (value) => {
      const item = value as Record<string, unknown>;
      const id = typeof item.idTeam === 'string' ? item.idTeam : '';
      if (!id) return [];
      const body = await providerJson('thesportsdb', sportsDbUrl('eventsnext.php', { id }));
      return bodyList(body, 'events');
    }));
    const now = new Date();
    const namedEvents = bodyList(namedEventsBody, 'event').filter((value) =>
      eventFallsInRollingWindow(value, now),
    );
    const combined = [...eventGroups.flat(), ...namedEvents];
    const seen = new Set<string>();
    return normalizeSportsEvents(combined.filter((value) => {
      const item = value as Record<string, unknown>;
      const id = String(item.idEvent ?? '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }), kind);
  }
  return defaultSportsEvents(kind, selectedSport);
}

async function concertEvents(query: string, page: number, attractionId?: string) {
  const now = new Date();
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const params: Record<string, string> = {
    classificationName: 'music',
    countryCode: 'US',
    size: String(MAX_RESULTS),
    page: String(page),
    sort: 'date,asc',
    startDateTime: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    endDateTime: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  if (query.trim()) params.keyword = query.trim();
  if (attractionId) params.attractionId = attractionId;
  const body = await providerJson('ticketmaster', ticketmasterUrl('events.json', params));
  return embeddedList(body, 'events')
    .map(normalizeTicketmasterEvent)
    .filter((item): item is EventSearchResult => Boolean(item));
}

export async function searchProviderEvents(
  kind: EventKind,
  query: string,
  page: number,
  sport: EventSport = 'all',
) {
  return kind === 'concert'
    ? concertEvents(query, page)
    : sportsEvents(kind, query, sport);
}

export async function searchProviderTargets(
  kind: EventKind,
  query: string,
  sport: EventSport = 'all',
): Promise<EventFollowTarget[]> {
  if (kind === 'concert') {
    if (!query.trim()) return [];
    const body = await providerJson('ticketmaster', ticketmasterUrl('attractions.json', {
      keyword: query.trim(),
      classificationName: 'music',
      size: '10',
    }));
    return embeddedList(body, 'attractions')
      .map(normalizeTicketmasterAttraction)
      .filter((item): item is EventFollowTarget => Boolean(item));
  }

  const selectedSport = sportForLegacyKind(kind as SportsEventKind, sport);
  const aliasConfig = configForQuery(query);
  const leagueSport = aliasConfig?.[0] ?? (query.trim() ? undefined : selectedSport);
  if (leagueSport && leagueSport !== 'all') {
    const body = await providerJson(
      'thesportsdb',
      sportsDbUrl('lookupleague.php', { id: SPORT_CONFIG[leagueSport].leagueId }),
    );
    return bodyList(body, 'leagues')
      .map((value) => normalizeSportsDbTarget(value, kind as SportsEventKind))
      .filter((item): item is EventFollowTarget => Boolean(item));
  }
  if (!query.trim()) return [];
  const body = await providerJson(
    'thesportsdb',
    sportsDbUrl('searchteams.php', { t: query.trim() }),
  );
  return bodyList(body, 'teams')
    .filter((value) => selectedSport === 'all' ||
      String((value as Record<string, unknown>).strSport ?? '').toLowerCase() ===
        SPORT_CONFIG[selectedSport].providerSport.toLowerCase())
    .map((value) => normalizeSportsDbTarget(value, kind as SportsEventKind))
    .filter((item): item is EventFollowTarget => Boolean(item));
}

export async function eventsForFollow(follow: EventFollow) {
  if (follow.provider === 'ticketmaster') {
    return concertEvents('', 0, follow.providerTargetId);
  }
  const endpoint = follow.targetKind === 'team' ? 'eventsnext.php' : 'eventsnextleague.php';
  const body = await providerJson(
    'thesportsdb',
    sportsDbUrl(endpoint, { id: follow.providerTargetId }),
  );
  const kind: SportsEventKind = follow.kind === 'ufc'
    ? 'ufc'
    : follow.kind === 'nba'
      ? 'nba'
      : 'sports';
  return normalizeSportsEvents(bodyList(body, 'events'), kind);
}

export function providerErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : 'PROVIDER_UNAVAILABLE';
  if (code === 'SPORTS_NOT_CONFIGURED') return eventError('Sports schedules are not configured.', 503, code);
  if (code === 'CONCERTS_NOT_CONFIGURED') return eventError('Concert discovery is not configured.', 503, code);
  if (code === 'RATE_LIMITED') return eventError('The event provider is busy. Please try again shortly.', 429, code);
  return eventError('Event discovery is temporarily unavailable.', 502, 'PROVIDER_UNAVAILABLE');
}

export function isEventKind(value: unknown): value is EventKind {
  return value === 'sports' || value === 'concert' || value === 'nba' || value === 'ufc';
}

export function isEventSport(value: unknown): value is EventSport {
  return value === 'all' || value === 'basketball' || value === 'football' ||
    value === 'baseball' || value === 'hockey' || value === 'soccer' ||
    value === 'combat' || value === 'motorsport';
}
