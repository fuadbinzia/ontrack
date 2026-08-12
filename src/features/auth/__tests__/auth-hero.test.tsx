import { render, screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { TAB_META } from '@/components/navigation/bottom-nav-tab-meta';
import { AuthHero } from '@/features/auth/auth-hero';
import { AgentUiIds } from '@/utils/agent-ui/ids';

const CONSTELLATION_TABS = [
  'social',
  'calendar',
  'travel',
  'workouts',
  'food',
  'health',
  'finance',
  'games',
  'to-do',
  'vision-board',
  'vehicles',
] as const;

describe('AuthHero', () => {
  afterEach(() => {
    jest.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('leads with the brand mark and the welcome headline', () => {
    render(<AuthHero variant="welcome" bleed={20} />);

    expect(screen.getByText('onTrack')).toBeTruthy();
    expect(screen.getByText('Your day, one place.')).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.auth.section.hero)).toBeTruthy();
  });

  it('orbits every feature the tab bar exposes', () => {
    render(<AuthHero variant="welcome" bleed={20} />);

    for (const tab of CONSTELLATION_TABS) {
      const label = TAB_META[tab]?.label;
      expect(label).toBeTruthy();
      expect(screen.getByText(label as string)).toBeTruthy();
    }
  });

  it('drops the theme toggle on the upgrade variant', () => {
    // A preferences write there would dirty guest data before a data-choice.
    render(<AuthHero variant="upgrade" bleed={20} />);

    expect(screen.getByText('Take onTrack with you.')).toBeTruthy();
    expect(screen.queryByTestId(AgentUiIds.auth.themeMode)).toBeNull();
  });

  it('still renders the full constellation with Reduce Motion on', () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    render(<AuthHero variant="welcome" bleed={20} />);

    expect(screen.getByText('Your day, one place.')).toBeTruthy();
    expect(screen.getByText('Calendar')).toBeTruthy();
    expect(screen.getByText('Vehicles')).toBeTruthy();
  });
});
