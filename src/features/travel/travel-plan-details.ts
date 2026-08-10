/** Shared create/edit trip field placeholders (new-trip + edit-trip). */
export const TRIP_TITLE_PLACEHOLDER = 'Fun in the Sun!';
export const TRIP_DESTINATION_PLACEHOLDER = 'Anywhere Sunny';
export const TRIP_NOTES_PLACEHOLDER = 'Ideas, budgets, must-dos…';

/** Drop stored cover uploads so live/placeholder destination art can resolve. */
export function stripTripCoverUploads<T extends { coverUri?: unknown; coverUris?: unknown }>(
  plan: T,
): Omit<T, 'coverUri' | 'coverUris'> {
  const { coverUri: _uri, coverUris: _uris, ...rest } = plan;
  return rest;
}

/** Attach uploaded covers, or omit keys when the strip is empty. */
export function tripCoverUploadFields(
  coverUris: string[],
): { coverUris: string[]; coverUri: string } | Record<string, never> {
  if (coverUris.length === 0) return {};
  return { coverUris, coverUri: coverUris[0]! };
}

export interface TravelPlanDetailsDraft {
  title: string;
  destination: string;
  notes: string;
}

export type TravelPlanDetailsResult =
  | {
      ok: true;
      value: {
        title: string;
        destination: string;
        notes?: string;
      };
    }
  | { ok: false; error: string };

export function validateTravelPlanDetails(
  draft: TravelPlanDetailsDraft,
): TravelPlanDetailsResult {
  const title = draft.title.trim();
  const destination = draft.destination.trim();
  if (!title || !destination) {
    return { ok: false, error: 'Add both a trip name and destination.' };
  }
  return {
    ok: true,
    value: {
      title,
      destination,
      notes: draft.notes.trim() || undefined,
    },
  };
}
