import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (name: string) =>
  readFileSync(join(__dirname, '..', name), 'utf8');

describe('journal page chrome', () => {
  it('sends from the docked field and keeps plus in the header', () => {
    const composer = read('journal-composer.tsx');
    const page = read('journal-page-screen.tsx');
    expect(composer).toContain('trailing={');
    expect(composer).toContain('icon="send"');
    expect(composer).toContain('composer.send');
    expect(composer).toContain("width: '100%'");
    expect(page).toContain('JournalAddMenu');
    expect(page).toContain('titleMeta=');
    expect(page).toContain('eyebrow=');
    expect(page).not.toContain('subtitle=');
    expect(page).toContain('titleTrailing=');
    expect(page).toContain('prevDay');
    expect(page).toContain('nextDay');
    expect(page).toContain('journal.undo');
    expect(page).toContain('journal.redo');
    expect(page).toContain('editMode');
    expect(page.indexOf('journal.undo')).toBeLessThan(page.indexOf('editMode'));
    expect(page.indexOf('titleTrailing=')).toBeLessThan(page.indexOf('prevDay'));
    expect(page.indexOf('prevDay')).toBeLessThan(page.indexOf('editMode'));
    expect(page).toContain('icon={managing ? \'check\' : \'edit\'}');
    expect(composer).toContain('composer.menu');
  });

  it('lets a text block open an inline editor', () => {
    const list = read('journal-block-list.tsx');
    const page = read('journal-page-screen.tsx');
    expect(list).toContain('onUpdateText');
    expect(list).toContain('blockEdit');
    expect(list).toContain('autoFocus');
    expect(list).toContain('blockDelete');
    expect(list).toContain('showDelete');
    expect(list).toContain('showDeletes');
    expect(page).toContain('showDeletes={managing}');
    expect(list).not.toContain('onLongPress');
    expect(list).toContain("alignItems: 'center'");
    expect(list).not.toContain("alignItems: 'flex-start'");
    expect(list).toContain('JournalTimeChips');
    expect(list).toContain('Created ');
    expect(list).toContain('Updated ');
    expect(list).toContain('paddingTop: spacing.md');
    expect(list).toContain('onEndEdit');
    expect(list).not.toContain('onBlur={finish}');
    expect(page).toContain('dismissEdit');
    expect(page).not.toContain('keyboardDidHide');
    expect(page).toContain("dismissEdit('composer-focus')");
    expect(page).toContain('journalEditDismissFor');
  });

  it('pins the composer above the tab dock with air between them', () => {
    const page = read('journal-page-screen.tsx');
    expect(page).toContain('scroll={false}');
    expect(page).toContain('JournalComposer');
    expect(page.indexOf('JournalBlockList')).toBeLessThan(page.indexOf('JournalEarlierList'));
    const earlier = read('journal-earlier-list.tsx');
    expect(earlier).toContain('SettingsGroup');
    expect(earlier).toContain('SettingsRow');
    expect(earlier).not.toContain('JournalTimeChips');
    expect(page).toContain('paddingTop: spacing.lg');
    expect(page).toContain('tabBarHeight + composerDockGap');
    expect(page).toContain('useDockedKeyboardInset');
  });
});
