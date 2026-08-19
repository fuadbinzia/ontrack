import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { minutesFromPickerDate, minutesToDate } from '../time-field.types';

describe('native time picker values', () => {
  it('ignores a cancelled picker and keeps a chosen clock time', () => {
    expect(minutesFromPickerDate(undefined)).toBeUndefined();
    expect(minutesFromPickerDate(new Date(Number.NaN))).toBeUndefined();
    expect(minutesFromPickerDate(minutesToDate(135))).toBe(135);
  });

  it('guards Android clock-dialog cancel before committing minutes', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/android/material-time-field.tsx'),
      'utf8',
    );
    expect(source).toContain('minutesFromPickerDate(selected)');
    expect(source).toContain('minutes === undefined');
  });
});
