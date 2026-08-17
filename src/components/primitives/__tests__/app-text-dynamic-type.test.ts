import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('dynamic type caps', () => {
  it('raises body scaling to 2x and fit chrome to 1.35x', () => {
    const source = readFileSync(join(__dirname, '../app-text.tsx'), 'utf8');
    expect(source).toContain('shouldFit ? 1.35 : 2');
    expect(source).not.toMatch(/maxFontSizeMultiplier=\{1\.3\}/);
  });

  it('does not hard-cap Input or DurationField below Dynamic Type 2x', () => {
    const input = readFileSync(join(__dirname, '../input.tsx'), 'utf8');
    const duration = readFileSync(join(__dirname, '../duration-field.tsx'), 'utf8');
    expect(input).toContain('maxFontSizeMultiplier={2}');
    expect(input).not.toContain('maxFontSizeMultiplier={1.3}');
    expect(duration).toContain('maxFontSizeMultiplier={2}');
  });
});
