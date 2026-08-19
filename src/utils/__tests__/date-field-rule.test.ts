import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('native date-field invariant', () => {
  it('does not use text inputs for editable calendar dates', () => {
    const files = [
      ...tsxFiles(join(process.cwd(), 'src/app')),
      ...tsxFiles(join(process.cwd(), 'src/features')),
    ];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(
        /<Input[^>]*\slabel=["'](?:Date|Departure|Return|Date of Birth|Last Watered)[^"']*["']/i,
      );
      expect(source).not.toMatch(/placeholder=["'](?:YYYY-MM-DD|MM\/DD\/YYYY)["']/);
    }
  });

  it('ignores Android date-picker cancel instead of writing an invalid date', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/primitives/date-field.tsx'),
      'utf8',
    );
    expect(source).toContain('isValidCalendarDate(selectedDate)');
    expect(source).toContain('setShowPicker(false)');
  });

  it('exports the shared design-system date field', () => {
    const primitives = readFileSync(
      join(process.cwd(), 'src/components/primitives/index.ts'),
      'utf8',
    );
    expect(primitives).toContain("export { DateField } from './date-field';");
  });

  it('does not render stored date keys directly as visible text', () => {
    const files = [
      ...tsxFiles(join(process.cwd(), 'src/app')),
      ...tsxFiles(join(process.cwd(), 'src/features')),
    ];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(
        />\s*\{[A-Za-z0-9_.]+\.(?:date|nextDue|asOf)\}/,
      );
      expect(source).not.toMatch(
        /\b(?:next|due|as of)\s+\{[A-Za-z0-9_.]+\.(?:date|nextDue|asOf)\}/i,
      );
    }
  });
});
