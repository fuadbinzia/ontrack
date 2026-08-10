import type { DetailSectionKey } from '@/features/travel/travel-plan-detail-sections';
import {
  expandTimelineEntries,
  timelineSectionKeyForDate,
} from '@/features/travel/travel-timeline-entries';
import type {
  TravelItemKind,
  TravelItineraryItem,
} from '@/features/travel/types';
import type { TravelPlanUiPrefs } from '@/store/travel-plan-ui';

export type RevealItineraryTarget = {
  itemId: string;
  date: string;
  kind: TravelItemKind;
};

/** Kind → transport subsection to open alongside Timeline. */
function transportSectionForKind(
  kind: TravelItemKind,
): DetailSectionKey | undefined {
  switch (kind) {
    case 'flight':
      return 'flights';
    case 'transport':
      return 'ground';
    case 'stay':
      return 'stays';
    case 'rental':
      return 'rentals';
    case 'event':
      return 'events';
    default:
      return undefined;
  }
}

/**
 * Plan-UI patch so a just-saved stop is visible: Timeline (+ kind board)
 * open, its day expanded, and its timeline entry keys not minimized.
 */
export function buildRevealItineraryUiPatch(input: {
  target: RevealItineraryTarget;
  sectionExpanded: Partial<Record<DetailSectionKey, boolean>>;
  minimizedItemIds: string[] | undefined;
  defaultMinimizedItemIds: readonly string[];
  collapsedDayDates: readonly string[];
  dayCollapseTouched: readonly string[];
  itinerary: readonly TravelItineraryItem[];
  planStartDate?: string;
  planEndDate?: string;
}): { patch: Partial<TravelPlanUiPrefs>; focusEntryKey: string } {
  const { target } = input;
  const entries = expandTimelineEntries(
    input.itinerary.filter((item) => item.id === target.itemId),
  );
  const focusEntryKey = entries[0]?.key ?? target.itemId;
  const entryKeys = new Set(
    entries.length ? entries.map((entry) => entry.key) : [target.itemId],
  );
  const sectionKey =
    input.planStartDate && input.planEndDate
      ? timelineSectionKeyForDate(
          target.date,
          input.planStartDate,
          input.planEndDate,
        )
      : target.date;

  // First toggle materializes the full minimized set. Until then, defaults
  // collapse every card — pin others closed so only the new stop opens.
  const existingMinimized = input.minimizedItemIds;
  const baseMinimized = existingMinimized
    ? [...existingMinimized]
    : [...input.defaultMinimizedItemIds];
  if (!existingMinimized) {
    for (const key of expandTimelineEntries([...input.itinerary]).map(
      (entry) => entry.key,
    )) {
      if (!entryKeys.has(key) && !baseMinimized.includes(key)) {
        baseMinimized.push(key);
      }
    }
  }
  const nextMinimized = baseMinimized.filter((key) => !entryKeys.has(key));

  const nextCollapsedDays = input.collapsedDayDates.filter(
    (date) => date !== sectionKey,
  );
  const nextTouched = input.dayCollapseTouched.includes(sectionKey)
    ? [...input.dayCollapseTouched]
    : [...input.dayCollapseTouched, sectionKey];

  const kindSection = transportSectionForKind(target.kind);
  const nextSections: Partial<Record<DetailSectionKey, boolean>> = {
    ...input.sectionExpanded,
    timeline: true,
  };
  if (kindSection) {
    nextSections.transport = true;
    nextSections[kindSection] = true;
  }

  return {
    focusEntryKey,
    patch: {
      sectionExpanded: nextSections,
      minimizedItemIds: nextMinimized,
      collapsedDayDates: nextCollapsedDays,
      dayCollapseTouched: nextTouched,
    },
  };
}

/** First newly added itinerary id (import / round-trip), else undefined. */
export function firstCreatedItineraryItem(
  before: readonly TravelItineraryItem[],
  after: readonly TravelItineraryItem[],
): TravelItineraryItem | undefined {
  const beforeIds = new Set(before.map((item) => item.id));
  return after.find((item) => !beforeIds.has(item.id));
}
