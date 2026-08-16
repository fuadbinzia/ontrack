import { buildOverviewSummary, type OverviewSummaryInput } from '../overview-model';

const enabledAddons = {
  food: true,
  fitness: true,
  plants: true,
  travel: true,
  'vision-board': true,
  games: true,
  vehicles: true,
  health: true,
  finance: true,
  journal: true,
};

function input(
  overrides: Partial<OverviewSummaryInput> = {},
): OverviewSummaryInput {
  return {
    today: '2026-08-15',
    currentMinutes: 600,
    activities: [],
    categories: [],
    eventDetails: [],
    eventFollows: [],
    listsCount: 0,
    openTaskCount: 0,
    plans: [],
    bills: [],
    plants: [],
    healthSummaries: [],
    moodEntryCount: 0,
    vehicles: [],
    mealEntries: [],
    visionCategoryCount: 0,
    visionItems: [],
    acknowledgedAttentionKeys: [],
    enabledAddons,
    setSelectedDate: () => undefined,
    ...overrides,
  };
}

describe('overview summary row order', () => {
  const previousOs = process.env.EXPO_OS;

  beforeAll(() => {
    process.env.EXPO_OS = 'ios';
  });

  afterAll(() => {
    process.env.EXPO_OS = previousOs;
  });

  it('starts in the catalog order before a user has a habit', () => {
    expect(buildOverviewSummary(input()).rows.map((row) => row.routeName)).toEqual(
      [
        '(today)',
        'travel',
        'to-do',
        'finance',
        'plants',
        'workouts',
        'health',
        'vehicles',
        'food',
        'vision-board',
        'calendar',
        'insights',
        'social',
        'games',
        'profile',
      ],
    );
  });

  it('lifts the modules a person actually opens to the top', () => {
    const now = Date.UTC(2026, 7, 15);
    expect(
      buildOverviewSummary(
        input({
          now,
          affinities: {
            finance: { visitCount: 6, lastVisitedAt: now },
            plants: { visitCount: 3, lastVisitedAt: now },
          },
        }),
      ).rows.slice(0, 4).map((row) => row.routeName),
    ).toEqual(['finance', 'plants', '(today)', 'travel']);
  });
});
