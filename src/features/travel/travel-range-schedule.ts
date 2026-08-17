import type { TravelItineraryItem } from '@/features/travel/types';
import { isDateKey, minutesBetween } from '@/utils/date';

export interface TravelRangeScheduleDraft {
  startDate: string;
  startMinutes: number | null;
  endDate: string;
  endMinutes: number | null;
}

function validMinutes(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value < 24 * 60;
}

export function travelRangeScheduleDraft(
  item: TravelItineraryItem,
  endDate: string | undefined,
  endMinutes: number | undefined,
): TravelRangeScheduleDraft {
  return {
    startDate: item.date,
    startMinutes: item.startMinutes,
    endDate: endDate ?? item.date,
    endMinutes: endMinutes ?? item.startMinutes,
  };
}

export function validateTravelRangeSchedule(
  draft: TravelRangeScheduleDraft,
  labels: { start: string; end: string },
):
  | { ok: true; value: { date: string; startMinutes: number } }
  | { ok: false; error: string } {
  if (!isDateKey(draft.startDate)) {
    return { ok: false, error: `Choose a valid ${labels.start} date.` };
  }
  if (!validMinutes(draft.startMinutes)) {
    return { ok: false, error: `Choose a valid ${labels.start} time.` };
  }
  if (!isDateKey(draft.endDate)) {
    return { ok: false, error: `Choose a valid ${labels.end} date.` };
  }
  if (!validMinutes(draft.endMinutes)) {
    return { ok: false, error: `Choose a valid ${labels.end} time.` };
  }
  const duration = minutesBetween(
    draft.startDate,
    draft.startMinutes,
    draft.endDate,
    draft.endMinutes,
  );
  if (!Number.isFinite(duration) || duration <= 0) {
    return {
      ok: false,
      error: `${labels.end[0].toUpperCase()}${labels.end.slice(1)} needs to be after ${labels.start}.`,
    };
  }
  return {
    ok: true,
    value: { date: draft.startDate, startMinutes: draft.startMinutes },
  };
}
