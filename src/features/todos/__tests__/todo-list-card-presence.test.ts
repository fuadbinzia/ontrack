import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { checklistCardPresence } from '@/features/todos/todo-list-card-presence';

describe('checklistCardPresence', () => {
  it('treats leftover work as an open accent pulse', () => {
    expect(checklistCardPresence(2, 5)).toEqual({
      clear: false,
      empty: false,
      label: '2',
      sublabel: 'Open',
      tone: 'accent',
    });
  });

  it('marks a finished list clear', () => {
    expect(checklistCardPresence(0, 4)).toEqual({
      clear: true,
      empty: false,
      label: '0',
      sublabel: 'Clear',
      tone: 'success',
    });
  });

  it('keeps an unused list quiet', () => {
    expect(checklistCardPresence(0, 0)).toEqual({
      clear: false,
      empty: true,
      label: '0',
      sublabel: 'Open',
      tone: 'success',
    });
  });

  it('clamps leftover counts and ignores invalid totals', () => {
    expect(checklistCardPresence(9, 3).label).toBe('3');
    expect(checklistCardPresence(-2, 4)).toMatchObject({
      label: '0',
      clear: true,
    });
    expect(checklistCardPresence(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      clear: false,
      empty: true,
      label: '0',
      sublabel: 'Open',
      tone: 'success',
    });
  });

  it('keeps hub list rows on a plain View so card presses still open the list', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-lists-overview.tsx'),
      'utf8',
    );
    expect(source).toContain('<View style={styles.listItem}>');
    expect(source).toContain('openChecklist(item.id)');
    expect(source).not.toContain('router.push(`/(tabs)/to-do/${item.id}`');
    expect(source).not.toContain('<Presence');
  });
});
