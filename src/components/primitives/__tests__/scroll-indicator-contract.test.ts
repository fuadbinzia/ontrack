import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

const INDICATOR_PROP =
  /shows(?:Horizontal|Vertical)ScrollIndicator(?:\s*=\s*\{([^}]+)\}|\s*:\s*([^,\n]+)|(?=\s*>))/g;

function walkSource(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkSource(full, files);
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry)) files.push(full);
  }
  return files;
}

describe('hidden scroll indicators', () => {
  it('defaults both RN ScrollView indicators off in the versioned patch', () => {
    const patch = read('patches/react-native+0.86.2.patch');
    const scrollView = read(
      'node_modules/react-native/Libraries/Components/ScrollView/ScrollView.js',
    );

    expect(patch).toContain('showsHorizontalScrollIndicator = false');
    expect(patch).toContain('showsVerticalScrollIndicator = false');
    expect(scrollView).toContain('showsHorizontalScrollIndicator = false');
    expect(scrollView).toContain('showsVerticalScrollIndicator = false');
  });

  it('never turns a product scroll indicator back on', () => {
    const enabled: string[] = [];

    for (const file of walkSource(join(root, 'src'))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(INDICATOR_PROP)) {
        const value = (match[1] ?? match[2] ?? 'true').trim();
        if (value !== 'false') {
          enabled.push(`${file.slice(root.length + 1)}: ${match[0]}`);
        }
      }
    }

    expect(enabled).toEqual([]);
  });

  it('hides indicators on every DraggableFlatList', () => {
    const missing: string[] = [];

    for (const file of walkSource(join(root, 'src'))) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('<DraggableFlatList')) continue;
      if (
        !source.includes('showsVerticalScrollIndicator={false}') &&
        !source.includes('showsVerticalScrollIndicator: false')
      ) {
        missing.push(file.slice(root.length + 1));
      }
    }

    expect(missing).toEqual([]);
  });

  it('hides web scrollbars on the invite shell', () => {
    const html = read('src/app/+html.tsx');
    expect(html).toContain('scrollbar-width: none');
    expect(html).toContain('*::-webkit-scrollbar { display: none');
  });
});
