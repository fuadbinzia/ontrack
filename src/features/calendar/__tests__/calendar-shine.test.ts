import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), 'utf8');

describe('calendar shine (every land)', () => {
  it('replays the original skew sheen whenever Calendar gains focus', () => {
    const screen = read('src/app/(tabs)/calendar.tsx');
    const shine = read('src/features/calendar/calendar-shine.tsx');

    expect(screen).toContain('CalendarShine');
    expect(screen).toContain('useIsFocused');
    expect(screen).toContain('deferAfterPageTransition');
    expect(screen).toContain('setShinePlay(false)');
    expect(screen).toContain('setShinePlay(true)');
    // Sibling overlay — never wrap GlassPlate in overflow:hidden.
    expect(shine).toContain('StyleSheet.absoluteFill');
    expect(shine).toContain('pointerEvents="none"');
    expect(shine).toContain('useReducedMotion');
    expect(shine).toContain('LinearGradient');
    expect(shine).toContain('withTiming');
    expect(shine).toContain('cancelAnimation');
    expect(shine).toContain("skewX: '-18deg'");
    expect(shine).not.toContain('rotate:');
    expect(shine).not.toContain('playedRef');
  });
});
