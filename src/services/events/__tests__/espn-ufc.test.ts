import {
  enrichTimeTbaUfcEvent,
  normalizeEspnUfcAthleteProfile,
  normalizeEspnUfcEvent,
} from '@/services/events/espn-ufc';
import type { EventSearchResult } from '@/services/events/types';

const result: EventSearchResult = {
  provider: 'thesportsdb',
  providerEventId: '2449570',
  kind: 'sports',
  sourceName: 'TheSportsDB',
  title: 'UFC 330 Makhachev vs Machado Garry',
  date: '2026-08-15',
  allDay: true,
  durationMinutes: 240,
  participants: [],
  broadcasts: [],
  status: 'unknown',
};

describe('ESPN UFC time enrichment', () => {
  it('normalizes available tale-of-the-tape fields without inventing missing values', () => {
    expect(normalizeEspnUfcAthleteProfile({
      id: 'fighter-101',
      age: 31.2,
      displayHeight: `5' 11"`,
      displayWeight: '170 lbs',
      displayReach: '72"',
      stance: { text: 'Orthodox' },
    })).toEqual({
      providerAthleteId: 'fighter-101',
      age: 31,
      height: `5' 11"`,
      weight: '170 lbs',
      reach: '72"',
      stance: 'Orthodox',
    });
    expect(normalizeEspnUfcAthleteProfile({ id: 'fighter-102' })).toEqual({
      providerAthleteId: 'fighter-102',
      age: undefined,
      height: undefined,
      weight: undefined,
      reach: undefined,
      stance: undefined,
    });
    expect(normalizeEspnUfcAthleteProfile({ age: 29 })).toBeUndefined();
  });

  it('normalizes an upcoming event at its main-card time', () => {
    expect(normalizeEspnUfcEvent({
      id: '600059185',
      name: 'UFC 330: Makhachev vs. Machado Garry',
      date: '2026-08-15T21:00Z',
      status: { type: { description: 'Scheduled' } },
      competitions: [
        {
          id: 'early-1',
          date: '2026-08-15T21:30Z',
          type: { abbreviation: 'W Strawweight' },
          competitors: [
            { id: 'fighter-a', order: 1, athlete: { displayName: 'Fighter A' }, records: [{ type: 'total', summary: '10-2-0' }] },
            { id: 'fighter-b', order: 2, athlete: { displayName: 'Fighter B' }, records: [{ type: 'total', summary: '8-1-0' }] },
          ],
        },
        {
          id: 'main-1',
          date: '2026-08-16T01:00Z',
          type: { abbreviation: 'Welterweight' },
          status: {
            displayClock: '3:04',
            period: 2,
            type: { shortDetail: 'Final' },
          },
          competitors: [
            {
              id: '3332412',
              order: 1,
              winner: true,
              athlete: {
                displayName: 'Islam Makhachev',
                flag: { alt: 'Russia', href: 'https://cdn.example.test/russia.png' },
                accolades: [{ type: 'Belt', name: 'UFC Welterweight Title' }],
              },
              records: [{ type: 'total', summary: '28-1-0' }],
            },
            {
              id: '4738092',
              order: 2,
              athlete: { displayName: 'Ian Machado Garry' },
              records: [{ type: 'total', summary: '17-1-0' }],
            },
          ],
          venue: { fullName: 'Xfinity Mobile Arena', address: { city: 'Philadelphia', state: 'PA' } },
          broadcasts: [{ names: ['Paramount+'] }],
        },
      ],
    })).toMatchObject({
      provider: 'espn',
      startDateTime: '2026-08-16T01:00:00.000Z',
      date: '2026-08-15',
      allDay: false,
      participants: ['Islam Makhachev', 'Ian Machado Garry'],
      bouts: [
        {
          providerCompetitionId: 'main-1',
          cardSection: 'main',
          weightClass: 'Welterweight',
          title: 'UFC Welterweight Title',
          status: 'Final',
          period: 2,
          displayClock: '3:04',
          fighters: [
            {
              providerAthleteId: '3332412',
              name: 'Islam Makhachev',
              imageUrl: 'https://a.espncdn.com/i/headshots/mma/players/full/3332412.png',
              record: '28-1-0',
              country: 'Russia',
              winner: true,
            },
            {
              providerAthleteId: '4738092',
              name: 'Ian Machado Garry',
              imageUrl: 'https://a.espncdn.com/i/headshots/mma/players/full/4738092.png',
              record: '17-1-0',
            },
          ],
        },
        expect.objectContaining({
          providerCompetitionId: 'early-1',
          cardSection: 'prelims',
          weightClass: "Women's Strawweight",
        }),
      ],
      broadcasts: [{ name: 'Paramount+' }],
      status: 'scheduled',
    });
  });

  it('enriches an already-timed imported event with fighter cards without changing its chosen time', () => {
    const timed = {
      ...result,
      allDay: false,
      startDateTime: '2026-08-16T00:30:00Z',
    };
    const enriched = enrichTimeTbaUfcEvent(timed, {
      events: [{
        id: '600059185',
        name: 'UFC 330: Makhachev vs. Machado Garry',
        date: '2026-08-15T21:00Z',
        competitions: [{
          id: 'main-1',
          date: '2026-08-16T01:00Z',
          type: { abbreviation: 'Welterweight' },
          competitors: [
            { id: '3332412', order: 1, athlete: { displayName: 'Islam Makhachev' }, records: [{ type: 'total', summary: '28-1-0' }] },
            { id: '4738092', order: 2, athlete: { displayName: 'Ian Machado Garry' }, records: [{ type: 'total', summary: '17-1-0' }] },
          ],
        }],
      }],
    });

    expect(enriched.startDateTime).toBe('2026-08-16T00:30:00Z');
    expect(enriched.bouts?.[0]).toMatchObject({
      weightClass: 'Welterweight',
      fighters: [
        { name: 'Islam Makhachev', record: '28-1-0' },
        { name: 'Ian Machado Garry', record: '17-1-0' },
      ],
    });
  });

  it('uses the main-card group for a matching time-TBA UFC event', () => {
    expect(enrichTimeTbaUfcEvent(result, {
      events: [{
        name: 'UFC 330: Makhachev vs. Machado Garry',
        links: [{ rel: ['summary', 'event'], href: 'https://www.espn.com/mma/fightcenter/_/id/600059185/league/ufc' }],
        competitions: [
          { date: '2026-08-15T21:30Z' },
          { date: '2026-08-15T23:00Z' },
          {
            date: '2026-08-16T01:00Z',
            venue: { fullName: 'Xfinity Mobile Arena', address: { city: 'Philadelphia', state: 'PA', country: 'USA' } },
            broadcasts: [{ market: 'national', names: ['Paramount+'] }],
          },
        ],
      }],
    })).toMatchObject({
      startDateTime: '2026-08-16T01:00:00.000Z',
      date: '2026-08-15',
      allDay: false,
      venue: { name: 'Xfinity Mobile Arena', city: 'Philadelphia', region: 'PA' },
      broadcasts: [{ name: 'Paramount+', countryCode: 'US' }],
      sourceName: 'TheSportsDB · ESPN',
    });
  });

  it('does not apply a different numbered UFC event or overwrite known times', () => {
    const scoreboard = { events: [{ name: 'UFC 331: Example', competitions: [{ date: '2026-08-16T01:00Z' }] }] };
    expect(enrichTimeTbaUfcEvent(result, scoreboard)).toBe(result);
    expect(enrichTimeTbaUfcEvent({ ...result, allDay: false, startDateTime: '2026-08-16T00:00:00Z' }, scoreboard))
      .toMatchObject({ startDateTime: '2026-08-16T00:00:00Z' });
  });
});
