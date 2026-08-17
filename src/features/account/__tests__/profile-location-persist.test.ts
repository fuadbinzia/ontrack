import { getDestinationCurrentWeather } from '@/features/travel/weather/provider';

import { persistPlaceLabel } from '../profile-location-persist';

jest.mock('@/features/travel/weather/provider', () => ({
  getDestinationCurrentWeather: jest.fn(),
}));

jest.mock('@/utils/haptics', () => ({
  haptics: { tap: jest.fn(), success: jest.fn() },
}));

const weatherMock = getDestinationCurrentWeather as jest.MockedFunction<
  typeof getDestinationCurrentWeather
>;

function harness(saved = '') {
  let stored = saved;
  const commit = jest.fn((value: string) => {
    stored = value;
  });
  return {
    commit,
    setError: jest.fn(),
    setSaving: jest.fn(),
    genRef: { current: 0 },
    unit: 'fahrenheit' as const,
    getSaved: () => stored,
    get stored() {
      return stored;
    },
  };
}

function weather(locationLabel: string) {
  return {
    locationLabel,
    latitude: 0,
    longitude: 0,
    temperature: 70,
    temperatureUnit: 'fahrenheit' as const,
    weatherCode: 0,
    condition: 'Clear',
    symbol: '☀️',
  };
}

describe('persisting a profile place', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves a device place verbatim instead of re-geocoding it to another state', async () => {
    weatherMock.mockResolvedValue(weather('Union, California, United States'));
    const state = harness();

    await persistPlaceLabel({ ...state, raw: 'Union, New Jersey', skipNormalize: true });

    expect(state.stored).toBe('Union, New Jersey');
    expect(state.commit).toHaveBeenCalledTimes(1);
    expect(weatherMock).not.toHaveBeenCalled();
    expect(state.setSaving).not.toHaveBeenCalled();
  });

  it('normalizes a typed place through the weather geocoder', async () => {
    weatherMock.mockResolvedValue(weather('Union, New Jersey, United States'));
    const state = harness();

    await persistPlaceLabel({ ...state, raw: 'union nj' });

    expect(state.commit).toHaveBeenNthCalledWith(1, 'union nj');
    expect(state.stored).toBe('Union, New Jersey, United States');
    expect(state.setSaving).toHaveBeenLastCalledWith(false);
  });

  it('keeps the typed place when the weather lookup fails', async () => {
    weatherMock.mockRejectedValue(new Error('offline'));
    const state = harness();

    await persistPlaceLabel({ ...state, raw: 'Union, New Jersey' });

    expect(state.stored).toBe('Union, New Jersey');
  });

  it('clears the place without a lookup when the field is emptied', async () => {
    const state = harness('Union, New Jersey');

    await persistPlaceLabel({ ...state, raw: '   ' });

    expect(state.stored).toBe('');
    expect(weatherMock).not.toHaveBeenCalled();
  });

  it('does nothing but report unchanged when the place is already saved', async () => {
    const state = harness('Union, New Jersey');
    const onUnchanged = jest.fn();

    await persistPlaceLabel({ ...state, raw: ' Union, New Jersey ', onUnchanged });

    expect(state.commit).not.toHaveBeenCalled();
    expect(onUnchanged).toHaveBeenCalledWith('Union, New Jersey', 'Union, New Jersey');
    expect(weatherMock).not.toHaveBeenCalled();
  });

  it('ignores a stale normalization after a newer save starts', async () => {
    weatherMock.mockResolvedValue(weather('Stale, Nowhere'));
    const state = harness();

    const pending = persistPlaceLabel({ ...state, raw: 'Union, New Jersey' });
    state.genRef.current += 1;
    await pending;

    expect(state.stored).toBe('Union, New Jersey');
  });
});
