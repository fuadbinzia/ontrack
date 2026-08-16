import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

describe('button leading/label alignment invariant', () => {
  it('keeps Button as a simple row center — no labelSlot / translateY optical hacks', () => {
    const button = read('src/components/primitives/button.tsx');

    expect(button).toMatch(/base:\s*\{[^}]*alignItems:\s*['"]center['"]/s);
    expect(button).toContain('<AppText');
    expect(button).toContain('numberOfLines={1}');
    // Self-sized Button labels must not use AppText fit (Android truncates e.g. "Add Activity").
    expect(button).not.toMatch(/<AppText\b[^>]*\bfit\b/);
    expect(button).not.toContain('labelSlot');
    expect(button).not.toContain('leadingHeight');
    expect(button).not.toContain('translateY');
    expect(button).not.toContain('usesBuiltInLeadingSlot');
    expect(button).toContain("labelText !== ''");
    expect(button).toContain('fieldTitleCase');
  });

  it('keeps Travel action icon+label on one centered row without optical nudges', () => {
    const actions = read('src/features/travel/travel-list-actions.tsx');

    expect(actions).toMatch(/actionContent:\s*\{[^}]*alignItems:\s*['"]center['"]/s);
    expect(actions).toMatch(/actionContent:\s*\{[^}]*flexDirection:\s*['"]row['"]/s);
    expect(actions).toMatch(/actionIcon:\s*\{[^}]*alignItems:\s*['"]center['"]/s);
    expect(actions).toMatch(/actionIcon:\s*\{[^}]*justifyContent:\s*['"]center['"]/s);
    // Grid tiles + wide CTAs center icon+label in the glass plate.
    expect(actions).toMatch(/actionGlass:\s*\{[^}]*justifyContent:\s*['"]center['"]/s);
    expect(actions).toMatch(/actionContent:\s*\{[^}]*justifyContent:\s*['"]center['"]/s);
    expect(actions).toContain('align="center"');
    expect(actions).toContain('styles.actionContent');
    expect(actions).toContain('fieldTitleCase');
    expect(actions).not.toContain('translateY');
  });

  it('keeps EmptyState CTA as a self-sized centered pill without AppText fit', () => {
    const empty = read('src/components/primitives/empty-state.tsx');

    expect(empty).toMatch(/actionGlass:\s*\{[^}]*justifyContent:\s*['"]center['"]/s);
    expect(empty).toContain('fieldTitleCase(title)');
    expect(empty).toContain('fieldTitleCase(message)');
    expect(empty).toContain('align="center"');
    // Same Android failure mode as Button — fit left-packs / truncates short labels.
    expect(empty).not.toMatch(/<AppText\b[^>]*\bfit\b/);
  });
});
