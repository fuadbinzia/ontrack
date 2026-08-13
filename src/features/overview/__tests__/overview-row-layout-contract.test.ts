import fs from 'node:fs';
import path from 'node:path';

describe('Overview summary row layout contract', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../overview-summary-row.tsx'),
    'utf8',
  );

  it('centers the trailing chevron against the full row instead of the title line', () => {
    expect(source).toContain(
      '<View style={[styles.chevron, { minWidth: s(24) }]}>',
    );
    expect(source).toMatch(/alignSelf: ["']stretch["']/);
    expect(source).toMatch(/justifyContent: ["']center["']/);
    expect(source).not.toContain('styles.rowTitleLine');
  });
});
