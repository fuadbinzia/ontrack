import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeModeToggle } from '@/features/auth/theme-mode-toggle';
import { usePreferences } from '@/store/preferences';
import { AgentUiIds } from '@/utils/agent-ui/ids';

describe('ThemeModeToggle', () => {
  beforeEach(() => {
    usePreferences.setState({ themePreference: 'system' });
  });

  it('picks an explicit mode opposite the one currently showing', () => {
    render(<ThemeModeToggle />);
    fireEvent.press(screen.getByTestId(AgentUiIds.auth.themeMode));
    expect(usePreferences.getState().themePreference).toBe('dark');

    fireEvent.press(screen.getByTestId(AgentUiIds.auth.themeMode));
    expect(usePreferences.getState().themePreference).toBe('light');
  });

  it('labels the destination mode for screen readers', () => {
    render(<ThemeModeToggle />);
    expect(screen.getByLabelText('Switch to dark mode')).toBeTruthy();
  });
});
