import {
  meteringToWaveLevel,
  pushWaveSample,
  WAVE_BAR_COUNT,
  WAVE_SILENCE_LEVEL,
} from '../voice-wave';

describe('meteringToWaveLevel', () => {
  it('keeps silence at the visible floor instead of flatlining', () => {
    expect(meteringToWaveLevel(-160)).toBe(WAVE_SILENCE_LEVEL);
    expect(meteringToWaveLevel(-55)).toBe(WAVE_SILENCE_LEVEL);
  });

  it('treats a missing meter as quiet, not broken', () => {
    expect(meteringToWaveLevel(undefined)).toBe(WAVE_SILENCE_LEVEL);
    expect(meteringToWaveLevel(null)).toBe(WAVE_SILENCE_LEVEL);
    expect(meteringToWaveLevel(Number.NaN)).toBe(WAVE_SILENCE_LEVEL);
  });

  it('clamps loud input to a full bar', () => {
    expect(meteringToWaveLevel(-8)).toBe(1);
    expect(meteringToWaveLevel(0)).toBe(1);
  });

  it('scales speech-range levels between floor and ceiling', () => {
    expect(meteringToWaveLevel(-31.5)).toBeCloseTo(0.5, 5);
    const quiet = meteringToWaveLevel(-45);
    const loud = meteringToWaveLevel(-15);
    expect(quiet).toBeGreaterThan(WAVE_SILENCE_LEVEL - 1e-9);
    expect(loud).toBeGreaterThan(quiet);
    expect(loud).toBeLessThan(1);
  });
});

describe('pushWaveSample', () => {
  it('appends the newest level at the end', () => {
    expect(pushWaveSample([0.2, 0.4], 0.9)).toEqual([0.2, 0.4, 0.9]);
  });

  it('slides the window once the bar count is full', () => {
    const full = Array.from({ length: WAVE_BAR_COUNT }, (_, i) => i / WAVE_BAR_COUNT);
    const next = pushWaveSample(full, 1);
    expect(next).toHaveLength(WAVE_BAR_COUNT);
    expect(next[next.length - 1]).toBe(1);
    expect(next[0]).toBe(full[1]);
  });

  it('does not mutate the previous samples', () => {
    const prev = [0.5];
    pushWaveSample(prev, 0.7);
    expect(prev).toEqual([0.5]);
  });
});
