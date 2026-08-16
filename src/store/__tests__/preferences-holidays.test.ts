import { act } from '@testing-library/react-native';

import { domains } from '@/services/cloud/sync-domains';
import { usePreferences } from '@/store/preferences';

const preferences = domains.find((domain) => domain.name === 'preferences');

describe('showHolidays preference', () => {
  beforeEach(() => {
    act(() => {
      usePreferences.getState().resetAll();
    });
  });

  it('defaults on and restores after reset', () => {
    expect(usePreferences.getState().showHolidays).toBe(true);
    act(() => {
      usePreferences.getState().setShowHolidays(false);
    });
    expect(usePreferences.getState().showHolidays).toBe(false);
    act(() => {
      usePreferences.getState().resetAll();
    });
    expect(usePreferences.getState().showHolidays).toBe(true);
  });

  it('round-trips through cloud preferences and defaults on for older payloads', () => {
    if (!preferences) throw new Error('missing preferences domain');
    act(() => {
      usePreferences.getState().setShowHolidays(false);
    });
    const payload = preferences.read();
    expect(payload.showHolidays).toBe(false);

    act(() => {
      usePreferences.getState().resetAll();
      preferences.write(payload);
    });
    expect(usePreferences.getState().showHolidays).toBe(false);

    act(() => {
      preferences.write({
        hasOnboarded: true,
        name: 'Alex Rivera',
        goal: 'Stay on track',
      });
    });
    expect(usePreferences.getState().showHolidays).toBe(true);
  });
});
