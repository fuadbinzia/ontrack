import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'src/components/primitives/sheet-scaffold.tsx'),
  'utf8',
);

describe('SheetScaffold route host', () => {
  it('renders route-backed sheets without creating a nested native Modal', () => {
    expect(source).toContain("host?: 'modal' | 'route'");
    expect(source).toContain("if (host === 'route') return content;");
    expect(source).toMatch(/if \(host === 'route'\) return content;[\s\S]*?return \(\s*<Modal/);
  });

  it('keeps native Modal hosting as the default for in-tree sheets', () => {
    expect(source).toContain("host = 'modal'");
  });

  it('hides the tab dock only while a sheet is presented, not while held or prefetched', () => {
    expect(source).toContain('useIsFocused');
    expect(source).toContain('isModalSheetPresented(visible, host, routeFocused)');
    expect(source).toContain('visible: presented');
    expect(source).toContain('if (!presented) return');
    expect(source).toContain('beginModalSheet');
    expect(source).not.toMatch(
      /useEffect\(\(\) => \{\s*if \(!held\) return;\s*beginModalSheet/,
    );
  });
});
