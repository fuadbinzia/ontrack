import type { AppIconName } from '@/design-system';
import { daysUntilDate } from '@/features/travel/date-range';
import { kindIcon } from '@/features/travel/travel-kind-chrome';
import { transportModeIcon } from '@/features/travel/travel-mode';
import {
    expandTimelineEntries,
    groupTimelineEntriesByDate,
    TIMELINE_POST_TRIP_KEY,
    TIMELINE_PRE_TRIP_KEY,
    type TravelTimelineEntry,
} from '@/features/travel/travel-timeline-entries';
import type { TravelItemKind, TravelItineraryItem } from '@/features/travel/types';
import { addDays, fromDateKey, toDateKey } from '@/utils/date';

export type TimelineDayPhase = 'past' | 'current' | 'upcoming';

export type TimelineTripPhase = 'upcoming' | 'in_progress' | 'complete';

export type TimelineProgressSummary = {
  tripPhase: TimelineTripPhase;
  /** Short chrome label for the timeline header strip. */
  label: string;
  completedDays: number;
  totalDays: number;
  /** 0–1 journey progress across trip days. */
  progress: number;
  currentDayNumber?: number;
};

/** Fun “tiny traveler” beat for the progress track chip. */
export type JourneyTravelerBeat =
  | 'planning'
  | 'packing'
  | 'heading_out'
  | 'transport'
  | 'flight'
  | 'stay'
  | 'rental'
  | 'activity'
  | 'event'
  | 'moment'
  | 'complete';

export type JourneyTraveler = {
  beat: JourneyTravelerBeat;
  icon: AppIconName;
  /** 0–1 position of the chip on the track. */
  progress: number;
  accessibilityLabel: string;
};

/** Countdown window (days) mapped into the pre-trip progress band. */
const PRETRIP_WINDOW_DAYS = 30;
/** Max track fill before Day 1 so the traveler can creep while upcoming. */
const PRETRIP_PROGRESS_CAP = 0.18;

