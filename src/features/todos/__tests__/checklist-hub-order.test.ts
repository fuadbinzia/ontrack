import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

/**
 * The hub reordered itself several times on every land: it warm-prefetches
 * detail routes, and the detail route counted a prefetch mount as an open,
 * splicing that list to the front once per warmed href.
 */
describe('checklist hub order stays put on land', () => {
  it('counts an open only on real focus, never on a warm prefetch mount', () => {
    const route = read('src/app/(tabs)/to-do/[id].tsx');
    expect(route).toContain('touchList');
    expect(route).toContain('useFocusEffect');
    expect(route).not.toContain('useEffect(');
  });

  it('keeps warming detail routes from the hub — the pairing focus-only opens protect', () => {
    const overview = read('src/features/todos/todo-lists-overview.tsx');
    expect(overview).toContain('useWarmHrefs');
  });

  it('keeps the persist array as the only list order — recency sort machinery stays deleted', () => {
    const sources = [
      read('src/store/todos-normalize.ts'),
      read('src/store/todos-sync-actions.ts'),
      read('src/features/todos/todo-sort.ts'),
      read('src/features/todos/todo-lists-overview.tsx'),
    ];
    for (const source of sources) {
      expect(source).not.toContain('sortChecklistsByRecent');
      expect(source).not.toContain('listRecencyAt');
    }
  });

  it('keeps the living product spec present with its update protocol', () => {
    const spec = read('docs/checklists-spec.md');
    expect(spec).toContain('Checklists Product Spec');
    expect(spec).toContain('Update protocol');
    expect(spec).toContain('updates this file in the same change');
    expect(spec).toContain('Regression guards');
  });

  it('flushes a recorded open to the cloud so a kill right after cannot lose the promotion', () => {
    const route = read('src/app/(tabs)/to-do/[id].tsx');
    expect(route).toContain("flushCloudDomain('todos')");
    // Only a recorded open pushes — refocus dedupes must not spam upserts.
    expect(route).toContain('touchList(id)');
    expect(route).toMatch(/if \([^)]*touchList\(id\)\)/);
  });
});
