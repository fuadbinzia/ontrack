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

  it('hosts the recurring choice inside the native activity form modal', () => {
    expect(source).toContain('AppPromptHost,');
    expect(source).toMatch(
      /<View style=\{\[styles\.root,[\s\S]*?<Screen[\s\S]*?<\/Screen>\s*<AppPromptHost embedded \/>\s*<\/View>/,
    );
  });

  it('keeps ordinary events on the direct single-save path', () => {
    expect(source).toMatch(/if \(isRecurringSeries\)[\s\S]*?return;[\s\S]*?commitSave\('single'\);/);
  });

  it('returns every successful save to Today instead of Calendar', () => {
    expect(source).toMatch(
      /const leaveAfterSave = \(\) => \{[\s\S]*?goBackOrReplace\(router, '\/'\);[\s\S]*?\};/,
    );
    expect(source).toMatch(
      /const commitSave[\s\S]*?saveEvent\(\{ \.\.\.payload, editScope \}\);[\s\S]*?leaveAfterSave\(\);/,
    );
  });
});
