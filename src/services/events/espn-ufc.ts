import type {
  EventBout,
  EventBroadcast,
  EventCardSection,
  EventFighter,
  EventFighterProfile,
  EventSearchResult,
} from './types';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function list(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Normalize the lightweight ESPN athlete profile used by tale-of-the-tape UI. */
export function normalizeEspnUfcAthleteProfile(value: unknown): EventFighterProfile | undefined {
  const athlete = record(value);
  const providerAthleteId = text(athlete.id);
  if (!providerAthleteId) return undefined;
  const age = typeof athlete.age === 'number' && Number.isFinite(athlete.age)
    ? Math.max(0, Math.round(athlete.age))
    : undefined;
  return {
    providerAthleteId,
    age,
    height: text(athlete.displayHeight),
    weight: text(athlete.displayWeight),
    reach: text(athlete.displayReach),
    stance: text(record(athlete.stance).text),
  };
}

function weightClassLabel(value: unknown) {
  const type = record(value);
  const label = text(type.text) ?? text(type.abbreviation);
  return label?.replace(/^W\s+/i, "Women's ");
}

function ufcNumber(value: string) {
  return value.match(/\bufc\s+(\d+)\b/i)?.[1];
}

function normalizedWords(value: string) {
  return new Set(
    value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
      .filter((word) => word.length > 2 && word !== 'ufc'),
  );
}

function titleScore(expected: string, candidate: string) {
  const expectedNumber = ufcNumber(expected);
  const candidateNumber = ufcNumber(candidate);
  if (expectedNumber && candidateNumber) return expectedNumber === candidateNumber ? 100 : -1;
  const expectedWords = normalizedWords(expected);
  const candidateWords = normalizedWords(candidate);
  return [...expectedWords].filter((word) => candidateWords.has(word)).length;
}

function eventLink(event: UnknownRecord) {
  return text(list(event.links)
    .find((link) => Array.isArray(link.rel) && link.rel.includes('event'))
    ?.href);
}

function competitionTimestamp(competition: UnknownRecord) {
  const value = text(competition.date);
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function broadcasts(competitions: UnknownRecord[]): EventBroadcast[] {
  const names = competitions.flatMap((competition) =>
    list(competition.broadcasts).flatMap((broadcast) =>
      Array.isArray(broadcast.names) ? broadcast.names.map(text) : [],
    ),
  ).filter((name): name is string => Boolean(name));
  return [...new Set(names)].map((name) => ({ name, countryCode: 'US' }));
}

function status(value: unknown): EventSearchResult['status'] {
  const normalized = text(record(record(value).type).description)?.toLowerCase() ?? '';
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('postpon')) return 'postponed';
  if (normalized.includes('progress')) return 'in-progress';
  if (normalized.includes('final') || normalized.includes('complete')) return 'completed';
  return normalized ? 'scheduled' : 'unknown';
}

function timedCard(event: UnknownRecord) {
  const timedCompetitions = list(event.competitions)
    .map((competition) => ({ competition, timestamp: competitionTimestamp(competition) }))
    .filter((item): item is { competition: UnknownRecord; timestamp: number } =>
      item.timestamp !== undefined,
    );
  if (timedCompetitions.length === 0) return undefined;
  const timestamp = Math.max(...timedCompetitions.map((item) => item.timestamp));
  return {
    timestamp,
    competitions: timedCompetitions
      .filter((item) => item.timestamp === timestamp)
      .map((item) => item.competition),
  };
}

function competitorOrder(value: UnknownRecord) {
  return typeof value.order === 'number' ? value.order : Number.MAX_SAFE_INTEGER;
}

function athleteImageUrl(id: string, athlete: UnknownRecord) {
  return text(record(athlete.headshot).href)
    ?? `https://a.espncdn.com/i/headshots/mma/players/full/${encodeURIComponent(id)}.png`;
}

function overallRecord(competitor: UnknownRecord) {
  const records = list(competitor.records);
  return text(records.find((item) => item.type === 'total' || item.name === 'overall')?.summary)
    ?? text(records[0]?.summary);
}

function eventFighter(value: UnknownRecord): EventFighter | undefined {
  const id = text(value.id);
  const athlete = record(value.athlete);
  const name = text(athlete.displayName) ?? text(athlete.fullName);
  if (!id || !name) return undefined;
  const flag = record(athlete.flag);
  return {
    providerAthleteId: id,
    name,
    shortName: text(athlete.shortName),
    imageUrl: athleteImageUrl(id, athlete),
    record: overallRecord(value),
    country: text(flag.alt),
    countryFlagUrl: text(flag.href),
    winner: typeof value.winner === 'boolean' ? value.winner : undefined,
  };
}

function competitionTitle(competition: UnknownRecord) {
  return list(competition.competitors)
    .flatMap((competitor) => list(record(competitor.athlete).accolades))
    .find((accolade) => text(accolade.type)?.toLowerCase() === 'belt')
    ?.name;
}

function cardSectionForTimestamp(
  timestamp: number | undefined,
  orderedTimestamps: readonly number[],
): EventCardSection {
  if (timestamp === orderedTimestamps.at(-1)) return 'main';
  if (orderedTimestamps.length >= 3 && timestamp === orderedTimestamps[0]) {
    return 'early-prelims';
  }
  return 'prelims';
}

function eventBouts(event: UnknownRecord): EventBout[] {
  const competitions = list(event.competitions);
  const orderedTimestamps = [...new Set(competitions
    .map(competitionTimestamp)
    .filter((timestamp): timestamp is number => timestamp !== undefined))]
    .sort((a, b) => a - b);
  const sectionOrder: Record<EventCardSection, number> = {
    main: 0,
    prelims: 1,
    'early-prelims': 2,
  };

  return competitions
    .flatMap((competition, sourceIndex) => {
      const timestamp = competitionTimestamp(competition);
      const competitionStatus = record(competition.status);
      const statusType = record(competitionStatus.type);
      const fighters = list(competition.competitors)
        .sort((a, b) => competitorOrder(a) - competitorOrder(b))
        .map(eventFighter)
        .filter((fighter): fighter is EventFighter => Boolean(fighter));
      const providerCompetitionId = text(competition.id);
      if (!providerCompetitionId || fighters.length === 0) return [];
      return [{
        sourceIndex,
        bout: {
          providerCompetitionId,
          cardSection: cardSectionForTimestamp(timestamp, orderedTimestamps),
          startDateTime: timestamp ? new Date(timestamp).toISOString() : undefined,
          weightClass: weightClassLabel(competition.type),
          title: text(competitionTitle(competition)),
          status: text(statusType.shortDetail)
            ?? text(statusType.detail)
            ?? text(statusType.description),
          period: typeof competitionStatus.period === 'number'
            ? competitionStatus.period
            : undefined,
          displayClock: text(competitionStatus.displayClock),
          fighters,
        } satisfies EventBout,
      }];
    })
    .sort((a, b) => {
      const section = sectionOrder[a.bout.cardSection] - sectionOrder[b.bout.cardSection];
      return section || b.sourceIndex - a.sourceIndex;
    })
    .map((item) => item.bout);
}

export function normalizeEspnUfcEvent(value: unknown): EventSearchResult | undefined {
  const event = record(value);
  const id = text(event.id);
  const title = text(event.name);
  const eventDate = text(event.date);
  const date = eventDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!id || !title || !date) return undefined;
  const card = timedCard(event);
  const mainCard = card?.competitions ?? [];
  const representative = mainCard[0] ?? list(event.competitions)[0] ?? {};
  const venue = record(representative.venue);
  const address = record(venue.address);
  const bouts = eventBouts(event);
  const headline = bouts.find((bout) => bout.cardSection === 'main')
    ?? bouts[0];
  const matchups = bouts.map((bout) => {
    const names = bout.fighters.map((fighter) => fighter.name);
    return names.length >= 2 ? `${names[0]} vs ${names[1]}` : names[0];
  }).filter((matchup): matchup is string => Boolean(matchup));

  return {
    provider: 'espn',
    providerEventId: id,
    kind: 'sports',
    sourceName: 'ESPN',
    sourceUrl: eventLink(event),
    title,
    startDateTime: card ? new Date(card.timestamp).toISOString() : undefined,
    date,
    allDay: !card,
    durationMinutes: 240,
    participants: headline?.fighters?.map((fighter) => fighter.name) ?? [],
    card: [...new Set(matchups)],
    bouts,
    venue: {
      name: text(venue.fullName),
      address: text(address.address1),
      city: text(address.city),
      region: text(address.state),
      countryCode: text(address.country),
    },
    broadcasts: broadcasts(mainCard),
    status: status(event.status),
  };
}

