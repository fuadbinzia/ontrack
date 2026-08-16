import { DEFAULT_TAB_ORDER } from '@/components/navigation/tab-recency';
import type { AnalyticsSurface } from '@/services/analytics/surfaces';

export type OverviewAffinityEntry = {
  visitCount: number;
  lastVisitedAt: number;
};

/** Unused modules fade; recent opens keep winning the Overview stack. */
export const OVERVIEW_AFFINITY_HALF_LIFE_DAYS = 14;

const MS_PER_DAY = 86_400_000;
const DWELL_MS_PER_VISIT = 60_000;

const TRACKED_ROUTES = new Set<string>(
  DEFAULT_TAB_ORDER.filter((name) => name !== 'overview'),
);

const OVERVIEW_ROUTE_BY_SURFACE: Partial<Record<AnalyticsSurface, string>> = {
  today: '(today)',
  calendar: 'calendar',
  checklists: 'to-do',
  travel: 'travel',
  plants: 'plants',
  workouts: 'workouts',
  health: 'health',
  vehicles: 'vehicles',
  'vision-board': 'vision-board',
  games: 'games',
  social: 'social',
  insights: 'insights',
  profile: 'profile',
  nutrition: 'food',
};

export function isOverviewAffinityRoute(routeName: string): boolean {
  return TRACKED_ROUTES.has(routeName);
}

export function overviewAffinityScore(
  entry: OverviewAffinityEntry | undefined,
  now: number,
): number {
  if (!entry || entry.visitCount <= 0) return 0;
  if (!Number.isFinite(entry.lastVisitedAt)) return 0;
  const ageDays = Math.max(0, (now - entry.lastVisitedAt) / MS_PER_DAY);
  return entry.visitCount / (1 + ageDays / OVERVIEW_AFFINITY_HALF_LIFE_DAYS);
}

export function affinitiesFromUsage(
  surfaces: readonly { surface: AnalyticsSurface; activeMs: number }[],
  now: number,
): Record<string, OverviewAffinityEntry> {
  const byRoute: Record<string, OverviewAffinityEntry> = {};
  for (const { surface, activeMs } of surfaces) {
    const routeName = OVERVIEW_ROUTE_BY_SURFACE[surface];
    if (!routeName || !Number.isFinite(activeMs) || activeMs <= 0) continue;
    byRoute[routeName] = {
      visitCount: Math.max(1, Math.round(activeMs / DWELL_MS_PER_VISIT)),
      lastVisitedAt: now,
    };
  }
  return byRoute;
}

export function sortOverviewRowsByAffinity<T extends { routeName: string }>(
  rows: readonly T[],
  byRoute: Readonly<Record<string, OverviewAffinityEntry>>,
  now: number,
): T[] {
  return rows
    .map((row, index) => ({
      row,
      index,
      score: overviewAffinityScore(byRoute[row.routeName], now),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map(({ row }) => row);
}
