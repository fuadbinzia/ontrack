import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('social tab registration', () => {
  it('registers Social in the tabs layout and bottom nav meta', () => {
    const tabsLayout = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/_layout.tsx'),
      'utf8',
    );
    const tabMeta = readFileSync(
      join(process.cwd(), 'src/components/navigation/bottom-nav-tab-meta.ts'),
      'utf8',
    );

    expect(tabsLayout).toContain('name="social"');
    expect(tabMeta).toContain('social: {');
    expect(tabMeta).toContain("label: 'Social'");
    expect(tabMeta).toContain("icon: 'people'");
    expect(tabMeta).toContain("href: '/(tabs)/social'");
  });
});
