import { act, renderHook, waitFor } from '@testing-library/react-native';

import { emptyThemeOverrides } from '@/design-system/theme-overrides';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { useThemeOverrides } from '@/store/theme-overrides';

describe('useTheme preset brightness', () => {
  beforeEach(async () => {
    await act(async () => {
      usePreferences.setState({ themePreference: 'light' });
      useThemeOverrides.setState({
        overrides: emptyThemeOverrides(),
        presetId: 'classic',
        history: [],
      });
    });
  });

  it('switches the whole selected preset palette when brightness changes', async () => {
    await act(async () => useThemeOverrides.getState().applyPreset('coast'));
    const { result } = renderHook(() => useTheme());

    expect(result.current).toMatchObject({
      name: 'light',
      backgroundPrimary: '#EAF3F5',
      backgroundElevated: '#F8FCFC',
      textPrimary: '#132D35',
      accentPrimary: '#18758A',
    });

    await act(async () => usePreferences.getState().setThemePreference('dark'));

    await waitFor(() =>
      expect(result.current).toMatchObject({
        name: 'dark',
        backgroundPrimary: '#081A20',
        backgroundElevated: '#14323A',
        textPrimary: '#F2FAFB',
        accentPrimary: '#63C4D5',
      }),
    );
  });

  it('keeps custom palettes stable when brightness changes', async () => {
    await act(async () => {
      useThemeOverrides.getState().setToken('default', 'accentPrimary', '#123456');
    });
    const { result } = renderHook(() => useTheme());

    expect(result.current.accentPrimary).toBe('#123456');
    await act(async () => usePreferences.getState().setThemePreference('dark'));
    await waitFor(() => {
      expect(result.current.accentPrimary).toBe('#123456');
      expect(result.current.name).toBe('dark');
    });
  });
});
