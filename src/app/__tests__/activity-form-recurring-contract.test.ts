import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src/app/activity-form.tsx'), 'utf8');

describe('recurring event edit prompt', () => {
  it('offers a choice between one occurrence and the whole series before saving', () => {
    expect(source).toContain("'Update Recurring Event?'");
    expect(source).toContain("commitSave('single')");
    expect(source).toContain("commitSave('series')");
    expect(source).toContain('AgentUiIds.activityForm.saveThisOccurrence');
    expect(source).toContain('AgentUiIds.activityForm.saveSeries');
  });

  it('keeps ordinary events on the direct single-save path', () => {
    expect(source).toMatch(/if \(isRecurringSeries\)[\s\S]*?return;[\s\S]*?commitSave\('single'\);/);
  });
});
