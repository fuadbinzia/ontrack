import { DEFAULT_ADDON_STATE } from '@/addons/registry';

import {
  canShiftJournalDate,
  commitJournalTextEdit,
  journalBlockTimeParts,
  journalEditDismissFor,
  earlierJournalPages,
  formatJournalClock,
  formatVoiceDuration,
  isJournalDateKey,
  emptyJournalTextHistory,
  journalIndexTime,
  journalPageHref,
  popJournalTextRedo,
  popJournalTextUndo,
  pushJournalTextEdit,
  journalSectionLinks,
  normalizeJournalBlock,
  normalizeJournalPages,
  pageForDate,
  pagePreview,
  shiftJournalDate,
} from '../model';
import type { JournalPage } from '../types';

const stamp = '2026-08-15T12:00:00.000Z';

const page = (
  dateKey: string,
  blocks: JournalPage['blocks'] = [],
): JournalPage => ({
  id: `page-${dateKey}`,
  dateKey,
  blocks,
  createdAt: '2026-08-15T12:00:00.000Z',
  updatedAt: '2026-08-15T12:00:00.000Z',
});

describe('journal model', () => {
  it('steps to the previous day and stops forward on today', () => {
    expect(shiftJournalDate('2026-08-15', -1, '2026-08-15')).toBe('2026-08-14');
    expect(shiftJournalDate('2026-08-15', 1, '2026-08-15')).toBe('2026-08-15');
    expect(shiftJournalDate('2026-08-14', 1, '2026-08-15')).toBe('2026-08-15');
    expect(canShiftJournalDate('2026-08-15', 1, '2026-08-15')).toBe(false);
    expect(canShiftJournalDate('2026-08-14', 1, '2026-08-15')).toBe(true);
    expect(canShiftJournalDate('2026-08-15', -1, '2026-08-15')).toBe(true);
    expect(journalPageHref('2026-08-15', '2026-08-15')).toBe('/(tabs)/journal');
    expect(journalPageHref('2026-08-14', '2026-08-15')).toBe('/(tabs)/journal/2026-08-14');
  });

  it('accepts date keys and looks up a page', () => {
    expect(isJournalDateKey('2026-08-15')).toBe(true);
    expect(isJournalDateKey('08-15-2026')).toBe(false);
    const pages = [page('2026-08-14'), page('2026-08-15')];
    expect(pageForDate(pages, '2026-08-15')?.id).toBe('page-2026-08-15');
  });

  it('lists earlier pages newest first and skips today and empty days', () => {
    const note = (id: string, text: string): JournalPage['blocks'] => [
      { id, kind: 'text', text, createdAt: stamp, updatedAt: stamp },
    ];
    const pages = [
      page('2026-08-13', note('t1', 'Wed')),
      page('2026-08-15', note('t2', 'Today')),
      page('2026-08-14'),
      page('2026-08-12', note('t3', 'Tue')),
    ];
    expect(earlierJournalPages(pages, '2026-08-15').map((entry) => entry.dateKey)).toEqual([
      '2026-08-13',
      '2026-08-12',
    ]);
  });

  it('filters section links to enabled add-ons and never includes More', () => {
    const enabled = { ...DEFAULT_ADDON_STATE, travel: false, journal: true };
    const links = journalSectionLinks(enabled);
    expect(links.some((link) => link.section === 'trackers')).toBe(false);
    expect(links.some((link) => link.section === 'travel')).toBe(false);
    expect(links.some((link) => link.section === 'to-do')).toBe(true);
    expect(links.some((link) => link.section === 'journal')).toBe(false);
    expect(links.find((link) => link.section === 'to-do')?.label).toBe('Checklists');
  });

  it('previews text first, then voice, then a link, then empty', () => {
    expect(pagePreview(page('2026-08-15'))).toBe('Empty page');
    expect(
      pagePreview(
        page('2026-08-15', [
          { id: 'v1', kind: 'voice', uri: 'file://a.m4a', durationMs: 1000, createdAt: stamp, updatedAt: stamp },
        ]),
      ),
    ).toBe('Voice note');
    expect(
      pagePreview(
        page('2026-08-15', [
          { id: 'l1', kind: 'link', section: 'travel', label: 'Travel', createdAt: stamp, updatedAt: stamp },
        ]),
      ),
    ).toBe('Travel');
    expect(
      pagePreview(
        page('2026-08-15', [
          { id: 't1', kind: 'text', text: '  Hello  ', createdAt: stamp, updatedAt: stamp },
        ]),
      ),
    ).toBe('Hello');
    expect(formatVoiceDuration(1250)).toBe('0:01');
    expect(formatVoiceDuration(61_000)).toBe('1:01');
  });

  it('does not dismiss the keyboard when the composer field focuses', () => {
    expect(journalEditDismissFor('composer-focus')).toEqual({
      endBlockEdit: true,
      hideKeyboard: false,
    });
    expect(journalEditDismissFor('tap-out')).toEqual({
      endBlockEdit: true,
      hideKeyboard: true,
    });
  });

  it('commits a changed text edit and ignores empty or unchanged drafts', () => {
    expect(commitJournalTextEdit('  Later  ', 'Morning')).toBe('Later');
    expect(commitJournalTextEdit('Morning', 'Morning')).toBeUndefined();
    expect(commitJournalTextEdit('   ', 'Morning')).toBeUndefined();
    expect(commitJournalTextEdit('Morning', 'Later')).toBe('Morning');
  });

  it('stacks text edits and clears redo when a new edit lands', () => {
    const first = { blockId: 't1', before: 'Morning', after: 'Later' };
    const second = { blockId: 't1', before: 'Later', after: 'Night' };
    let history = pushJournalTextEdit(emptyJournalTextHistory(), first);
    history = pushJournalTextEdit(history, second);
    const undone = popJournalTextUndo(history);
    expect(undone.edit).toEqual(second);
    expect(undone.history.undo).toEqual([first]);
    const redone = popJournalTextRedo(undone.history);
    expect(redone.edit).toEqual(second);
    expect(redone.history.redo).toEqual([]);
    const replaced = pushJournalTextEdit(undone.history, {
      blockId: 't1',
      before: 'Later',
      after: 'Dawn',
    });
    expect(replaced.redo).toEqual([]);
    expect(popJournalTextUndo(emptyJournalTextHistory()).edit).toBeUndefined();
    expect(popJournalTextRedo(emptyJournalTextHistory()).edit).toBeUndefined();
  });

  it('stamps missing block times and hides Updated when it matches Created', () => {
    const fallback = '2026-08-15T08:00:00.000Z';
    expect(
      normalizeJournalBlock({ id: 't1', kind: 'text', text: 'Hi' }, fallback),
    ).toEqual({
      id: 't1',
      kind: 'text',
      text: 'Hi',
      createdAt: fallback,
      updatedAt: fallback,
    });
    const [page] = normalizeJournalPages([
      {
        id: 'page-1',
        dateKey: '2026-08-15',
        createdAt: fallback,
        updatedAt: fallback,
        blocks: [{ id: 't1', kind: 'text', text: 'Hi' } as never],
      },
    ]);
    expect(page.blocks[0]).toMatchObject({ createdAt: fallback, updatedAt: fallback });

    expect(formatJournalClock('not-a-date')).toBe('');
    expect(formatJournalClock(stamp)).toMatch(/\d/);
    expect(journalBlockTimeParts({ createdAt: stamp, updatedAt: stamp }).updated).toBeNull();
    expect(
      journalBlockTimeParts({
        createdAt: stamp,
        updatedAt: '2026-08-15T12:05:00.000Z',
      }).updated,
    ).toMatch(/\d/);
    expect(journalBlockTimeParts({}).created).toBe('');
    expect(journalIndexTime({ createdAt: stamp, updatedAt: stamp })).toMatch(/\d/);
    expect(
      journalIndexTime({
        createdAt: stamp,
        updatedAt: '2026-08-15T12:05:00.000Z',
      }),
    ).not.toBe(journalIndexTime({ createdAt: stamp, updatedAt: stamp }));
  });
});
