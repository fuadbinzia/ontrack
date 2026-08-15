import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('trip friend role badge layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/features/travel/trip-friend-row.tsx'),
    'utf8',
  );

  it('gives Host and Co-host the same responsive badge width', () => {
    expect(source).toContain('const roleBadgeWidth = Math.max(72, s(72));');
    expect(source).toContain("style={{ width: roleBadgeWidth, alignSelf: 'center' }}");
    expect(source.match(/<GlassTonePill/g)).toHaveLength(1);
  });

  it('centers every roster status vertically in the shared badge column', () => {
    expect(source).toContain("badge?: 'host' | 'cohost' | 'pending';");
    expect(source).toContain("badge === 'host' ? 'Host'");
    expect(source).toContain("badge === 'cohost' ? 'Co-host' : 'Pending'");
    expect(source).toMatch(/\{badge \? \([\s\S]*?<GlassTonePill/);
    expect(source).toMatch(
      /<GlassTonePill[\s\S]*?style=\{\{ width: roleBadgeWidth, alignSelf: 'center' \}\}/,
    );
  });
});
