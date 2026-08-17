import { isDrawableSvgPath } from '../svg-path';

describe('isDrawableSvgPath', () => {
  it('rejects empty and whitespace path data that crash Android PathParser', () => {
    expect(isDrawableSvgPath('')).toBe(false);
    expect(isDrawableSvgPath('   ')).toBe(false);
    expect(isDrawableSvgPath(undefined)).toBe(false);
    expect(isDrawableSvgPath(null)).toBe(false);
  });

  it('accepts a real SVG path', () => {
    expect(isDrawableSvgPath('M0 0L10 10Z')).toBe(true);
  });
});
