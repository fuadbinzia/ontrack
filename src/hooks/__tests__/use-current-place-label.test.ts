import { detailForCurrentPlace } from '@/hooks/use-current-place-label';

// Re-export path exercises the same status → detail mapping used by Profile.

describe('current place detail labels', () => {
  it('maps statuses to settings detail copy', () => {
    expect(detailForCurrentPlace('suggested', 'Austin, TX')).toBe('Austin, TX');
    expect(detailForCurrentPlace('loading', '')).toBe('Locating…');
    expect(detailForCurrentPlace('denied', '')).toBe('Location permission off');
    expect(detailForCurrentPlace('unavailable', '')).toBe('Unavailable');
    expect(detailForCurrentPlace('idle', '')).toBe('—');
  });
});
