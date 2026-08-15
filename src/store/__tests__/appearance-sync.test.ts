import { act } from '@testing-library/react-native';

import { emptyFontOverrides } from '@/design-system/font-presets';
import { emptyThemeOverrides } from '@/design-system/theme-overrides';
import {
  appearanceSyncFields,
  applyAppearancePayload,
  parseThemePreference,
  restoreAppearance,
  snapshotAppearance,
} from '@/store/appearance-sync';
import { usePreferences } from '@/store/preferences';
import { useThemeOverrides } from '@/store/theme-overrides';

function resetAppearance() {
  act(() => {
    usePreferences.setState({ themePreference: 'system', hasOnboarded: false });
    useThemeOverrides.setState({
      overrides: emptyThemeOverrides(),
      presetId: 'classic',
      fonts: emptyFontOverrides(),
      history: [],
    });
  });
}

describe('appearance sync', () => {
  beforeEach(() => {
    resetAppearance();
  });

  it('parses only explicit theme preference values', () => {
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference(undefined)).toBeUndefined();
    expect(parseThemePreference('midnight')).toBeUndefined();
  });

  it('keeps the chosen theme after a local account wipe snapshot/restore', () => {
    act(() => {
      usePreferences.setState({ themePreference: 'dark', hasOnboarded: true });
      useThemeOverrides.getState().applyPreset('coast');
      useThemeOverrides.getState().setFont('ui', 'georgia');
    });

    const snapshot = snapshotAppearance();
    expect(snapshot).toMatchObject({
      themePreference: 'dark',
      presetId: 'coast',
      fonts: { ui: 'georgia' },
    });

    act(() => {
      usePreferences.getState().resetAll();
      useThemeOverrides.getState().resetAll();
      useThemeOverrides.getState().clearHistory();
    });
    expect(usePreferences.getState().themePreference).toBe('system');
    expect(useThemeOverrides.getState().presetId).toBe('classic');

    act(() => {
      restoreAppearance(snapshot, { hasOnboarded: true });
    });
    expect(usePreferences.getState().themePreference).toBe('dark');
    expect(usePreferences.getState().hasOnboarded).toBe(true);
    expect(useThemeOverrides.getState().presetId).toBe('coast');
    expect(useThemeOverrides.getState().fonts.ui).toBe('georgia');
  });

  it('restores appearance from a cloud payload after sign-out wipe', () => {
    act(() => {
      usePreferences.setState({ themePreference: 'dark' });
      useThemeOverrides.getState().applyPreset('ember');
    });
    const payload = appearanceSyncFields(snapshotAppearance());

    act(() => {
      usePreferences.getState().resetAll();
      useThemeOverrides.getState().resetAll();
    });
    expect(usePreferences.getState().themePreference).toBe('system');
    expect(useThemeOverrides.getState().presetId).toBe('classic');

    act(() => {
      applyAppearancePayload(payload, snapshotAppearance());
    });
    expect(usePreferences.getState().themePreference).toBe('dark');
    expect(useThemeOverrides.getState().presetId).toBe('ember');
  });

  it('does not force system when an older cloud payload omits theme fields', () => {
    act(() => {
      usePreferences.setState({ themePreference: 'light' });
      useThemeOverrides.getState().applyPreset('midnight');
    });
    const local = snapshotAppearance();

    act(() => {
      applyAppearancePayload({ name: 'Alex Rivera', goal: 'Stay on track' }, local);
    });

    expect(usePreferences.getState().themePreference).toBe('light');
    expect(useThemeOverrides.getState().presetId).toBe('midnight');
  });

  it('applies an explicit system preference from cloud', () => {
    act(() => {
      usePreferences.setState({ themePreference: 'dark' });
      useThemeOverrides.getState().applyPreset('garden');
    });

    act(() => {
      applyAppearancePayload(
        { themePreference: 'system', themePresetId: 'classic' },
        snapshotAppearance(),
      );
    });

    expect(usePreferences.getState().themePreference).toBe('system');
    expect(useThemeOverrides.getState().presetId).toBe('classic');
  });
});
