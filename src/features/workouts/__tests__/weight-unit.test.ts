import {
  kilogramsToWorkoutWeight,
  workoutWeightInputValue,
  workoutWeightLabel,
  workoutWeightToKilograms,
  workoutWeightUnitForLocale,
} from '@/features/workouts/weight-unit';

describe('workoutWeightUnitForLocale', () => {
  it.each(['en-US', 'en-GB', 'en-LR', 'my-MM', 'en_US'])(
    'uses pounds for pound-based region %s',
    (locale) => {
      expect(workoutWeightUnitForLocale(locale)).toBe('lb');
    },
  );

  it.each(['en-CA', 'es-MX', 'fr-FR', 'de-DE', 'en-AU', 'invalid_locale'])(
    'keeps kilograms for metric or unknown region %s',
    (locale) => {
      expect(workoutWeightUnitForLocale(locale)).toBe('kg');
    },
  );
});

describe('workout weight conversion', () => {
  it('converts pound input to kilograms for storage and back without drift', () => {
    const kilograms = workoutWeightToKilograms(135, 'lb');

    expect(kilograms).toBeCloseTo(61.23497, 4);
    expect(kilogramsToWorkoutWeight(kilograms, 'lb')).toBeCloseTo(135, 8);
    expect(workoutWeightInputValue(kilograms, 'lb')).toBe('135');
  });

  it('leaves metric input unchanged and labels both unit systems clearly', () => {
    expect(workoutWeightToKilograms(60, 'kg')).toBe(60);
    expect(kilogramsToWorkoutWeight(60, 'kg')).toBe(60);
    expect(workoutWeightInputValue(60, 'kg')).toBe('60');
    expect(workoutWeightLabel('lb')).toBe('Weight (lb)');
    expect(workoutWeightLabel('kg')).toBe('Weight (kg)');
  });
});

