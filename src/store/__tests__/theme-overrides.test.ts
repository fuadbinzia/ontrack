import { act } from '@testing-library/react-native';

import { emptyFontOverrides } from '@/design-system/font-presets';
import { emptyThemeOverrides } from '@/design-system/theme-overrides';
import { usePreferences } from '@/store/preferences';
import { useThemeOverrides } from '@/store/theme-overrides';

describe('useThemeOverrides store', () => {
  beforeEach(() => {
    act(() => {
      usePreferences.setState({ name: 'Rocky' });
      useThemeOverrides.setState({
        overrides: emptyThemeOverrides(),
        presetId: 'classic',
        fonts: emptyFontOverrides(),
        history: [],
      });
    });
  });

  it('sets, clears, and resets scoped tokens', () => {
    expect(useThemeOverrides.getState().setToken('travel', 'accentPrimary', '#2474a8')).toBe(true);
    expect(useThemeOverrides.getState().overrides.travel.accentPrimary).toBe('#2474A8');

    expect(useThemeOverrides.getState().setToken('travel', 'accentPrimary', 'nope')).toBe(false);
    expect(useThemeOverrides.getState().overrides.travel.accentPrimary).toBe('#2474A8');

    act(() => {
      useThemeOverrides.getState().clearToken('travel', 'accentPrimary');
    });
    expect(useThemeOverrides.getState().overrides.travel.accentPrimary).toBeUndefined();

    act(() => {
      useThemeOverrides.getState().setToken('default', 'danger', '#B04A3F');
      useThemeOverrides.getState().setToken('plants', 'accentSoft', '#5F9470');
      useThemeOverrides.getState().resetScope('default');
    });
    expect(useThemeOverrides.getState().overrides.default).toEqual({});
    expect(useThemeOverrides.getState().overrides.plants.accentSoft).toBe('#5F9470');

    act(() => {
      useThemeOverrides.getState().resetAll();
    });
    expect(useThemeOverrides.getState().overrides).toEqual(emptyThemeOverrides());
  });

  it('records change history with actor and timestamps', () => {
    act(() => {
      useThemeOverrides.getState().setToken('default', 'accentPrimary', '#2474A8');
      useThemeOverrides.getState().clearToken('default', 'accentPrimary');
      useThemeOverrides.getState().setToken('travel', 'accentSoft', '#4D96C5');
      useThemeOverrides.getState().resetAll();
    });

    const history = useThemeOverrides.getState().history;
    expect(history).toHaveLength(4);
    expect(history[0]?.action).toBe('resetAll');
    expect(history[0]?.summary).toContain('Restored all theme defaults');
    expect(history[0]?.by).toBe('Rocky');
    expect(history[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(history[1]?.action).toBe('set');
    expect(history[2]?.action).toBe('clear');
    expect(history[3]?.to).toBe('#2474A8');
    expect(history[3]?.from).toBeNull();

    act(() => {
      useThemeOverrides.getState().clearHistory();
    });
    expect(useThemeOverrides.getState().history).toEqual([]);
  });

  it('applies a full preset atomically and marks later edits custom', () => {
    act(() => {
      useThemeOverrides.getState().applyPreset('coast');
    });
    expect(useThemeOverrides.getState().presetId).toBe('coast');
    expect(useThemeOverrides.getState().overrides.default).toEqual({});
    expect(useThemeOverrides.getState().overrides.travel).toEqual({});
    expect(useThemeOverrides.getState().history[0]?.action).toBe('applyPreset');

    act(() => {
      useThemeOverrides.getState().setToken('default', 'accentPrimary', '#123456', {
        backgroundPrimary: '#081A20',
        accentPrimary: '#63C4D5',
      });
    });
    expect(useThemeOverrides.getState().presetId).toBe('custom');
    expect(useThemeOverrides.getState().overrides.default).toMatchObject({
      backgroundPrimary: '#081A20',
      accentPrimary: '#123456',
    });
  });

  it('sets and restores fonts with history', () => {
    expect(useThemeOverrides.getState().setFont('ui', 'georgia')).toBe(true);
    expect(useThemeOverrides.getState().fonts.ui).toBe('georgia');
    expect(useThemeOverrides.getState().setFont('ui', 'not-a-font')).toBe(false);

    act(() => {
      useThemeOverrides.getState().setFont('ui', 'system-serif');
    });
    expect(useThemeOverrides.getState().fonts.ui).toBeNull();

    act(() => {
      useThemeOverrides.getState().setFont('mono', 'menlo');
      useThemeOverrides.getState().resetFonts();
    });
    expect(useThemeOverrides.getState().fonts).toEqual(emptyFontOverrides());
    expect(useThemeOverrides.getState().history[0]?.action).toBe('resetFonts');
  });
});
