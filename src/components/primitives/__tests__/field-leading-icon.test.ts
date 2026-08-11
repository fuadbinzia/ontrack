import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  fieldLeadingIconRowStyle,
  stackedFieldMinHeight,
} from '@/components/primitives/field-leading-icon-style';

describe('fieldLeadingIconRowStyle', () => {
  it('always centers icons vertically in the field row', () => {
    expect(fieldLeadingIconRowStyle()).toEqual({
      flexDirection: 'row',
      alignItems: 'center',
    });
  });

  it('merges sizing overrides without losing icon centering', () => {
    const style = fieldLeadingIconRowStyle({
      minHeight: 60,
      gap: 8,
      paddingVertical: 8,
    });

    expect(style).toEqual({
      minHeight: 60,
      gap: 8,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
    });
  });

  it('wins over alignItems / flexDirection when forced through', () => {
    const style = fieldLeadingIconRowStyle({
      minHeight: 60,
      ...( {
        alignItems: 'flex-start',
        flexDirection: 'column',
      } as object),
    });

    expect(style.alignItems).toBe('center');
    expect(style.flexDirection).toBe('row');
  });
});

describe('dropdown leading icon spacing', () => {
  it('applies the shared gap to the interactive glass field row', () => {
    const dropdown = readFileSync(
      join(process.cwd(), 'src/components/primitives/dropdown.tsx'),
      'utf8',
    );
    expect(dropdown).toMatch(/fieldInner:\s*\{[^}]*gap:\s*spacing\.sm/s);
  });
});

describe('stackedFieldMinHeight', () => {
  it('grows stacked fields for accessibility text without shrinking either line', () => {
    expect(
      stackedFieldMinHeight({
        baseMinHeight: 60,
        fontScale: 1,
        labelLineHeight: 18,
        valueLineHeight: 24,
        verticalPadding: 8,
      }),
    ).toBe(60);
    expect(
      stackedFieldMinHeight({
        baseMinHeight: 60,
        fontScale: 1.3,
        labelLineHeight: 18,
        valueLineHeight: 24,
        verticalPadding: 8,
      }),
    ).toBeGreaterThan(60);
  });
});
