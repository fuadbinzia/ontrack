import { appIcons, appIconSections, type AppIconName } from '@/design-system/icons';

describe('appIconSections', () => {
  it('uses backpack glyphs for the travel packing icon on every platform', () => {
    expect(appIcons.backpack).toEqual({
      ios: 'backpack.fill',
      android: 'backpack',
      web: 'backpack',
    });
    expect('suitcase' in appIcons).toBe(false);
  });

  it('covers every app icon exactly once', () => {
    const seen = new Set<string>();
    for (const section of appIconSections) {
      for (const name of section.icons) {
        expect(appIcons[name as AppIconName]).toBeDefined();
        expect(seen.has(name)).toBe(false);
        seen.add(name);
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(appIcons).sort());
  });

  it('uses a file-upload glyph that stays distinct from sharing', () => {
    expect(appIcons.upload).toEqual({
      ios: 'tray.and.arrow.up.fill',
      android: 'upload_file',
      web: 'upload_file',
    });
    expect(appIcons.upload).not.toEqual(appIcons.share);
  });
});
