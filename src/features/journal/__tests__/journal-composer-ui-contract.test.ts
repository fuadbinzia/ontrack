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
    expect(composer).toContain('GlassPlate');
    expect(composer).toContain('placeholderTextColor={theme.textSecondary}');
    expect(composer).toContain('fieldBackground="transparent"');
    expect(composer).toContain('color={canSend ? theme.textOnAccent : theme.textSecondary}');
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

  it('shows a live capture surface while recording and transcribing', () => {
    const composer = read('journal-composer.tsx');
    // Recording swaps the input for a wave + elapsed + stop row in the pill.
    expect(composer).toContain('JournalRecordingWave');
    expect(composer).toContain('composer.wave');
    expect(composer).toContain('composer.stop');
    expect(composer).toContain('Transcribing…');
    // Dictation lands in the draft for review — never straight onto the page.
    expect(composer).toContain('mergeDictationIntoDraft');
    expect(composer).not.toContain('addText(dateKey, text)');
    // Crossfade is a stable shell; the hidden layer must not trap taps.
    expect(composer).toContain("pointerEvents={overlayActive ? 'none' : 'auto'}");
    expect(composer).toContain("pointerEvents={overlayActive ? 'auto' : 'none'}");

    const wave = read('journal-recording-wave.tsx');
    // The 10Hz poll stays in the leaf so the page does not re-render per tick.
    expect(wave).toContain('useJournalRecorderLiveState');
    expect(wave).toContain('formatVoiceDuration');
    expect(wave).toContain('tabular-nums');
  });

  it('locks day navigation while a take is recording or settling', () => {
    const page = read('journal-page-screen.tsx');
    // Flipping days mid-capture strands the recording on the wrong date.
    expect(page).toContain('const navLocked = composer.recording || composer.busy');
    expect(page).toContain('disabled={navLocked}');
    expect(page).toContain(
      'disabled={navLocked || !canShiftJournalDate(dateKey, 1, today)}',
    );
  });

  it('pins the composer above the tab dock with air between them', () => {
    const page = read('journal-page-screen.tsx');
    expect(page).toContain('scroll={false}');
    expect(page).toContain('JournalComposer');
    expect(page).not.toContain('JournalEarlierList');
    expect(page).toContain('paddingTop: spacing.lg');
    expect(page).toContain('tabBarHeight + composerDockGap');
    expect(page).toContain('useDockedKeyboardInset');
  });
});
