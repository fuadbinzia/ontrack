import fs from 'node:fs';
import path from 'node:path';

describe('Overview summary row layout contract', () => {
  const row = fs.readFileSync(
    path.resolve(__dirname, '../overview-summary-row.tsx'),
    'utf8',
  );
  const screen = fs.readFileSync(
    path.resolve(__dirname, '../overview-screen.tsx'),
    'utf8',
  );

  it('gives each section its own airy glass card instead of a grouped list', () => {
    expect(row).toContain('<GlassPlate');
    expect(row).toContain('airy');
    expect(row).not.toContain('isLast');
    expect(row).not.toContain('borderBottomWidth');
    expect(row).not.toContain('chevron-right');
    expect(row).not.toContain('styles.chevron');
    expect(row).not.toContain('styles.rowTitleLine');
    expect(screen).not.toContain('summaryPlate');
    expect(screen).not.toContain('isLast');
  });

  it('uses each section tone on its label', () => {
    expect(row).toContain("}[row.tone ?? 'accent']");
    expect(row).toContain('style={[styles.label, { color: toneColor }]}');
  });

  it('keeps compact leading section icon wells from tab meta', () => {
    expect(row).toContain('GlassIconWell');
    expect(row).toContain('TAB_META[row.routeName]?.icon');
    expect(row).toContain('size={s(28)}');
    expect(row).toContain('size={s(13)}');
    expect(row).not.toContain('row.icon');
    expect(row).not.toContain('size={s(44)}');
    expect(row).not.toContain('size={s(19)}');
  });
});
