import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readTravelFile(name: string): string {
  return readFileSync(
    join(process.cwd(), 'src/features/travel', name),
    'utf8',
  );
}

describe('historical Travel bug-fix regressions', () => {
  it('keeps the Days Done summary aligned to the right edge', () => {
    const progress = readTravelFile('travel-timeline-progress-chrome.tsx');

    expect(progress).toMatch(
      /stripRow:\s*\{[\s\S]*?width:\s*['"]100%['"][\s\S]*?justifyContent:\s*['"]space-between['"]/,
    );
    expect(progress).toMatch(
      /stripMeta:\s*\{[\s\S]*?alignItems:\s*['"]flex-end['"]/,
    );
    expect(progress).toMatch(
      /stripMetaText:\s*\{[\s\S]*?width:\s*['"]100%['"][\s\S]*?textAlign:\s*['"]right['"]/,
    );
    expect(progress).toContain('align="right"');
  });

  it('keeps edit-trip save, cancel, and delete actions reachable', () => {
    const editor = readTravelFile('travel-plan-details-editor.tsx');

    expect(editor).toContain('testID={AgentUiIds.travel.editTrip.cancel}');
    expect(editor).toContain('testID={AgentUiIds.travel.editTrip.save}');
    expect(editor).toContain('testID={AgentUiIds.travel.removeConfirm.open}');
    expect(editor).toContain('accessibilityLabel="Save Details"');
    expect(editor).toContain('onPress={onSave}');
    expect(editor).toContain('onPress={openDeleteTrip}');
    expect(editor).toContain('<TravelRemoveConfirmModal');
  });
});
