import { durationPartsToMinutes, splitDurationMinutes } from '@/utils/duration';

describe('duration hour and minute fields', () => {
  it.each([
    [240, { hours: 4, minutes: 0 }],
    [65, { hours: 1, minutes: 5 }],
    [45, { hours: 0, minutes: 45 }],
  ])('always splits %i minutes into hours and minutes', (total, expected) => {
    expect(splitDurationMinutes(total)).toEqual(expected);
  });

  it.each([
    ['4', '0', 240],
    ['1', '5', 65],
    ['0', '45', 45],
  ])('combines %s hours and %s minutes', (hours, minutes, expected) => {
    expect(durationPartsToMinutes(hours, minutes)).toBe(expected);
  });

  it.each([
    ['', '30'],
    ['1', ''],
    ['1', '60'],
    ['hours', '15'],
  ])('rejects incomplete or invalid duration parts (%s, %s)', (hours, minutes) => {
    expect(durationPartsToMinutes(hours, minutes)).toBeNaN();
  });
});
