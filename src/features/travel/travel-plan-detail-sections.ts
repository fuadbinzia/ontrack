export type DetailSectionKey =
  | 'transport'
  | 'flights'
  | 'ground'
  | 'stays'
  | 'rentals'
  | 'events'
  | 'timeline';

/**
 * First-visit defaults for plan-detail accordion sections.
 * Persisted `sectionExpanded` in `travel-plan-ui` always wins once the user toggles.
 *
 * Match the intended first paint: Transport + Timeline open; nested transport
 * kinds collapsed until the user opens them.
 */
export function sectionDefaultExpanded(
  key: DetailSectionKey,
  counts: {
    flights: number;
    ground: number;
    stays: number;
    rentals: number;
    events: number;
  },
): boolean {
  switch (key) {
    case 'transport':
      return (
        counts.flights +
          counts.ground +
          counts.stays +
          counts.rentals +
          counts.events >
        0
      );
    case 'flights':
    case 'ground':
    case 'stays':
    case 'rentals':
    case 'events':
      return false;
    case 'timeline':
      return true;
  }
}
