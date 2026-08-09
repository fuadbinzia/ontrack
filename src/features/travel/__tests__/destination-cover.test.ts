import {
    destinationCoverCandidates,
    destinationPhotoSuggestsPeople,
    destinationPhotoSuggestsText,
    enlargeWikimediaThumb,
    hasDestinationLandmarkIntent,
    isAllowedDestinationCoverImageUrl,
    isDirectClientCoverUrl,
    isUsableDestinationPhotoUrl,
    localTripCoverUri,
    mergeDestinationCoverUrls,
    pickRotatingHeroUris,
    proxyDestinationCoverImageUrl,
    stayCoverCandidates,
} from '../destination-cover';
import type { TravelPlan } from '../types';

jest.mock('@/services/http/api-url', () => ({
  resolveExpoApiUrl: (path: string) => `http://localhost:8081${path}`,
}));

jest.mock('@/features/travel/travel-moment-media', () => ({
  persistTravelMomentPhotos: jest.fn(),
  resolveTravelPhotoUris: (uris?: string[]) =>
    (uris ?? []).filter((uri) => typeof uri === 'string' && uri.length > 0),
}));

function plan(partial: Partial<TravelPlan>): TravelPlan {
  return {
    id: 'plan-1',
    title: 'Trip',
    destination: '',
    startDate: '2026-08-01',
    endDate: '2026-08-08',
    itinerary: [],
    participants: [],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

describe('hasDestinationLandmarkIntent', () => {
  it('detects landmark / structure keywords', () => {
    expect(hasDestinationLandmarkIntent('Iceland landmark')).toBe(true);
    expect(hasDestinationLandmarkIntent('Santa Catalina arch')).toBe(true);
    expect(hasDestinationLandmarkIntent('Reykjavík')).toBe(false);
  });
});

describe('pickRotatingHeroUris', () => {
  const pool = [
    'https://images.unsplash.com/a.jpg',
    'https://images.unsplash.com/b.jpg',
    'https://images.unsplash.com/c.jpg',
    'https://images.unsplash.com/d.jpg',
    'https://images.unsplash.com/e.jpg',
    'https://images.unsplash.com/f.jpg',
  ];

  it('returns different trios as the salt advances', () => {
    const first = pickRotatingHeroUris(pool, [], 3, 0);
    const second = pickRotatingHeroUris(pool, [], 3, 3);
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(3);
    expect(first).not.toEqual(second);
  });

  it('prefers unseen URIs before wrapping into recent ones', () => {
    const recent = pool.slice(0, 3);
    const next = pickRotatingHeroUris(pool, recent, 3, 0);
    expect(next).toEqual(pool.slice(3, 6));
  });

  it('never skips remaining unseen plates when salt is large', () => {
    const recent = pool.slice(0, 4);
    const next = pickRotatingHeroUris(pool, recent, 3, 99);
    // salt 99 % 2 → lead with pool[5], then pool[4], then oldest recent.
    expect(next.slice(0, 2)).toEqual([pool[5], pool[4]]);
    expect(new Set(next).size).toBe(3);
  });

  it('keeps an Unsplash plate from always leading when salt rotates', () => {
    const mixed = [
      'https://upload.wikimedia.org/wikipedia/commons/a.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/b.jpg',
      'https://images.unsplash.com/guatemala.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/c.jpg',
    ];
    const first = pickRotatingHeroUris(mixed, [], 3, 0);
    const second = pickRotatingHeroUris(mixed, [], 3, 2);
    expect(first[0]).not.toBe(second[0]);
    expect(second[0]).toBe(mixed[2]);
  });
});

describe('destinationCoverCandidates', () => {
  it('leads with curated iconic draws (aurora, waterfalls) for Iceland', () => {
    const candidates = destinationCoverCandidates(
      plan({ title: 'Iceland', destination: 'Reykjavík, Iceland' }),
    );
    expect(candidates[0]).toMatch(/northern lights|aurora/i);
    expect(candidates.some((q) => /Gullfoss/i.test(q))).toBe(true);
    expect(candidates.some((q) => /Blue Lagoon/i.test(q))).toBe(true);
    expect(candidates).toContain('Reykjavík');
    expect(candidates).toContain('Iceland');
  });

  it('spreads Guatemala across multiple landmarks (not one lake plate)', () => {
    const candidates = destinationCoverCandidates(
      plan({ title: 'Guatemala boys trip', destination: 'Guatemala' }),
    );
    expect(candidates.some((q) => /Atitlan|Atitlán/i.test(q))).toBe(true);
    expect(candidates.some((q) => /Tikal/i.test(q))).toBe(true);
    expect(candidates.some((q) => /Santa Catalina|Volcan de Agua|Acatenango/i.test(q))).toBe(
      true,
    );
  });

  it('falls back to iconic draw suffixes when destination is unknown', () => {
    expect(
      destinationCoverCandidates(plan({ title: 'Nowhereville', destination: '' })),
    ).toEqual([
      'Nowhereville iconic',
      'Nowhereville famous attraction',
      'Nowhereville scenic landscape',
      'Nowhereville',
    ]);
  });

  it('leads Lisbon with bridge / Belém landmark queries', () => {
    const candidates = destinationCoverCandidates(
      plan({ title: 'Lisbon trip', destination: 'Lisbon, Portugal' }),
    );
    expect(candidates[0]).toMatch(/Ponte 25 de Abril|Belém|Jerónimos/i);
    expect(candidates).toContain('Lisbon');
    expect(candidates).toContain('Portugal');
  });

  it('keeps curated Paris icons ahead of bare city Wiki titles', () => {
    const candidates = destinationCoverCandidates(
      plan({ title: 'Paris trip', destination: 'Paris' }),
    );
    expect(candidates[0]).toMatch(/Eiffel/i);
    expect(candidates).toContain('Paris');
  });
});

describe('stayCoverCandidates', () => {
  it('prefers the hotel title then geographic address parts', () => {
    expect(
      stayCoverCandidates(
        'Hotel Avenida Palace',
        'Rua 1.º Dezembro 123, Lisboa, Portugal',
      ),
    ).toEqual([
      'Hotel Avenida Palace',
      'Lisboa',
      'Portugal',
      'Rua 1.º Dezembro 123, Lisboa, Portugal',
    ]);
  });

  it('skips generic stay titles and still uses the address', () => {
    expect(stayCoverCandidates('Demo Stay', 'Lisbon, Portugal')).toEqual([
      'Lisbon',
      'Portugal',
      'Lisbon, Portugal',
    ]);
  });
});

describe('destinationPhotoSuggestsPeople', () => {
  it('flags tourist / portrait stock metadata', () => {
    expect(destinationPhotoSuggestsPeople('Tourists at Blue Lagoon')).toBe(true);
    expect(destinationPhotoSuggestsPeople('couple selfie in Reykjavik')).toBe(
      true,
    );
    expect(
      destinationPhotoSuggestsPeople(
        'person in black jacket standing under green aurora',
      ),
    ).toBe(true);
    expect(
      destinationPhotoSuggestsPeople(
        'Photographing from Ulfarsfell around midnight',
      ),
    ).toBe(true);
    expect(
      destinationPhotoSuggestsPeople(
        'two friends lifestyle street style in Lisbon',
      ),
    ).toBe(true);
    expect(destinationPhotoSuggestsPeople('guys together in Alfama')).toBe(
      true,
    );
    expect(
      destinationPhotoSuggestsPeople('Aurora Borealis over Kirkjufell'),
    ).toBe(false);
    expect(
      destinationPhotoSuggestsPeople('Ponte 25 de Abril Lisbon bridge skyline'),
    ).toBe(false);
    expect(
      destinationPhotoSuggestsPeople(
        'DIG15178-007 Tyeschea West looking at B.B. Kings guitar exhibition',
      ),
    ).toBe(true);
  });
});

describe('destinationPhotoSuggestsText', () => {
  it('flags typography / signage stock without matching Texas', () => {
    expect(destinationPhotoSuggestsText('neon sign typography wall')).toBe(
      true,
    );
    expect(
      destinationPhotoSuggestsText('Please choose a more precise name for your image'),
    ).toBe(true);
    expect(destinationPhotoSuggestsText('billboard poster overlay text')).toBe(
      true,
    );
    expect(
      destinationPhotoSuggestsText('Austin Texas United States skyline'),
    ).toBe(false);
    expect(
      destinationPhotoSuggestsText('Ponte 25 de Abril Lisbon bridge skyline'),
    ).toBe(false);
    expect(
      destinationPhotoSuggestsText('Stylized map of austin, texas'),
    ).toBe(true);
  });
});

describe('isUsableDestinationPhotoUrl', () => {
  it('accepts https photo urls', () => {
    expect(
      isUsableDestinationPhotoUrl(
        'https://upload.wikimedia.org/wikipedia/commons/a/a1/Paris.jpg',
      ),
    ).toBe(true);
  });

  it('rejects svg flags and maps', () => {
    expect(
      isUsableDestinationPhotoUrl(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Flag_of_Iceland.svg/330px-Flag_of_Iceland.svg.png',
      ),
    ).toBe(false);
    expect(
      isUsableDestinationPhotoUrl(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Iceland_Mid-Atlantic_Ridge_map.svg/330px-map.svg.png',
      ),
    ).toBe(false);
  });

  it('rejects non-https urls', () => {
    expect(isUsableDestinationPhotoUrl('http://example.com/photo.jpg')).toBe(false);
  });

  it('rejects watermarked Unsplash+ preview urls', () => {
    expect(
      isUsableDestinationPhotoUrl(
        'https://plus.unsplash.com/premium_photo-1677344289076-b4e8d7325e94?w=1080',
      ),
    ).toBe(false);
    expect(
      isUsableDestinationPhotoUrl(
        'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1080',
      ),
    ).toBe(true);
  });

  it('rejects filenames that look like people stock', () => {
    expect(
      isUsableDestinationPhotoUrl(
        'https://upload.wikimedia.org/wikipedia/commons/a/a1/Tourist_portrait_Iceland.jpg',
      ),
    ).toBe(false);
  });

  it('rejects filenames that look like typography stock', () => {
    expect(
      isUsableDestinationPhotoUrl(
        'https://upload.wikimedia.org/wikipedia/commons/a/a1/Neon_sign_typography_Austin.jpg',
      ),
    ).toBe(false);
  });
});

describe('enlargeWikimediaThumb', () => {
  it('bumps the thumb width segment', () => {
    expect(
      enlargeWikimediaThumb(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Reykjavik.jpg/330px-Reykjavik.jpg',
      ),
    ).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Reykjavik.jpg/800px-Reykjavik.jpg',
    );
  });
});

describe('destination cover image proxy', () => {
  it('allowlists Wikimedia upload hosts and rejects arbitrary https', () => {
    expect(
      isAllowedDestinationCoverImageUrl(
        'https://upload.wikimedia.org/wikipedia/commons/a/a1/Paris.jpg',
      ),
    ).toBe(true);
    expect(
      isAllowedDestinationCoverImageUrl('https://evil.example/photo.jpg'),
    ).toBe(false);
  });

  it('builds a proxied API URL for allowed remotes', () => {
    const remote =
      'https://upload.wikimedia.org/wikipedia/commons/a/a1/Paris.jpg';
    const proxied = proxyDestinationCoverImageUrl(remote);
    expect(proxied).toContain('/api/destination-cover-image?src=');
    expect(proxied).toContain(encodeURIComponent(remote));
  });
});

describe('isDirectClientCoverUrl', () => {
  it('accepts Unsplash CDN urls and rejects Wikimedia', () => {
    expect(
      isDirectClientCoverUrl(
        'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1080',
      ),
    ).toBe(true);
    expect(
      isDirectClientCoverUrl(
        'https://upload.wikimedia.org/wikipedia/commons/a/a1/Paris.jpg',
      ),
    ).toBe(false);
  });
});

describe('mergeDestinationCoverUrls', () => {
  it('prefers Unsplash CDN plates ahead of Wikimedia fallbacks', () => {
    const wiki =
      'https://upload.wikimedia.org/wikipedia/commons/a/a1/Paris.jpg';
    const wiki2 =
      'https://upload.wikimedia.org/wikipedia/commons/b/b2/Louvre.jpg';
    const unsplash =
      'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1080';
    const unsplash2 =
      'https://images.unsplash.com/photo-1585208798174-6cedd86e019b?w=1080';
    expect(
      mergeDestinationCoverUrls([unsplash, unsplash2], [wiki, wiki2], 3),
    ).toEqual([unsplash, unsplash2, wiki]);
  });
});

describe('localTripCoverUri', () => {
  it('uses an explicit cover before itinerary photos', () => {
    expect(
      localTripCoverUri(
        plan({
          coverUri: 'file:///Documents/travel-moments/cover.jpg',
          itinerary: [
            {
              id: 'm1',
              kind: 'moment',
              title: 'Sunset',
              date: '2026-08-01',
              startMinutes: 0,
              durationMinutes: 60,
              photoUris: ['file:///Documents/travel-moments/moment.jpg'],
            },
          ],
        }),
      ),
    ).toBe('file:///Documents/travel-moments/cover.jpg');
  });

  it('ignores flight/stay confirmation photos and prefers moment photos', () => {
    expect(
      localTripCoverUri(
        plan({
          itinerary: [
            {
              id: 'f1',
              kind: 'flight',
              title: 'Flight',
              date: '2026-08-01',
              startMinutes: 0,
              durationMinutes: 120,
              photoUris: ['file:///Documents/travel-moments/boarding-pass.jpg'],
            },
            {
              id: 'm1',
              kind: 'moment',
              title: 'Harbor',
              date: '2026-08-02',
              startMinutes: 0,
              durationMinutes: 60,
              photoUris: ['file:///Documents/travel-moments/harbor.jpg'],
            },
          ],
        }),
      ),
    ).toBe('file:///Documents/travel-moments/harbor.jpg');
  });
});

describe('rewriteDestinationCoverFetchUrl', () => {
  // Lazy import keeps the API route out of the main cover module graph.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { rewriteDestinationCoverFetchUrl } =
    require('../../../app/api/destination-cover-image+api') as typeof import('../../../app/api/destination-cover-image+api');

  it('maps commons originals and thumbs to Special:FilePath resize URLs', () => {
    expect(
      rewriteDestinationCoverFetchUrl(
        'https://upload.wikimedia.org/wikipedia/commons/6/61/Santa_Catalina_Arch_-_Antigua_Guatemala_Feb_2020.jpg',
      ),
    ).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/Santa_Catalina_Arch_-_Antigua_Guatemala_Feb_2020.jpg?width=1200',
    );
    expect(
      rewriteDestinationCoverFetchUrl(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Santa_Catalina_Arch_-_Antigua_Guatemala_Feb_2020.jpg/800px-Santa_Catalina_Arch_-_Antigua_Guatemala_Feb_2020.jpg',
      ),
    ).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/Santa_Catalina_Arch_-_Antigua_Guatemala_Feb_2020.jpg?width=1200',
    );
  });
});
