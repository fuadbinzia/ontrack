import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('bottom nav tab selection motion', () => {
  const itemSource = readFileSync(
    join(process.cwd(), 'src/components/navigation/bottom-nav-tab-item.tsx'),
    'utf8',
  );
  const barSource = readFileSync(
    join(process.cwd(), 'src/components/navigation/bottom-nav-bar.tsx'),
    'utf8',
  );

  it('marks the selected pin with a per-slot accent dot (not a rail-center mark)', () => {
    expect(barSource).toContain('styles.dot');
    expect(barSource).not.toContain('centerIndicator');
    expect(itemSource).not.toContain('indicatorStyle');
    expect(itemSource).not.toMatch(/styles\.indicator\b/);
  });

  it('eases caption color without animated SymbolView remounts', () => {
    expect(itemSource).toContain('withTiming');
    expect(itemSource).toContain('interpolateColor');
    expect(itemSource).toContain('useReducedMotion');
    expect(itemSource).toContain("from '@/components/primitives'");
    expect(itemSource).not.toContain('createAnimatedComponent');
    expect(itemSource).not.toContain('useAnimatedProps');
  });
});
