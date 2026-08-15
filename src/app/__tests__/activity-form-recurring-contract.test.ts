import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src/app/activity-form.tsx'), 'utf8');
const sheetSource = readFileSync(
  join(process.cwd(), 'src/components/primitives/sheet-scaffold.tsx'),
  'utf8',
);

describe('recurring event edit prompt', () => {
  it('offers a choice between one occurrence and the whole series before saving', () => {
    expect(source).toContain("'Update Recurring Event?'");
    expect(source).toContain("commitSave('single')");
    expect(source).toContain("commitSave('series')");
    expect(source).toContain('AgentUiIds.activityForm.saveThisOccurrence');
    expect(source).toContain('AgentUiIds.activityForm.saveSeries');
  });

  it('hosts the recurring choice inside the canonical activity form sheet', () => {
    expect(source).toContain('<SheetScaffold');
    expect(sheetSource).toContain('<AppPromptHost embedded />');
  });

  it('keeps ordinary events on the direct single-save path', () => {
    expect(source).toMatch(/if \(isRecurringSeries\)[\s\S]*?return;[\s\S]*?commitSave\('single'\);/);
  });

  it('dismisses the sheet host before recurring guest events enter invitation review', () => {
    expect(source).toMatch(
      /const leaveAfterSave = \(reviewInvitation: boolean, reviewActivityId\?: string\)[\s\S]*?if \(router\.canDismiss\(\)\) router\.dismiss\(\);[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?pathname: '\/\(tabs\)\/profile\/calendar-sync'[\s\S]*?reviewActivityId[\s\S]*?goBackOrReplace\(router, '\/'\)/,
    );
    expect(source).not.toContain("router.replace('/(tabs)/profile/calendar-sync')");
    expect(source).not.toContain("router.dismissTo('/(tabs)/profile/calendar-sync')");
  });

  it('applies the same invite-aware close path to single and series saves', () => {
    expect(source).toMatch(
      /const commitSave[\s\S]*?const savedActivity = saveEvent\(\{ \.\.\.payload, editScope \}\);[\s\S]*?leaveAfterSave\(parsedAttendees\.emails\.length > 0, savedActivity\.id\);/,
    );
  });
});
