import { darkTravelTheme, lightTravelTheme } from '@/design-system';
import { travelItineraryShellProps } from '@/features/travel/travel-surface';

describe('travelItineraryShellProps', () => {
  it('defaults to airy frost', () => {
    expect(travelItineraryShellProps(lightTravelTheme)).toEqual({
      airy: true,
      intensity: 48,
    });
    expect(travelItineraryShellProps(darkTravelTheme)).toEqual({
      airy: true,
      intensity: 40,
    });
  });

  it('densifies frost when a flight card stacks under hero chrome', () => {
    expect(travelItineraryShellProps(lightTravelTheme, undefined, { dense: true })).toEqual({
      airy: false,
      intensity: 72,
    });
    expect(
      travelItineraryShellProps(darkTravelTheme, '#1E3A42', { dense: true }),
    ).toEqual({
      airy: false,
      intensity: 64,
      tintColor: '#1E3A42',
    });
  });
});
