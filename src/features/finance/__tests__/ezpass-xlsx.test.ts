import * as XLSX from 'xlsx';

import { parseEzPassWorkbookBytes } from '../ezpass-import';

describe('E-ZPass XLSX import', () => {
  it('reads a workbook locally and ignores non-activity sheets', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Transaction Date', 'Transaction Type', 'Facility', 'Amount'],
        ['08/12/2026', 'Toll', 'Henry Hudson Bridge', '3.18'],
        ['08/13/2026', 'Replenishment', 'E-ZPass NY', '25.00'],
      ]),
      'Activity',
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Account summary']]), 'Summary');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsed = await parseEzPassWorkbookBytes(bytes);
    expect(parsed.activities.map((row) => row.kind)).toEqual(['toll', 'replenishment']);
  });
});
