import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (name: string) =>
  readFileSync(join(__dirname, '..', name), 'utf8');

const route = (name: string) =>
  readFileSync(join(__dirname, '../../../app/(tabs)/journal', name), 'utf8');

describe('journal landing', () => {
  it('lists written pages on a scenic hub and opens dated pages from there', () => {
    const hub = read('journal-hub.tsx');
    const atmosphere = read('journal-landing-atmosphere.tsx');
    const empty = read('journal-landing-empty.tsx');
    const pages = read('journal-landing-pages.tsx');
    const page = read('journal-page-screen.tsx');
    const dateRoute = route('[date].tsx');

    expect(hub).toContain('useJournalLandingAtmosphere');
    expect(hub).toContain('writtenJournalPages');
    expect(hub).toContain('JournalLandingEmpty');
    expect(hub).toContain('JournalLandingPages');
    expect(hub).toContain("backgroundColor: 'transparent'");
    expect(hub).not.toContain('JournalPageScreen');

    expect(atmosphere).toContain('useSafeAreaChrome(');
    expect(atmosphere).toContain('backgroundImage: JOURNAL_HOME_ATMOSPHERE');
    expect(atmosphere).toContain('journal-home-atmosphere.jpg');

    expect(empty).toContain('GlassPlate');
    expect(empty).toContain('journal.openToday');
    expect(empty).toContain("Start Today's Journal");
    expect(empty).not.toContain('SettingsRow');

    expect(pages).toContain('Card');
    expect(pages).toContain('airy');
    expect(pages).toContain('Your Pages');
    expect(pages).toContain('journal.openToday');
    expect(pages).toContain('journal.page');
    expect(pages).not.toContain('SettingsRow');

    expect(page).toContain('HeaderBackButton');
    expect(page).toContain("useJournalLandingAtmosphere({ variant: 'page' })");
    expect(page).toContain('JournalPageEmpty');
    expect(page).toContain("backgroundColor: 'transparent'");
    expect(page).not.toContain('showEarlier');
    expect(page).not.toContain('JournalEarlierList');
    expect(page).not.toContain('EmptyState');
    expect(dateRoute).not.toContain('todayKey()');
    expect(dateRoute).toContain('JournalPageScreen');
  });

  it('keeps empty days off the landing and still opens today from the hub', () => {
    const model = read('model.ts');
    expect(model).toContain('writtenJournalPages');
    expect(model).toContain('page.blocks.length > 0');
    expect(model).toContain('`/(tabs)/journal/${dateKey}`');
    expect(model).not.toContain("dateKey >= today ? '/(tabs)/journal'");
  });

  it('keeps the dated empty quiet and on the same meadow as the landing', () => {
    const atmosphere = read('journal-landing-atmosphere.tsx');
    const empty = read('journal-page-empty.tsx');
    const list = read('journal-block-list.tsx');

    expect(atmosphere).toContain("variant?: JournalAtmosphereVariant");
    expect(atmosphere).toContain("variant === 'page' ? 10 : 0");
    expect(empty).toContain('journal.empty');
    expect(empty).toContain('Today is waiting.');
    expect(empty).toContain('This page is waiting.');
    expect(empty).toContain('journalLandingFontFamily');
    expect(empty).not.toContain('EmptyState');
    expect(list).not.toContain('EmptyState');
    expect(list).not.toContain('Today Is Open');
  });
});