const BEAT_LABEL: Record<JourneyTravelerBeat, string> = {
  planning: 'Planning',
  packing: 'Packing',
  heading_out: 'Heading out',
  transport: 'Transport',
  flight: 'Flight',
  stay: 'Stay',
  rental: 'Rental',
  activity: 'Activity',
  event: 'Event',
  moment: 'Moment',
  complete: 'Trip complete',
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function beatFromKind(kind: TravelItemKind): Exclude<
  JourneyTravelerBeat,
  'planning' | 'packing' | 'heading_out' | 'complete'
> {
  switch (kind) {
    case 'flight':
      return 'flight';
    case 'transport':
      return 'transport';
    case 'stay':
      return 'stay';
    case 'rental':
      return 'rental';
    case 'moment':
      return 'moment';
    case 'event':
      return 'event';
    case 'activity':
    default:
      return 'activity';
  }
}

function iconForEntry(entry: Pick<TravelTimelineEntry, 'item'>): AppIconName {
  if (entry.item.kind === 'transport') {
    return transportModeIcon(entry.item.transport?.mode ?? 'other');
  }
  return kindIcon(entry.item.kind);
}

function travelerFromEntry(
  entry: Pick<TravelTimelineEntry, 'item'>,
  progress: number,
  beatOverride?: JourneyTravelerBeat,
): JourneyTraveler {
  const beat = beatOverride ?? beatFromKind(entry.item.kind);
  return {
    beat,
    icon: iconForEntry(entry),
    progress: clamp01(progress),
    accessibilityLabel: BEAT_LABEL[beat],
  };
}

function pretripProgress(daysUntil: number): number {
  return clamp01((PRETRIP_WINDOW_DAYS - daysUntil) / PRETRIP_WINDOW_DAYS) * PRETRIP_PROGRESS_CAP;
}

/**
 * Active / next stop for the traveler chip during the trip.
 * Prefer the next upcoming entry (so the gap after landing points at check-in);
 * fall back to the last started entry when nothing remains.
 */
export function activeTimelineEntry(
  entries: readonly TravelTimelineEntry[],
  now: Date = new Date(),
): TravelTimelineEntry | undefined {
  if (entries.length === 0) return undefined;
  const next = entries.find((entry) => !isTimelineEntryPast(entry, now));
  if (next) return next;
  return entries[entries.length - 1];
}

/**
 * Resolve the tiny traveler beat/icon/position from countdown + itinerary.
 * Day-done meta stays on {@link summarizeTimelineProgress}; this drives the fun chip.
 */
export function resolveJourneyTraveler(options: {
  planStartDate: string;
  planEndDate: string;
  days: readonly { date: string; entries: readonly TravelTimelineEntry[] }[];
  summary?: TimelineProgressSummary;
  now?: Date;
}): JourneyTraveler {
  const now = options.now ?? new Date();
  const summary =
    options.summary ??
    summarizeTimelineProgress({
      planStartDate: options.planStartDate,
      planEndDate: options.planEndDate,
      days: options.days,
      now,
    });
  const flatEntries = options.days.flatMap((day) => day.entries);

  if (summary.tripPhase === 'complete') {
    return {
      beat: 'complete',
      icon: 'suitcase',
      progress: 1,
      accessibilityLabel: `${BEAT_LABEL.complete} · ${summary.label}`,
    };
  }

  if (summary.tripPhase === 'upcoming') {
    const until = daysUntilDate(options.planStartDate, now);
    const progress = pretripProgress(until);
    const first = flatEntries[0];

    if (until <= 1) {
      if (first) {
        const traveler = travelerFromEntry(first, progress, 'heading_out');
        return {
          ...traveler,
          accessibilityLabel: `${BEAT_LABEL.heading_out} · ${summary.label}`,
        };
      }
      return {
        beat: 'heading_out',
        icon: 'suitcase',
        progress,
        accessibilityLabel: `${BEAT_LABEL.heading_out} · ${summary.label}`,
      };
    }

    if (until <= 14) {
      return {
        beat: 'packing',
        icon: 'suitcase',
        progress,
        accessibilityLabel: `${BEAT_LABEL.packing} · ${summary.label}`,
      };
    }

    return {
      beat: 'planning',
      icon: 'calendar',
      progress,
      accessibilityLabel: `${BEAT_LABEL.planning} · ${summary.label}`,
    };
  }

  // In progress: day fill + small within-day nudge from the active/next stop.
  const totalDays = Math.max(1, summary.totalDays);
  const base = summary.completedDays / totalDays;
  const active = activeTimelineEntry(flatEntries, now);
  let progress = base;
  if (active) {
    const day = options.days.find((entry) => entry.date === active.date);
    const dayEntries = day?.entries ?? [active];
    const index = Math.max(
      0,
      dayEntries.findIndex((entry) => entry.key === active.key),
    );
    const daySpan = 1 / totalDays;
    const nudge =
      dayEntries.length <= 1
        ? daySpan * 0.35
        : daySpan * ((index + 0.5) / dayEntries.length);
    progress = clamp01(base + nudge);
  } else {
    progress = clamp01(base);
  }

  if (!active) {
    return {
      beat: 'activity',
      icon: 'location',
      progress,
      accessibilityLabel: `${summary.label}`,
    };
  }

  const traveler = travelerFromEntry(active, progress);
  return {
    ...traveler,
    accessibilityLabel: `${BEAT_LABEL[traveler.beat]} · ${summary.label}`,
  };
}

function minutesFromMidnight(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function isTimelineEntryPast(
  entry: Pick<TravelTimelineEntry, 'date' | 'startMinutes'>,
  now: Date = new Date(),
): boolean {
  const today = toDateKey(now);
  if (entry.date < today) return true;
  if (entry.date > today) return false;
  return entry.startMinutes <= minutesFromMidnight(now);
}

export function timelineDayPhase(
  date: string,
  entries: readonly Pick<TravelTimelineEntry, 'startMinutes' | 'date'>[],
  now: Date = new Date(),
): TimelineDayPhase {
  const today = toDateKey(now);
  // Pre-trip / Post trip buckets use synthetic keys — phase from real entry dates.
  if (date === TIMELINE_PRE_TRIP_KEY || date === TIMELINE_POST_TRIP_KEY) {
    return timelineEntriesPhase(entries, now);
  }
  if (date < today) return 'past';
  if (date > today) return 'upcoming';
  if (entries.length === 0) return 'current';
  const nowMinutes = minutesFromMidnight(now);
  return entries.every((entry) => entry.startMinutes <= nowMinutes)
    ? 'past'
    : 'current';
}

/** Phase for a multi-date bucket (Pre-trip / Post trip). */
export function timelineEntriesPhase(
  entries: readonly Pick<TravelTimelineEntry, 'startMinutes' | 'date'>[],
  now: Date = new Date(),
): TimelineDayPhase {
  if (!entries.length) return 'upcoming';
  const today = toDateKey(now);
  const withDates = entries.map((entry) => ({
    date: entry.date,
    startMinutes: entry.startMinutes,
  }));
  if (withDates.every((entry) => entry.date < today)) return 'past';
  if (withDates.every((entry) => entry.date > today)) return 'upcoming';
  const todayEntries = withDates.filter((entry) => entry.date === today);
  if (!todayEntries.length) return 'current';
  const nowMinutes = minutesFromMidnight(now);
  const todayDone = todayEntries.every((entry) => entry.startMinutes <= nowMinutes);
  const hasFuture = withDates.some((entry) => entry.date > today);
  if (todayDone && !hasFuture) return 'past';
  return 'current';
}

/**
 * First-visit / untouched default: every timeline day starts collapsed.
 * `now` kept for call-site stability; phase no longer drives auto-collapse.
 */
export function autoCollapsedTimelineDates(
  days: readonly {
    date: string;
    entries: readonly Pick<TravelTimelineEntry, 'startMinutes' | 'date'>[];
  }[],
  _now: Date = new Date(),
): Set<string> {
  return new Set(days.map((day) => day.date));
}

/**
 * Merge default collapse with user toggles.
 * Untouched days follow `autoCollapsed`; touched days keep the user's choice.
 */
export function resolveCollapsedTimelineDates(options: {
  days: readonly { date: string }[];
  autoCollapsed: ReadonlySet<string>;
  currentCollapsed: ReadonlySet<string>;
  userTouched: ReadonlySet<string>;
}): Set<string> {
  const next = new Set<string>();
  for (const day of options.days) {
    if (options.userTouched.has(day.date)) {
      if (options.currentCollapsed.has(day.date)) next.add(day.date);
      continue;
    }
    if (options.autoCollapsed.has(day.date)) next.add(day.date);
  }
  return next;
}

export function summarizeTimelineProgress(options: {
  planStartDate: string;
  planEndDate: string;
  days: readonly {
    date: string;
    entries: readonly Pick<TravelTimelineEntry, 'startMinutes' | 'date'>[];
  }[];
  now?: Date;
}): TimelineProgressSummary {
  const now = options.now ?? new Date();
  // Progress “Day N of M” counts trip days only — Pre-trip / Post trip are extras.
  const tripDays = options.days.filter(
    (day) =>
      day.date !== TIMELINE_PRE_TRIP_KEY && day.date !== TIMELINE_POST_TRIP_KEY,
  );
  const daysForProgress = tripDays.length ? tripDays : options.days;
  const totalDays = Math.max(1, daysForProgress.length);
  const phases = daysForProgress.map((day) =>
    timelineDayPhase(day.date, day.entries, now),
  );
  const completedDays = phases.filter((phase) => phase === 'past').length;
  const currentIndex = phases.findIndex((phase) => phase === 'current');
  const allPast = completedDays === totalDays && totalDays > 0;
  const allUpcoming = completedDays === 0 && currentIndex < 0;

  let tripPhase: TimelineTripPhase = 'in_progress';
  let label: string;
  let currentDayNumber: number | undefined;

  if (allPast || toDateKey(now) > options.planEndDate) {
    tripPhase = 'complete';
    label = 'Trip complete';
  } else if (allUpcoming || toDateKey(now) < options.planStartDate) {
    tripPhase = 'upcoming';
    const until = daysUntilDate(options.planStartDate, now);
    label =
      until <= 0
        ? 'Starts today'
        : until === 1
          ? 'Starts tomorrow'
          : `Starts in ${until} days`;
  } else {
    tripPhase = 'in_progress';
    const dayNumber =
      currentIndex >= 0
        ? currentIndex + 1
        : Math.min(completedDays + 1, totalDays);
    currentDayNumber = dayNumber;
    label = `Day ${dayNumber} of ${totalDays}`;
  }

  const progress =
    tripPhase === 'complete'
      ? 1
      : tripPhase === 'upcoming'
        ? 0
        : Math.min(1, Math.max(0, completedDays / totalDays));

  return {
    tripPhase,
    label,
    completedDays,
    totalDays,
    progress,
    currentDayNumber,
  };
}

export function timelineDaysFromItems(items: TravelItineraryItem[]) {
  return groupTimelineEntriesByDate(expandTimelineEntries(items));
}

/** Next calendar tip for tests / clocks near day boundaries. */
export function timelineClockSample(dateKey: string, startMinutes: number): Date {
  const date = fromDateKey(dateKey);
  date.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
  return date;
}

export function shiftDateKey(dateKey: string, days: number): string {
  return addDays(dateKey, days);
}
