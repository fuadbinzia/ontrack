import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('flight confirmation add-sheet import', () => {
  it('fills the review draft without saving the plan', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/features/travel/travel-plan-confirmation-import-flight.ts',
      ),
      'utf8',
    );
    const branchStart = source.indexOf("if (target === 'new') {", source.indexOf('const firstSegment'));
    const branchEnd = source.indexOf("if (target !== 'new')", branchStart);
    const addSheetBranch = source.slice(branchStart, branchEnd);

    expect(addSheetBranch).toContain('applyFlightScheduleToAddSheet(');
    expect(addSheetBranch).toContain('splitRoundTripDirections(imported.segments)');
    expect(addSheetBranch).toContain('addSheet.setReturnFlightDetails');
    expect(addSheetBranch).toContain('addSheet.setFlightDetails');
    expect(addSheetBranch).toContain('addSheet.setPendingFlightImport(imported)');
    expect(addSheetBranch).not.toContain('updatePlan(');
    expect(addSheetBranch).not.toContain('mergeImportedFlights(');
  });
});
