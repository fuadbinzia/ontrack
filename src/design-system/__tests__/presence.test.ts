import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  LIST_STAGGER_CAP,
  LIST_STAGGER_MS,
  listEnterDelay,
  nextListEnterIds,
  resetListEnterIds,
} from '@/design-system/presence';

describe('list presence stagger', () => {
  it('staggers early rows and caps a long list', () => {
    expect(listEnterDelay(0)).toBe(0);
    expect(listEnterDelay(3)).toBe(3 * LIST_STAGGER_MS);
    expect(listEnterDelay(LIST_STAGGER_CAP)).toBe(
      LIST_STAGGER_CAP * LIST_STAGGER_MS,
    );
    expect(listEnterDelay(LIST_STAGGER_CAP + 8)).toBe(
      LIST_STAGGER_CAP * LIST_STAGGER_MS,
    );
  });

  it('treats invalid indexes as the first row', () => {
    expect(listEnterDelay(-4)).toBe(0);
    expect(listEnterDelay(Number.NaN)).toBe(0);
  });

  it('defaults Presence enter off so remounting pages do not FadeInDown', () => {
    const presence = readFileSync(
      join(process.cwd(), 'src/components/primitives/presence.tsx'),
      'utf8',
    );
    expect(presence).toContain('enter = false');
    expect(presence).toContain('enter ? listEntering(index) : undefined');
    expect(presence).toContain('useSettledListLayout');
    expect(presence).toContain('settled ? listLayout() : undefined');
    expect(presence).toContain('onLayout: settled ? undefined : onFirstLayout');
  });
});

describe('nextListEnterIds', () => {
  afterEach(() => {
    resetListEnterIds();
  });

  it('does not enter existing rows on first sight or remount', () => {
    expect([...nextListEnterIds('hub', ['a', 'b'])]).toEqual([]);
    expect([...nextListEnterIds('hub', ['a', 'b'])]).toEqual([]);
  });

  it('enters only ids that appeared after the list was first seen', () => {
    nextListEnterIds('hub', ['a']);
    expect([...nextListEnterIds('hub', ['a', 'b'])]).toEqual(['b']);
    expect([...nextListEnterIds('hub', ['a', 'b'])]).toEqual([]);
  });
});
