import type { EventDetails } from '@/services/events';
import type { Activity, ActivityCategory } from '@/types/models';

export type CalendarExcitementKind =
  | 'combat'
  | 'sports'
  | 'music'
  | 'screen'
  | 'celebration'
  | 'live-event';

export interface CalendarEventExcitement {
  activity: Activity;
  daysAway: number;
  kind: CalendarExcitementKind;
  eyebrow: string;
  headline: string;
  message: string;
  youtubeUrl?: string;
}

const COMBAT_PATTERN = /\b(ufc|mma|fight(?: night)?|boxing|bout)\b/i;
const SPORTS_PATTERN = /\b(vs\.?|versus|game|match|race|grand prix|playoffs?|finals?|tournament|cup)\b/i;
const MUSIC_PATTERN = /\b(concert|festival|tour|live music|dj set|album release)\b/i;
const SCREEN_PATTERN = /\b(movie|film|premiere|screening|showtime|comedy show|musical|theat(?:er|re))\b/i;
const CELEBRATION_PATTERN = /\b(birthday|party|wedding|anniversary|celebration)\b/i;

function dateKeyDayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function excitementKind(
  activity: Activity,
  category: ActivityCategory | undefined,
  details: EventDetails | undefined,
): CalendarExcitementKind | undefined {
  if (details?.kind === 'ufc') return 'combat';
  if (details?.kind === 'nba' || details?.kind === 'sports') {
    return COMBAT_PATTERN.test(activity.title) ? 'combat' : 'sports';
  }
  if (details?.kind === 'concert') return 'music';
  if (COMBAT_PATTERN.test(activity.title)) return 'combat';
  if (SPORTS_PATTERN.test(activity.title)) return 'sports';
  if (MUSIC_PATTERN.test(activity.title)) return 'music';
  if (category?.detailKind === 'movie' || SCREEN_PATTERN.test(activity.title)) {
    return 'screen';
  }
  if (CELEBRATION_PATTERN.test(activity.title)) return 'celebration';
  if (category?.detailKind === 'event' || details) return 'live-event';
  return undefined;
}

function eyebrow(daysAway: number, allDay: boolean | undefined): string {
  if (daysAway === 0) return allDay ? 'Today' : 'Tonight';
  if (daysAway === 1) return 'Tomorrow';
  return `In ${daysAway} Days`;
}

function headline(kind: CalendarExcitementKind, daysAway: number): string {
  if (kind === 'combat') {
    return daysAway === 0
      ? 'Fight Night Is Here'
      : daysAway === 1
        ? 'Fight Night Is Tomorrow'
        : 'The Fight Countdown Is On';
  }
  if (kind === 'sports') {
    return daysAway === 0
      ? 'Game Day Is Here'
      : daysAway === 1
        ? 'Tomorrow Is Game Day'
        : 'The Countdown Is On';
  }
  if (kind === 'music') {
    return daysAway === 0
      ? 'Tonight, We Go Live'
      : daysAway === 1
        ? 'Tomorrow Sounds Good'
        : 'The Countdown Is Getting Loud';
  }
  if (kind === 'screen') {
    return daysAway === 0
      ? 'Showtime Is Here'
      : daysAway === 1
        ? 'Showtime Is Tomorrow'
        : 'Something Good Is Coming';
  }
  if (kind === 'celebration') {
    return daysAway === 0
      ? 'A Good Day Is Here'
      : daysAway === 1
        ? 'Tomorrow Is Worth Celebrating'
        : 'You’ve Got Something To Look Forward To';
  }
  return daysAway === 0
    ? 'Tonight Has Main-Event Energy'
    : daysAway === 1
      ? 'Tomorrow Has Main-Event Energy'
      : 'Something Big Is On The Calendar';
}

function youtubeUpdatesUrl(title: string, kind: CalendarExcitementKind) {
  if (kind === 'celebration') return undefined;
  const suffix = kind === 'screen' ? 'trailer latest updates' : 'latest news preview updates';
  const query = encodeURIComponent(`${title} ${suffix}`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

function message(title: string, daysAway: number, hasUpdates: boolean): string {
  const timing = daysAway === 0
    ? 'is almost here'
    : daysAway === 1
      ? 'is one sleep away'
      : `is ${daysAway} days away`;
  return hasUpdates
    ? `${title} ${timing}. Catch the latest build-up before it begins.`
    : `${title} ${timing}. Let the anticipation be part of the fun.`;
}

/** Finds the nearest genuinely fun calendar item without hyping routine appointments. */
export function findCalendarEventExcitement({
  activities,
  categories,
  eventDetails,
  today,
  currentMinutes,
  horizonDays = 30,
}: {
  activities: readonly Activity[];
  categories: readonly ActivityCategory[];
  eventDetails: readonly EventDetails[];
  today: string;
  currentMinutes: number;
  horizonDays?: number;
}): CalendarEventExcitement | undefined {
  const todayDay = dateKeyDayNumber(today);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const detailsByActivityId = new Map(eventDetails.map((details) => [details.activityId, details]));

  const candidates = activities.flatMap((activity) => {
    if (activity.status !== 'upcoming') return [];
    const daysAway = dateKeyDayNumber(activity.date) - todayDay;
    if (daysAway < 0 || daysAway > horizonDays) return [];
    if (
      daysAway === 0 &&
      !activity.allDay &&
      activity.startMinutes + activity.durationMinutes <= currentMinutes
    ) {
      return [];
    }
    const details = detailsByActivityId.get(activity.id);
    if (details?.status === 'cancelled' || details?.status === 'completed') return [];
    const kind = excitementKind(activity, categoriesById.get(activity.categoryId), details);
    return kind ? [{ activity, daysAway, kind }] : [];
  });

  candidates.sort(
    (left, right) =>
      left.daysAway - right.daysAway ||
      left.activity.startMinutes - right.activity.startMinutes,
  );
  const next = candidates[0];
  if (!next) return undefined;
  const youtubeUrl = youtubeUpdatesUrl(next.activity.title, next.kind);
  return {
    ...next,
    eyebrow: eyebrow(next.daysAway, next.activity.allDay),
    headline: headline(next.kind, next.daysAway),
    message: message(next.activity.title, next.daysAway, Boolean(youtubeUrl)),
    youtubeUrl,
  };
}
