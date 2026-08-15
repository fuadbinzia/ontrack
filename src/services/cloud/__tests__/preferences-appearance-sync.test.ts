import { act } from '@testing-library/react-native';

import { emptyFontOverrides } from '@/design-system/font-presets';
import { emptyThemeOverrides } from '@/design-system/theme-overrides';
import { domains } from '@/services/cloud/sync-domains';
import { usePreferences } from '@/store/preferences';
import { useThemeOverrides } from '@/store/theme-overrides';

const preferences = domains.find((domain) => domain.name === 'preferences');

function resetAppearance() {
  act(() => {
    usePreferences.setState({
      hasOnboarded: true,
      name: 'Alex Rivera',
      goal: 'Stay on track',
      themePreference: 'system',
    });
    useThemeOverrides.setState({
      overrides: emptyThemeOverrides(),
      presetId: 'classic',
      fonts: emptyFontOverrides(),
      history: [],
    });
  });
}

describe('preferences domain appearance', () => {
  beforeEach(() => {
    resetAppearance();
  });

  it('round-trips light/dark and a theme preset through cloud restore', () => {
    if (!preferences) throw new Error('missing preferences domain');
    act(() => {
      usePreferences.setState({ themePreference: 'dark' });
      useThemeOverrides.getState().applyPreset('coast');
    });

    const payload = preferences.read();
    expect(payload.themePreference).toBe('dark');
    expect(payload.themePresetId).toBe('coast');

    act(() => {
      usePreferences.getState().resetAll();
      useThemeOverrides.getState().resetAll();
    });
    expect(usePreferences.getState().themePreference).toBe('system');
    expect(useThemeOverrides.getState().presetId).toBe('classic');

    act(() => {
      preferences.write(payload);
    });
    expect(usePreferences.getState().themePreference).toBe('dark');
    expect(useThemeOverrides.getState().presetId).toBe('coast');
  });

  it('keeps the local theme when an older preferences payload omits appearance', () => {
    if (!preferences) throw new Error('missing preferences domain');
    act(() => {
      usePreferences.setState({ themePreference: 'light' });
      useThemeOverrides.getState().applyPreset('berry');
    });

    act(() => {
      preferences.write({
        hasOnboarded: true,
        name: 'Alex Rivera',
        goal: 'Stay on track',
      });
    });

    expect(usePreferences.getState().themePreference).toBe('light');
    expect(useThemeOverrides.getState().presetId).toBe('berry');
    expect(usePreferences.getState().name).toBe('Alex Rivera');
  });
});
