import fs from 'node:fs';
import path from 'node:path';

describe('Input layout contract', () => {
  it('allows empty stacked multiline fields to grow around their label and value', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/primitives/input.tsx'),
      'utf8',
    );

    expect(source).toContain('height: multiline ? undefined : minHeight');
    expect(source).toContain('minHeight: stackedMinHeight');
    expect(source).not.toContain('multiline && hasValue');
    expect(source).toContain('multiline ? styles.stackedMultilineInput : null');
    expect(source).toMatch(
      /stackedMultilineInput:\s*\{[\s\S]*?flexGrow:\s*0,[\s\S]*?flexBasis:\s*'auto'/,
    );
    // Label stays in normal flow above the value — do not pad the TextInput for it
    // (that doubles empty height and makes placeholder-only fields look oversized).
    expect(source).not.toContain('paddingTop: typography.caption.lineHeight + 2');
  });

  it('does not fit-shrink field labels (tracking would outrun the glyphs)', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/primitives/input.tsx'),
      'utf8',
    );

    expect(source).toMatch(
      /<AppText variant="overline" color="tertiary" numberOfLines=\{1\}>/,
    );
    expect(source).not.toMatch(
      /<AppText variant="overline" color="tertiary" fit>/,
    );
    expect(source).toContain('letterSpacing: 0');
  });
});
