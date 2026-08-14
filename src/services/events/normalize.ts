import type {
  EventBroadcast,
  EventFollowTarget,
  EventSearchResult,
  ExternalEventStatus,
} from './types';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function list(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function unique(values: (string | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function status(value: unknown): ExternalEventStatus {
  const normalized = text(value)?.toLowerCase() ?? '';
  if (/cancel|canc/.test(normalized)) return 'cancelled';
  if (/postpon|pst|suspend|delay/.test(normalized)) return 'postponed';
  if (/progress|live|q[1-4]|half/.test(normalized)) return 'in-progress';
  if (/final|finished|ft|completed/.test(normalized)) return 'completed';
  return normalized ? 'scheduled' : 'unknown';
}

function isoDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function dateKey(value: string | undefined) {
  if (!value) return undefined;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0];
}

function eventImage(images: UnknownRecord[]) {
  const sorted = [...images].sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0));
  return sorted.map((image) => text(image.url)).find(Boolean);
}

export function normalizeTicketmasterEvent(value: unknown): EventSearchResult | undefined {
  const item = record(value);
  const id = text(item.id);
  const title = text(item.name);
  if (!id || !title) return undefined;
  const dates = record(item.dates);
  const start = record(dates.start);
  const embedded = record(item._embedded);
  const venues = list(embedded.venues);
  const venue = record(venues[0]);
  const attractions = list(embedded.attractions);
  const localDate = text(start.localDate);
  const localTime = text(start.localTime);
  const dateTime = isoDate(text(start.dateTime))
    ?? (localDate && localTime ? isoDate(`${localDate}T${localTime}`) : undefined);
  const date = localDate ?? dateKey(dateTime);
  if (!date) return undefined;
  const city = record(venue.city);
  const state = record(venue.state);
  const country = record(venue.country);
  const address = record(venue.address);
  const sales = record(item.sales);
  const publicSales = record(sales.public);
  const classifications = list(item.classifications);
  const segment = record(classifications[0]?.segment);
  const images = list(item.images);

  return {
    provider: 'ticketmaster',
    providerEventId: id,
    kind: 'concert',
    sourceName: 'Ticketmaster',
    sourceUrl: text(item.url),
    title,
    startDateTime: dateTime,
    date,
    allDay: !dateTime,
    durationMinutes: 180,
    participants: unique(attractions.map((attraction) => text(attraction.name))),
    venue: {
      name: text(venue.name),
      address: text(address.line1),
      city: text(city.name),
      region: text(state.stateCode) ?? text(state.name),
      countryCode: text(country.countryCode),
    },
    broadcasts: [],
    ticketUrl: text(item.url),
    imageUrl: eventImage(images),
    status: status(record(dates.status).code),
    notes: [
      text(segment.name),
      text(publicSales.startDateTime) ? 'Tickets available' : undefined,
    ].filter(Boolean).join(' · ') || undefined,
  };
}

export function normalizeSportsDbBroadcast(value: unknown): EventBroadcast | undefined {
  const item = record(value);
  const name = text(item.strChannel) ?? text(item.strTVStation);
  if (!name) return undefined;
  return {
    name,
    countryCode: text(item.strCountry),
    url: text(item.strWebsite),
  };
}

export function normalizeSportsDbEvent(
  value: unknown,
  kind: 'sports' | 'nba' | 'ufc',
  broadcasts: EventBroadcast[] = [],
): EventSearchResult | undefined {
  const item = record(value);
  const id = text(item.idEvent);
  const title = text(item.strEvent) ?? text(item.strEventAlternate);
  const date = dateKey(text(item.dateEvent));
  if (!id || !title || !date) return undefined;
  const providerTimestamp = text(item.strTimestamp);
  const providerTime = text(item.strTime);
  const placeholderMidnight = providerTimestamp === `${date}T00:00:00`
    && /^00:00(?::00)?$/.test(providerTime ?? '')
    && !text(item.strTimeLocal)
    && !text(item.strTimezone);
  const timestamp = placeholderMidnight ? undefined : isoDate(providerTimestamp);
  const time = placeholderMidnight ? undefined : providerTime?.replace(/Z$/, '');
  const fallbackDateTime = time && /^\d{2}:\d{2}/.test(time)
    ? isoDate(`${date}T${time.length === 5 ? `${time}:00` : time}Z`)
    : undefined;
  const startDateTime = timestamp ?? fallbackDateTime;
  const participants = unique([
    text(item.strAwayTeam),
    text(item.strHomeTeam),
    text(item.strPlayer),
  ]);
  const venueName = text(item.strVenue);

  const sport = text(item.strSport)?.toLowerCase();
  const isCombat = kind === 'ufc' || sport === 'fighting';
  const durationMinutes = kind === 'nba' || sport === 'basketball'
    ? 150
    : isCombat
      ? 240
      : sport === 'american football'
        ? 210
        : sport === 'baseball' || sport === 'motorsport'
          ? 180
          : sport === 'ice hockey'
            ? 150
            : 120;
  return {
    provider: 'thesportsdb',
    providerEventId: id,
    kind,
    sourceName: 'TheSportsDB',
    sourceUrl: text(item.strWebsite) ?? text(item.strOfficial),
    title,
    startDateTime,
    date,
    allDay: !startDateTime,
    durationMinutes,
    participants,
    card: isCombat
      ? unique([
          ...list(item.fights).map((fight) => {
            const first = text(fight.strFighter1) ?? text(fight.strHomeTeam);
            const second = text(fight.strFighter2) ?? text(fight.strAwayTeam);
            return first && second ? `${first} vs ${second}` : first ?? second;
          }),
          text(item.strEventAlternate),
        ])
      : undefined,
    venue: venueName || text(item.strCity)
      ? { name: venueName, city: text(item.strCity), countryCode: text(item.strCountry) }
      : undefined,
    broadcasts,
    watchUrl: broadcasts.map((item) => item.url).find(Boolean),
    imageUrl: text(item.strThumb) ?? text(item.strPoster) ?? text(item.strBanner),
    status: status(item.strStatus),
    notes: text(item.strDescriptionEN),
  };
}

export function normalizeSportsDbTarget(
  value: unknown,
  kind: 'sports' | 'nba' | 'ufc',
): EventFollowTarget | undefined {
  const item = record(value);
  const isUfc = kind === 'ufc' || /fighting/i.test(text(item.strSport) ?? '') || /ufc/i.test(text(item.strLeague) ?? '');
  const isLeague = Boolean(text(item.idLeague)) && !text(item.idTeam);
  const providerTargetId = text(isUfc || isLeague ? item.idLeague : item.idTeam);
  const name = text(isUfc || isLeague ? item.strLeague : item.strTeam);
  if (!providerTargetId || !name) return undefined;
  return {
    provider: 'thesportsdb',
    providerTargetId,
    kind,
    targetKind: isUfc ? 'promotion' : isLeague ? 'league' : 'team',
    name,
    imageUrl: text(isUfc ? item.strBadge : item.strBadge) ?? text(item.strLogo),
    subtitle: text(item.strLeague) ?? text(item.strSport),
  };
}

export function normalizeTicketmasterAttraction(value: unknown): EventFollowTarget | undefined {
  const item = record(value);
  const id = text(item.id);
  const name = text(item.name);
  if (!id || !name) return undefined;
  return {
    provider: 'ticketmaster',
    providerTargetId: id,
    kind: 'concert',
    targetKind: 'artist',
    name,
    imageUrl: eventImage(list(item.images)),
    subtitle: 'Concert artist',
  };
}
