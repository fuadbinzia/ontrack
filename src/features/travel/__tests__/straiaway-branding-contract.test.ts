import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const TEXT_EXTENSIONS = new Set(['.json', '.md', '.sql', '.ts', '.tsx']);
const LEGACY_BRAND_CASE = ['Strai', 'away'].join('');

function textFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return textFiles(child);
    return TEXT_EXTENSIONS.has(extname(entry.name)) ? [child] : [];
  });
}

describe('StraiAway branding', () => {
  it('does not use the legacy product-name casing in app or partner documentation', () => {
    const files = [
      ...textFiles(join(ROOT, 'src')),
      ...textFiles(join(ROOT, 'docs')),
      ...textFiles(join(ROOT, 'public')),
      ...textFiles(join(ROOT, 'supabase')),
      join(ROOT, 'AGENTS.md'),
    ];
    const violations = files
      .filter((file) => readFileSync(file, 'utf8').includes(LEGACY_BRAND_CASE))
      .map((file) => relative(ROOT, file));

    expect(violations).toEqual([]);
  });

  it('uses the canonical casing in visible travel UI and exported partner names', () => {
    const actionGrid = readFileSync(
      join(ROOT, 'src/features/travel/travel-trip-action-grid.tsx'),
      'utf8',
    );
    const partnerClient = readFileSync(join(ROOT, 'src/services/partner/straiaway.ts'), 'utf8');

    expect(actionGrid).toContain('label="StraiAway"');
    expect(partnerClient).toContain('export class StraiAwayPartnerError');
  });

  it('preserves lowercase case-sensitive partner slugs and routes', () => {
    const partnerTypes = readFileSync(join(ROOT, 'src/services/partner/types.ts'), 'utf8');
    const partnerClient = readFileSync(join(ROOT, 'src/services/partner/straiaway.ts'), 'utf8');

    expect(partnerTypes).toContain("PARTNER_STRAIAWAY = 'straiaway'");
    expect(partnerClient).toContain("'/api/partner/straiaway/status'");
  });
});
