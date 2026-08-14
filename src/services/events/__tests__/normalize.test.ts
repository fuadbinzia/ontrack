import {
  normalizeSportsDbBroadcast,
  normalizeSportsDbEvent,
  normalizeSportsDbTarget,
  normalizeTicketmasterAttraction,
  normalizeTicketmasterEvent,
} from '@/services/events/normalize';

describe('event provider normalization', () => {
  it('normalizes a Ticketmaster concert with venue, artist, image, and ticket URL', () => {
    expect(normalizeTicketmasterEvent({
      id: 'tm-1',
      name: 'Example Artist Live',
      url: 'https://tickets.example/event',
      dates: { start: { localDate: '2026-09-10', dateTime: '2026-09-11T00:00:00Z' }, status: { code: 'onsale' } },
      images: [{ url: 'https://img.example/small.jpg', width: 300 }, { url: 'https://img.example/large.jpg', width: 1200 }],
      _embedded: {
        attractions: [{ name: 'Example Artist' }],
        venues: [{ name: 'The Hall', city: { name: 'New York' }, state: { stateCode: 'NY' }, country: { countryCode: 'US' }, address: { line1: '1 Main St' } }],
      },
    })).toMatchObject({
      provider: 'ticketmaster',
      providerEventId: 'tm-1',
      kind: 'concert',
      title: 'Example Artist Live',
      date: '2026-09-10',
      allDay: false,
      participants: ['Example Artist'],
      imageUrl: 'https://img.example/large.jpg',
      ticketUrl: 'https://tickets.example/event',
      venue: { name: 'The Hall', city: 'New York', region: 'NY', countryCode: 'US' },
    });
  });

  it('keeps time-TBA concerts as all-day results and tolerates missing venues', () => {
    expect(normalizeTicketmasterEvent({
      id: 'tm-tba', name: 'Date Announced', dates: { start: { localDate: '2026-10-01' } },
    })).toMatchObject({ date: '2026-10-01', allDay: true, venue: {} });
  });

  it('normalizes NBA timing, participants, status, and multiple US broadcasts', () => {
    const broadcasts = [
      normalizeSportsDbBroadcast({ strChannel: 'ESPN', strCountry: 'United States' }),
      normalizeSportsDbBroadcast({ strChannel: 'NBA League Pass', strCountry: 'United States', strWebsite: 'https://watch.example' }),
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));
    expect(normalizeSportsDbEvent({
      idEvent: 'nba-1',
      strEvent: 'Knicks vs Lakers',
      dateEvent: '2026-11-02',
      strTimestamp: '2026-11-03T00:30:00Z',
      strAwayTeam: 'Los Angeles Lakers',
      strHomeTeam: 'New York Knicks',
      strVenue: 'Madison Square Garden',
      strStatus: 'Scheduled',
    }, 'nba', broadcasts)).toMatchObject({
      providerEventId: 'nba-1',
      kind: 'nba',
      participants: ['Los Angeles Lakers', 'New York Knicks'],
      broadcasts: [{ name: 'ESPN' }, { name: 'NBA League Pass', url: 'https://watch.example' }],
      watchUrl: 'https://watch.example',
      status: 'scheduled',
    });
  });

  it('treats provider placeholder midnight as time TBA', () => {
    expect(normalizeSportsDbEvent({
      idEvent: 'ufc-tba',
      strEvent: 'UFC placeholder time',
      dateEvent: '2026-08-15',
      dateEventLocal: '2026-08-15',
      strTimestamp: '2026-08-15T00:00:00',
      strTime: '00:00:00',
      strTimeLocal: '',
      strTimezone: '',
      strSport: 'Fighting',
    }, 'sports')).toMatchObject({
      date: '2026-08-15',
      allDay: true,
      startDateTime: undefined,
    });
  });

  it('preserves a genuine midnight listing with timezone evidence', () => {
    expect(normalizeSportsDbEvent({
      idEvent: 'midnight-real',
      strEvent: 'Midnight tipoff',
      dateEvent: '2026-11-03',
      strTimestamp: '2026-11-03T00:00:00Z',
      strTime: '00:00:00',
      strTimeLocal: '20:00:00',
      strTimezone: 'UTC',
      strSport: 'Basketball',
    }, 'sports')).toMatchObject({
      allDay: false,
      startDateTime: '2026-11-03T00:00:00.000Z',
    });
  });

  it('maps cancelled and postponed sports provider statuses', () => {
    expect(normalizeSportsDbEvent({ idEvent: '1', strEvent: 'Fight', dateEvent: '2026-09-01', strStatus: 'CANC' }, 'ufc')?.status).toBe('cancelled');
    expect(normalizeSportsDbEvent({ idEvent: '2', strEvent: 'Game', dateEvent: '2026-09-01', strStatus: 'Postponed' }, 'nba')?.status).toBe('postponed');
  });

  it('normalizes broad sports with sport-appropriate durations', () => {
    expect(normalizeSportsDbEvent({
      idEvent: 'baseball-1', strEvent: 'Yankees vs Mets', dateEvent: '2026-09-01', strSport: 'Baseball',
    }, 'sports')).toMatchObject({ kind: 'sports', durationMinutes: 180 });
    expect(normalizeSportsDbEvent({
      idEvent: 'football-1', strEvent: 'Jets vs Giants', dateEvent: '2026-09-02', strSport: 'American Football',
    }, 'sports')).toMatchObject({ kind: 'sports', durationMinutes: 210 });
    expect(normalizeSportsDbEvent({
      idEvent: 'soccer-1', strEvent: 'City derby', dateEvent: '2026-09-03', strSport: 'Soccer',
    }, 'sports')).toMatchObject({ kind: 'sports', durationMinutes: 120 });
  });

  it('normalizes follow targets and rejects malformed provider objects', () => {
    expect(normalizeSportsDbTarget({ idTeam: '10', strTeam: 'New York Knicks', strLeague: 'NBA' }, 'nba')).toMatchObject({ targetKind: 'team', kind: 'nba' });
    expect(normalizeSportsDbTarget({ idLeague: '20', strLeague: 'UFC' }, 'ufc')).toMatchObject({ targetKind: 'promotion', kind: 'ufc' });
    expect(normalizeSportsDbTarget({ idLeague: '30', strLeague: 'NBA' }, 'nba')).toMatchObject({ targetKind: 'league', kind: 'nba' });
    expect(normalizeSportsDbTarget({ idTeam: '40', strTeam: 'New York Yankees', strSport: 'Baseball' }, 'sports')).toMatchObject({ targetKind: 'team', kind: 'sports' });
    expect(normalizeSportsDbTarget({ idLeague: '50', strLeague: 'Formula 1', strSport: 'Motorsport' }, 'sports')).toMatchObject({ targetKind: 'league', kind: 'sports' });
    expect(normalizeTicketmasterAttraction({ id: '30', name: 'Example Artist' })).toMatchObject({ targetKind: 'artist', kind: 'concert' });
    expect(normalizeTicketmasterEvent({ id: 'missing-title' })).toBeUndefined();
  });
});
