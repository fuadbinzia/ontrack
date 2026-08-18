import fs from 'node:fs';
import path from 'node:path';

describe('Input layout contract', () => {
  it('allows empty stacked multiline fields to grow around their label and value', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/primitives/input.tsx'),
      'utf8',
    );

    expect(source).toContain('minHeight: rowMinHeight');
    expect(source).toContain('height: multiline ? styleHeight : rowMinHeight');
    expect(source).toContain('const styleMinHeight = readStyleMinHeight(style)');
    expect(source).toContain('const styleHeight = readStyleHeight(style)');
    expect(source).toContain('const rowMinHeight = styleMinHeight ?? minHeight');
    expect(source).toContain('withoutFrameSize');
    expect(source).toContain('withoutFrameSize(style)');
    expect(source).toContain('minHeight: stackedMinHeight');
    expect(source).not.toContain('multiline && hasValue');
    expect(source).toContain('multiline ? styles.stackedMultilineInput : null');
    expect(source).toContain('styles.iconMultilineSlot');
    expect(source).toContain('iconMultilineOpticalPad');
    expect(source).toContain("textAlignVertical: 'top'");
    expect(source).not.toContain("alignSelf: 'center', flexGrow: 0, flexShrink: 1");
    expect(source).toMatch(
      /stackedMultilineInput:\s*\{[\s\S]*?flexGrow:\s*0,[\s\S]*?flexBasis:\s*'auto'/,
    );
    // Label stays in normal flow above the value — do not pad the TextInput for it
    // (that doubles empty height and makes placeholder-only fields look oversized).
    expect(source).not.toContain('paddingTop: typography.caption.lineHeight + 2');
  });

  it('does not recenter the caret on each letter before a multiline icon field wraps', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/primitives/input.tsx'),
      'utf8',
    );

    expect(source).toContain('styles.iconMultilineSlot');
    expect(source).toContain('iconMultilineOpticalPad');
    expect(source).toContain('paddingVertical: iconMultilinePad');
    expect(source).toContain("justifyContent: 'flex-start'");
    expect(source).toContain("textAlignVertical: 'top'");
    expect(source).toContain('withoutFrameSize(style)');
    expect(source).not.toContain("alignSelf: 'center', flexGrow: 0, flexShrink: 1");
    expect(source).not.toContain("alignSelf: 'center', flexGrow: 0, flexShrink: 0");
    expect(source).toMatch(/showChromePlaceholder\s*=\s*\n\s*hasIcon &&\s*\n\s*!stacked &&\s*\n\s*!multiline &&/);
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
