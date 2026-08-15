import fs from 'fs';
import path from 'path';

import { dayAddSheetCopy } from '../day-add-sheet-copy';

const source = fs.readFileSync(
  path.resolve(__dirname, '../day-add-sheet.tsx'),
  'utf8',
);

describe('DayAddSheet header', () => {
  it('keeps Add to Today without the hop-cut subtitle', () => {
    expect(dayAddSheetCopy(null)).toEqual({ title: 'Add to Today' });
    expect(source).toContain('title={copy.title}');
    expect(source).not.toContain('Finish it here');
    expect(source).not.toContain('no extra hop');
  });

  it('titles the in-sheet checklist and journal composers', () => {
    expect(dayAddSheetCopy('checklist')).toEqual({
      title: 'Add Checklist Item',
      subtitle: 'Saved to your To Do list.',
    });
    expect(dayAddSheetCopy('journal')).toEqual({
      title: 'Add Journal Line',
      subtitle: 'Appended to today’s journal page.',
    });
  });
});
