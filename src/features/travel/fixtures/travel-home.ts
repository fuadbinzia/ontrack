/**
 * Deterministic Travel Home fixture (app + agent-ui seeds).
 * Design-kit JSON mirror: `design/travel/fixtures/travel-home.fixture.json`.
 */
import { travelHomeTokens } from '@/features/travel/travel-home-tokens';

/** Stable agent-ui / visual-QA plan ids (sandbox seed). */
export const TRAVEL_HOME_ICELAND_TRIP_ID = 'trip-travel-home-iceland';
export const TRAVEL_HOME_ANTIGUA_TRIP_ID = 'trip-travel-home-antigua';
export const TRAVEL_HOME_THIRD_TRIP_ID = 'trip-travel-home-third';

/**
 * Bundled heroes for travel-home visual QA.
 * Remote Wikimedia thumbs are blocked without a custom User-Agent in RN Image.
 */
const TRAVEL_HOME_HERO_SOURCE_BY_PLAN_ID: Record<string, number> = {
  [TRAVEL_HOME_ICELAND_TRIP_ID]: require('../../../../assets/images/travel/fixtures/iceland-hero.jpg'),
  [TRAVEL_HOME_ANTIGUA_TRIP_ID]: require('../../../../assets/images/travel/fixtures/antigua-hero.jpg'),
  [TRAVEL_HOME_THIRD_TRIP_ID]: require('../../../../assets/images/travel/fixtures/third-hero.jpg'),
};

/** DEV visual-QA local hero module for travel-home seed plans only. */
export function travelHomeFixtureHeroSource(planId: string): number | undefined {
  return TRAVEL_HOME_HERO_SOURCE_BY_PLAN_ID[planId];
}

export type TravelHomeFixtureTrip = {
  id: string;
  destination: string;
  location: string;
  startDate: string;
  endDate: string;
  dayCount: number;
  memberCount: number;
  visibleMembers: Array<{ id: string; name: string }>;
  imageQuery: string;
};

export type TravelHomeFixture = {
  trips: TravelHomeFixtureTrip[];
};

export const travelHomeFixture: TravelHomeFixture = {
  trips: [
    {
      id: TRAVEL_HOME_ICELAND_TRIP_ID,
      destination: 'Iceland',
      location: 'Reykjavík, Iceland',
      startDate: '2026-09-08',
      endDate: '2026-09-14',
      dayCount: 7,
      memberCount: 4,
      // 3+ travelers → self face only (+N); pair trips may list 2.
      visibleMembers: [{ id: 'm1', name: 'Alex Rivera' }],
      imageQuery: 'Iceland northern lights aurora Gullfoss Blue Lagoon',
    },
    {
      id: TRAVEL_HOME_ANTIGUA_TRIP_ID,
      destination: 'Antigua, Guatemala',
      location: 'Antigua, Guatemala',
      startDate: '2026-09-22',
      endDate: '2026-09-27',
      dayCount: 6,
      memberCount: 5,
      visibleMembers: [{ id: 'm3', name: 'Casey Morgan' }],
      imageQuery:
        'Antigua Guatemala Santa Catalina Arch Lake Atitlan Tikal Acatenango',
    },
  ],
};

export const travelHomeVisualScenarios = [
  'travel-home-two-trips',
  'travel-home-one-trip',
  'travel-home-empty',
  'travel-home-dark',
  'travel-home-long-destination',
  'travel-home-image-loading',
] as const;

/** Kit token contract — keep production tokens aligned with `design/travel`. */
export function travelHomeTokenContract() {
  return {
    screenHorizontal: travelHomeTokens.spacing.screenHorizontal,
    cardGap: travelHomeTokens.spacing.cardGap,
    tripCardRadius: travelHomeTokens.radius.tripCard,
    imageHeight: travelHomeTokens.sizes.tripImageHeightPhone,
    editButton: travelHomeTokens.sizes.editButton,
    avatar: travelHomeTokens.sizes.avatar,
    avatarOverlap: travelHomeTokens.spacing.avatarOverlap,
    itineraryHeight: travelHomeTokens.sizes.itineraryButtonHeight,
    itineraryRadius: travelHomeTokens.radius.itineraryButton,
    activeDot: travelHomeTokens.sizes.carouselActiveDot,
    inactiveDot: travelHomeTokens.sizes.carouselInactiveDot,
    heroCrossfadeMs: travelHomeTokens.motion.heroCrossfadeMs,
    navy: travelHomeTokens.colors.navy,
  };
}
