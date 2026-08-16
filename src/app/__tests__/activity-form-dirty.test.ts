import { hasUnsavedActivityChanges } from '@/utils/activity-form-dirty';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const formSource = readFileSync(
  join(process.cwd(), 'src/app/activity-form.tsx'),
  'utf8',
);
const rootLayoutSource = readFileSync(
  join(process.cwd(), 'src/app/_layout.tsx'),
  'utf8',
);

const initial = {
  title: '',
  categoryId: '',
  date: '2026-08-13',
  startMinutes: 720,
  notes: '',
  eventDetails: undefined,
};

describe('activity form unsaved changes', () => {
  it('allows a new empty draft to dismiss after choosing a category', () => {
    expect(
      hasUnsavedActivityChanges(
        initial,
        { ...initial, categoryId: 'event' },
        false,
      ),
    ).toBe(false);
  });

  it('allows category browsing and returning to the initial category in a new empty draft', () => {
    expect(
      hasUnsavedActivityChanges(
        { ...initial, categoryId: 'food' },
        { ...initial, categoryId: 'gym' },
        false,
      ),
    ).toBe(false);
  });

  it.each([
    ['title', { title: 'Knicks game' }],
    ['schedule', { startMinutes: 780 }],
    ['event details', { eventDetails: { providerEventId: 'event-1' } }],
  ])('protects new draft %s changes', (_label, patch) => {
    expect(
      hasUnsavedActivityChanges(initial, { ...initial, ...patch }, false),
    ).toBe(true);
  });

  it('protects category changes while editing an existing activity', () => {
    expect(
      hasUnsavedActivityChanges(
        { ...initial, title: 'Dinner', categoryId: 'food' },
        { ...initial, title: 'Dinner', categoryId: 'personal' },
        true,
      ),
    ).toBe(true);
  });

  it('does not mark an unchanged existing activity dirty', () => {
    expect(hasUnsavedActivityChanges(initial, initial, true)).toBe(false);
  });

  it('owns swipe and backdrop dismissal in SheetScaffold without a beforeRemove interception', () => {
    expect(rootLayoutSource).toMatch(
      /name="activity-form"[\s\S]*?presentation: 'transparentModal',[\s\S]*?animation: 'none',[\s\S]*?gestureEnabled: false/,
    );
    expect(formSource).toContain('<SheetScaffold');
    expect(formSource).toContain('host="route"');
    expect(formSource).toContain('backdropTestID={AgentUiIds.activityForm.backdrop}');
    expect(formSource).not.toContain("addListener('beforeRemove'");
    expect(formSource).not.toContain('useNavigation');
  });

  it('still protects explicit grabber and Cancel dismissal when content changed', () => {
    expect(formSource).toContain('const dirty = hasUnsavedActivityChanges(');
    expect(formSource).toContain('onClose={close}');
    expect(formSource).toContain('closeTestID={AgentUiIds.activityForm.grabber}');
    expect(formSource).toMatch(/variant="ghost"[\s\S]*?onPress=\{close\}/);
  });

  it('returns close and discard actions to the existing Today screen instead of Calendar', () => {
    expect(formSource).toMatch(
      /const leave = \(\) => \{[\s\S]*?goBackOrReplace\(router, '\/'\);[\s\S]*?\};/,
    );
    expect(formSource).toContain('confirmDiscard(leave)');
    expect(formSource).not.toContain("goBackOrReplace(router, '/(tabs)/calendar')");
  });

  it('dismisses the editor before routing guest invitations from event detail to Google review', () => {
    expect(formSource).toMatch(
      /const leaveAfterSave = \(reviewInvitation: boolean, reviewActivityId\?: string\)[\s\S]*?if \(router\.canDismiss\(\)\) router\.dismiss\(\);[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?pathname: '\/\(tabs\)\/profile\/calendar-sync'[\s\S]*?reviewActivityId[\s\S]*?goBackOrReplace\(router, '\/'\)/,
    );
    expect(formSource).not.toContain("router.replace('/(tabs)/profile/calendar-sync')");
    expect(formSource).not.toContain("router.dismissTo('/(tabs)/profile/calendar-sync')");
  });

  it('pops the editor and the stale event-detail sheet after delete', () => {
    expect(formSource).toMatch(
      /const leaveAfterDelete = \(\) => \{[\s\S]*?if \(router\.canDismiss\(\)\) router\.dismiss\(\);[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?router\.dismissTo\('\/'\)/,
    );
    expect(formSource).toMatch(
      /onConfirm: \(\) => \{[\s\S]*?deleteActivity\(editId\);[\s\S]*?leaveAfterDelete\(\);/,
    );
    expect(formSource).toContain('if (allowLeave.current) return null;');
  });

  it('keeps invite-free saves on the ordinary Today dismissal path', () => {
    expect(formSource).toContain('leaveAfterSave(parsedAttendees.emails.length > 0, savedActivity.id)');
    expect(formSource).toMatch(
      /if \(reviewInvitation\) \{[\s\S]*?return;[\s\S]*?goBackOrReplace\(router, '\/'\)/,
    );
  });
});