/**
 * ESPN groups UFC bouts by card start. The latest scheduled group is the main
 * card, which is the time users expect for a UFC event-level calendar entry.
 */
export function enrichTimeTbaUfcEvent(
  result: EventSearchResult,
  scoreboard: unknown,
): EventSearchResult {
  if (!/\bufc\b/i.test(result.title)) return result;
  const body = record(scoreboard);
  const match = list(body.events)
    .map((event) => ({ event, score: titleScore(result.title, text(event.name) ?? '') }))
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score)[0]?.event;
  if (!match) return result;

  const card = timedCard(match);
  if (!card) return result;
  const normalized = normalizeEspnUfcEvent(match);
  const representative = card.competitions[0] ?? {};
  const venue = record(representative.venue);
  const address = record(venue.address);
  const enrichedBroadcasts = broadcasts(card.competitions);
  const hasKnownTime = Boolean(result.startDateTime && !result.allDay);

  return {
    ...result,
    startDateTime: hasKnownTime
      ? result.startDateTime
      : normalized?.startDateTime ?? new Date(card.timestamp).toISOString(),
    allDay: false,
    participants: normalized?.participants.length
      ? normalized.participants
      : result.participants,
    card: normalized?.card?.length ? normalized.card : result.card,
    bouts: normalized?.bouts?.length ? normalized.bouts : result.bouts,
    venue: normalized?.venue?.name ? normalized.venue : {
      name: text(venue.fullName) ?? result.venue?.name,
      address: text(address.address1) ?? result.venue?.address,
      city: text(address.city) ?? result.venue?.city,
      region: text(address.state) ?? result.venue?.region,
      countryCode: text(address.country) ?? result.venue?.countryCode,
    },
    broadcasts: normalized?.broadcasts.length
      ? normalized.broadcasts
      : enrichedBroadcasts.length
        ? enrichedBroadcasts
        : result.broadcasts,
    imageUrl: normalized?.imageUrl ?? result.imageUrl,
    status: normalized && normalized.status !== 'unknown'
      ? normalized.status
      : result.status,
    sourceName: /\bespn\b/i.test(result.sourceName)
      ? result.sourceName
      : `${result.sourceName} · ESPN`,
    sourceUrl: normalized?.sourceUrl ?? eventLink(match) ?? result.sourceUrl,
  };
}
