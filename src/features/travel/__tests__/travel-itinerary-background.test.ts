import { itineraryJourneyWashColors } from '@/features/travel/travel-itinerary-background';

function washAlpha(color: string): number {
  const match = color.match(/,\s*([0-9.]+)\)$/);
  return match ? Number(match[1]) : Number.NaN;
}

describe('itineraryJourneyWashColors', () => {
  it('keeps the iOS light wash thin so BlurView frost can show the atlas', () => {
    const wash = itineraryJourneyWashColors({ dark: false, android: false });
    expect(wash).toEqual([
      'rgba(245,251,250,0.26)',
      'rgba(248,251,250,0.10)',
      'rgba(238,248,246,0.22)',
    ]);
  });

  it('densifies the Android light wash so watercolor does not punch through cards', () => {
    const ios = itineraryJourneyWashColors({ dark: false, android: false });
    const android = itineraryJourneyWashColors({ dark: false, android: true });
    expect(android[1]).toBe('rgba(248,251,250,0.44)');
    expect(washAlpha(android[1])).toBeGreaterThan(washAlpha(ios[1]));
    expect(washAlpha(android[0])).toBeGreaterThan(0.5);
    expect(washAlpha(android[2])).toBeGreaterThan(0.5);
  });

  it('densifies the Android night wash without going fully opaque', () => {
    const ios = itineraryJourneyWashColors({ dark: true, android: false });
    const android = itineraryJourneyWashColors({ dark: true, android: true });
    expect(washAlpha(android[1])).toBeGreaterThan(washAlpha(ios[1]));
    expect(android.every((stop) => washAlpha(stop) < 1)).toBe(true);
  });
});
