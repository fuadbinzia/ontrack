import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Food glass/token contract (Phase 7 close-out). Scans every Food source
 * file for the paper fills and hard-coded literals forbidden by
 * `.cursor/rules/glass-ui.mdc` — typography comes from AppText variants,
 * radii from `radii` tokens, materials from GlassPlate.
 */

const root = process.cwd();

const SCAN_ROOTS = ['src/app/(tabs)/food', 'src/features/food'];
const EXTRA_FILES = ['src/components/primitives/food-image.tsx'];

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /backgroundElevated/, why: 'paper fill (use GlassPlate/Card glass)' },
  { pattern: /backgroundSunken/, why: 'paper fill (use GlassPlate/Card glass)' },
  { pattern: /accentFaint/, why: 'opaque selected/tint fill (use border/accent text)' },
  { pattern: /surface=["']solid["']/, why: 'solid Card/SettingsGroup surface' },
  { pattern: /surface=\{\s*['"]solid['"]\s*\}/, why: 'solid Card/SettingsGroup surface' },
  { pattern: /fontSize\s*:/, why: 'hard-coded fontSize (use AppText variants / typeConfig)' },
  { pattern: /borderRadius\s*:\s*\d/, why: 'raw radius literal (use radii tokens)' },
  { pattern: /borderRadius\s*:\s*s\(/, why: 'ad-hoc scaled radius (use radii tokens)' },
  { pattern: /shadowRadius\s*:/, why: 'ad-hoc shadow (use shadow tokens / GlassPlate)' },
  { pattern: /shadowOpacity\s*:/, why: 'ad-hoc shadow (use shadow tokens / GlassPlate)' },
  { pattern: /['"]\d+px['"]/, why: 'px string value' },
];

describe('food glass/token contract', () => {
  const files = [
    ...SCAN_ROOTS.flatMap((dir) => collectSourceFiles(join(root, dir))),
    ...EXTRA_FILES.map((file) => join(root, file)),
  ];

  it('scans a non-trivial Food surface (guards against silent path drift)', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((file) => [file.slice(root.length + 1), file]))(
    '%s has no forbidden paper fills or hard-coded literals',
    (_relative, absolute) => {
      const source = readFileSync(absolute, 'utf8');
      const violations = FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map(
        ({ pattern, why }) => `${pattern} — ${why}`,
      );
      expect(violations).toEqual([]);
    },
  );
});
