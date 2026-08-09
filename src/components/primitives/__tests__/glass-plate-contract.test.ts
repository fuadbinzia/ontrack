import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

describe('glass plate contract', () => {
  it('keeps TravelHomeGlass as a thin alias of GlassPlate', () => {
    const alias = read('src/features/travel/travel-home-glass.tsx');
    expect(alias).toContain('GlassPlate as TravelHomeGlass');
    expect(alias).toContain('@/components/primitives/glass-plate');
  });

  it('gates IconButton and GlassPlate blur with allowsBlur', () => {
    const button = read('src/components/primitives/button.tsx');
    const plate = read('src/components/primitives/glass-plate.tsx');
    expect(button).toContain('usePerformanceTier');
    expect(button).toContain('allowsBlur');
    expect(button).toContain('appearance = \'glass\'');
    expect(plate).toContain('allowsBlur');
    expect(plate).toContain('intensity={');
    expect(plate).toContain(': 0');
    // BlurView is a direct sibling underlay (not nested in another absoluteFill —
    // nested absolute BlurView has escaped bounds and stolen hits on iOS).
    expect(plate).toMatch(
      /<BlurView[\s\S]*?pointerEvents="none"[\s\S]*?style=\{StyleSheet\.absoluteFill\}/,
    );
  });

  it('defaults Card and SettingsGroup to glass surfaces', () => {
    const card = read('src/components/primitives/card.tsx');
    const settings = read('src/components/primitives/settings-group.tsx');
    const danger = read('src/components/primitives/danger-zone.tsx');
    const developer = read('src/features/account/developer-hub.tsx');
    expect(card).toContain("surface = 'glass'");
    expect(card).toContain('GlassPlate');
    expect(settings).toContain("surface = 'glass'");
    expect(settings).toContain('GlassPlate');
    expect(settings).not.toContain("overflow: 'hidden'");
    expect(danger).toContain('GlassPlate');
    expect(danger).not.toContain('backgroundElevated');
    expect(danger).not.toContain("overflow: 'hidden'");
    // Developer Tools panels — airy frost cards + SettingsGroup (no bare paper rows).
    expect(developer).toContain('<Card airy');
    expect(developer).toContain('SettingsGroup');
    expect(developer).not.toContain("surface=\"solid\"");
    const dsGallery = read('src/features/design-system/design-system-gallery.tsx');
    const dsCatalog = read('src/features/design-system/design-system-catalog-panel.tsx');
    const dsIcons = read('src/features/design-system/design-system-icons-panel.tsx');
    expect(dsGallery).not.toContain('backgroundSunken');
    expect(dsGallery).toContain("value: 'elements'");
    expect(dsCatalog).toContain('GlassPlate');
    expect(dsCatalog).toContain('DESIGN_CATALOG_GROUP_LABELS');
    expect(dsCatalog).not.toContain('backgroundSecondary');
    expect(dsCatalog).not.toContain('catalogView');
    expect(dsIcons).toContain('mist');
    expect(dsIcons).not.toContain('backgroundSunken');
  });

  it('ships shared glass chrome helpers for pills, wells, and meta chips', () => {
    const index = read('src/components/primitives/index.ts');
    const pill = read('src/components/primitives/glass-tone-pill.tsx');
    const well = read('src/components/primitives/glass-icon-well.tsx');
    const chip = read('src/components/primitives/glass-meta-chip.tsx');
    const badge = read('src/components/primitives/status-badge.tsx');
    const settingsRow = read('src/components/primitives/settings-row.tsx');
    expect(index).toContain('GlassTonePill');
    expect(index).toContain('GlassIconWell');
    expect(index).toContain('GlassMetaChip');
    expect(index).toContain('GlassSwitch');
    expect(pill).toContain('mist');
    expect(well).toContain("variant = 'mist'");
    // Icon wells: white frost rim (not graphite mistLight paper wash on cream cards).
    expect(well).toContain('border.lightAiry');
    expect(well).toContain('mistTintLight');
    expect(well).not.toContain('mistLightSolid');
    expect(chip).toContain('mist');
    expect(chip).toMatch(/chip:\s*\{[^}]*justifyContent:\s*['"]center['"]/s);
    expect(chip).toMatch(/content:\s*\{[^}]*justifyContent:\s*['"]center['"]/s);
    expect(pill).toMatch(/pill:\s*\{[^}]*justifyContent:\s*['"]center['"]/s);
    expect(badge).toContain('GlassTonePill');
    expect(settingsRow).toContain('GlassIconWell');
    expect(settingsRow).toContain('GlassSwitch');
    expect(settingsRow).not.toMatch(/import\s*\{[^}]*\bSwitch\b/);
    expect(settingsRow).not.toContain('backgroundColor: theme.accentFaint');
    const glassSwitch = read('src/components/primitives/glass-switch.tsx');
    expect(glassSwitch).not.toContain('BlurView');
    expect(glassSwitch).toContain('withTiming');
    // Off track = shared cool mist wash on cream SettingsGroup (not milky paper).
    expect(glassSwitch).toContain('glassMistWashStyle.onLight');
    expect(glassSwitch).toContain('border.mistLight');
    expect(glassSwitch).not.toContain("rgba(255, 255, 255, 0.28)");
    const fieldIcon = read('src/components/primitives/field-leading-icon.tsx');
    const tripActions = read('src/features/travel/travel-list-actions.tsx');
    expect(fieldIcon).toContain('GlassIconWell');
    expect(fieldIcon).toContain('mist GlassIconWell owns the material');
    expect(tripActions).toContain('GlassIconWell');
    expect(tripActions).not.toContain('backgroundColor: iconTone.bg');
  });

  it('defaults Button and SegmentedControl to GlassPlate chrome', () => {
    const button = read('src/components/primitives/button.tsx');
    const segments = read('src/components/primitives/segmented-control.tsx');
    expect(button).toContain("appearance = 'glass'");
    expect(button).toContain('GlassPlate');
    expect(segments).toContain('GlassPlate');
    expect(segments).not.toContain('theme.backgroundSunken');
  });

  it('keeps checklist hub cards and composer on GlassPlate', () => {
    const card = read('src/features/todos/todo-list-card.tsx');
    const overview = read('src/features/todos/todo-lists-overview.tsx');
    expect(card).toContain('GlassPlate');
    expect(card).not.toContain('backgroundColor: theme.backgroundElevated');
    expect(overview).toContain('GlassPlate');
    expect(overview).not.toContain('backgroundColor: theme.backgroundSunken');
  });

  it('keeps app launch Loading onTrack shell on glass atmosphere', () => {
    const layout = read('src/app/_layout.tsx');
    const bootLoader = read('src/features/auth/app-boot-loader.tsx');
    const boot = layout.match(
      /if \(!hydrated \|\| phase === 'loading'\) \{([\s\S]*?)\n  \}/,
    )?.[1];
    expect(boot).toBeTruthy();
    expect(boot).toContain('ScreenAtmosphere');
    expect(boot).toContain('AppBootLoader');
    expect(boot).not.toContain('backgroundPrimary');
    expect(boot).not.toContain('surface="glass"');
    expect(bootLoader).toContain('Loading onTrack');
    expect(bootLoader).toContain('GlassPlate');
    expect(bootLoader).toContain('mist');
    expect(bootLoader).toContain('allowsLoopMotion');
  });

  it('keeps Home location sheet and Add Event assistant on glass atmosphere', () => {
    const home = read('src/features/daily-tracking/home-location-sheet.tsx');
    const avatar = read('src/features/account/profile-avatar-editor-sheet.tsx');
    const activity = read('src/app/activity-form.tsx');
    const layout = read('src/app/_layout.tsx');
    const scaffold = read('src/components/primitives/sheet-scaffold.tsx');
    expect(home).toContain('SheetScaffold');
    expect(home).toContain("surface=\"glass\"");
    expect(home).toContain('GlassPrimaryAction');
    expect(home).toContain('glassFieldBackground');
    expect(home).not.toContain('presentationStyle="pageSheet"');
    expect(home).not.toContain('backgroundColor: theme.backgroundPrimary');
    expect(avatar).toContain('SheetScaffold');
    expect(avatar).toContain("surface=\"glass\"");
    expect(avatar).toContain('GlassPrimaryAction');
    expect(avatar).toContain('SegmentedControl');
    expect(avatar).toContain('glassFieldBackground');
    expect(avatar).not.toContain('presentationStyle="pageSheet"');
    expect(avatar).not.toContain('backgroundColor: theme.backgroundPrimary');
    expect(scaffold).toContain('ScreenAtmosphere');
    expect(scaffold).toContain('scrollEnabled');
    const sections = read('src/app/activity-form-sections.tsx');
    expect(activity).toContain('GlassPlate');
    expect(activity).toContain('ScreenAtmosphere');
    expect(activity).toContain('GlassPrimaryAction');
    expect(activity).toContain('glassFieldBackground');
    expect(activity).toContain('glassFieldBorder');
    expect(activity).not.toContain('backgroundColor: theme.backgroundSunken');
    expect(activity).not.toContain('backgroundColor: theme.accentFaint');
    expect(sections).toContain('GlassPlate');
    expect(sections).toContain('airy');
    expect(sections).toContain('fieldBorderColor');
    expect(layout).toMatch(
      /name="activity-form"[\s\S]*?backgroundColor: 'transparent'/,
    );
  });

  it('ships shared field and atmosphere tokens with visible wash chroma', () => {
    const glass = read('src/design-system/glass.ts');
    const atmosphere = read('src/components/primitives/screen-atmosphere.tsx');
    const plate = read('src/components/primitives/glass-plate.tsx');
    expect(glass).toContain('glassFieldBackground');
    expect(glass).toContain('atmosphere');
    expect(glass).toContain('accentGreen');
    expect(glass).toContain('lightOrb');
    expect(glass).toContain('mistBlur');
    expect(glass).toContain('invertedAiryBlur');
    expect(glass).toContain('glassMistWashStyle');
    expect(glass).toContain('colorWithAlpha');
    expect(plate).toContain('mist?: boolean');
    expect(plate).toContain('mistTint');
    expect(plate).toContain('mistTintLight');
    expect(plate).toContain('glassMistWashStyle');
    expect(glass).toContain('mistLightSolid');
    expect(plate).toContain('androidTintInvertedAiry');
    // Nested mist never mounts BlurView — clipped parents paint white milk on iOS.
    expect(plate).toMatch(/if \(mist\) \{[\s\S]*?mistTintLight/);
    expect(plate).toContain('never mounts BlurView');
    expect(atmosphere).toContain('orb');
    expect(atmosphere).toContain('LinearGradient');
    expect(atmosphere).toContain('radial-gradient');
    expect(atmosphere).toContain('useScreenAtmosphereChrome');
    expect(atmosphere).toContain('useSafeAreaChromeOverlay');
  });

  it('keeps Vision Board consolidated chips and cards on airy glass', () => {
    const card = read('src/features/vision-board/consolidated-card.tsx');
    const consolidated = read(
      'src/features/vision-board/vision-board-consolidated.tsx',
    );
    expect(card).toContain('GlassPlate');
    expect(card).toContain('airy');
    expect(card).not.toContain("backgroundColor: '#303636'");
    expect(card).not.toContain("backgroundColor: selected ? '#9A7654'");
    expect(card).not.toContain('LinearGradient');
    expect(consolidated).not.toContain('background="transparent"');
    expect(consolidated).toContain('consolidatedSearch');
  });

  it('keeps Vision Board dashboard categories on airy GlassPlate', () => {
    const dashboard = read('src/features/vision-board/vision-board-dashboard.tsx');
    expect(dashboard).toContain('<Card');
    expect(dashboard).toContain('airy');
    expect(dashboard).toContain('GlassPlate');
    expect(dashboard).not.toContain('categoryCardWrap');
    expect(dashboard).not.toContain('background={theme.backgroundPrimary}');
    expect(dashboard).not.toContain('background={theme.success}');
  });

  it('keeps Calendar on frosted GlassPlate chrome', () => {
    const calendar = read('src/app/(tabs)/calendar.tsx');
    expect(calendar).toContain('GlassPlate');
    expect(calendar).not.toContain('backgroundColor: theme.backgroundSunken');
  });

  it('forbids opaque paper fills on shared product chrome shells', () => {
    const expenses = read('src/features/travel/expenses/travel-expenses-sheet.tsx');
    const share = read('src/features/travel/travel-itinerary-share-sheet.tsx');
    const importAction = read('src/features/travel/confirmation-import-action.tsx');
    const prompt = read('src/components/primitives/app-prompt.tsx');
    const dataChoice = read('src/app/auth/data-choice.tsx');
    const people = read('src/features/social/people-picker.tsx');
    const dateField = read('src/components/primitives/date-field.tsx');
    const timeField = read('src/components/primitives/time-field.ios.tsx');

    expect(expenses).toContain('GlassIconWell');
    expect(expenses).not.toContain('backgroundColor: theme.accentFaint');
    expect(expenses).not.toContain('backgroundColor: chrome.tint');
    expect(share).toContain('GlassPlate');
    expect(share).not.toContain('backgroundColor: theme.backgroundSunken');
    expect(share).not.toContain('theme.accentSoft');
    expect(importAction).toContain('GlassPlate');
    expect(importAction).not.toContain('backgroundColor: chrome.importActionBg');
    expect(prompt).toContain('GlassIconWell');
    expect(prompt).not.toContain('backgroundColor: theme.accentFaint');
    expect(dataChoice).toContain('Card airy');
    expect(dataChoice).not.toContain('backgroundColor: theme.backgroundElevated');
    expect(dataChoice).not.toContain('backgroundColor: theme.backgroundSunken');
    expect(people).not.toContain('selectedBg');
    expect(people).not.toContain('theme.accentFaint');
    expect(dateField).toContain('GlassPlate');
    expect(dateField).not.toContain('backgroundColor: theme.backgroundElevated');
    expect(timeField).toContain('GlassPlate');
    expect(timeField).not.toContain('backgroundColor: theme.backgroundElevated');
  });

  it('keeps itinerary flight journey chrome on mist glass chips', () => {
    const chrome = read('src/features/travel/flight-journey-chrome.tsx');
    const card = read('src/features/travel/flight-journey-card.tsx');
    expect(chrome).toContain('GlassMetaChip');
    expect(chrome).toContain('GlassIconWell');
    expect(chrome).not.toContain('backgroundColor: tint');
    expect(chrome).not.toContain('backgroundColor: theme.backgroundSunken');
    expect(chrome).not.toContain('travelMainCardFill');
    expect(chrome).not.toContain('durationChip');
    expect(card).toContain('GlassPlate');
    expect(card).toContain('airy');
  });

  it('keeps itinerary board chrome on shared Glass* primitives', () => {
    const node = read('src/features/travel/travel-timeline-node.tsx');
    const nodeChrome = read('src/features/travel/travel-timeline-node-chrome.tsx');
    const collapsible = read('src/features/travel/travel-collapsible-section.tsx');
    const progress = read('src/features/travel/travel-timeline-progress-chrome.tsx');
    const day = read('src/features/travel/travel-timeline-day-chrome.tsx');
    const dates = read('src/features/travel/travel-trip-dates-row.tsx');
    const summary = read('src/features/travel/travel-details-summary-card.tsx');
    const addModal = read('src/features/travel/travel-timeline-add-modal.tsx');
    const notes = read('src/features/travel/travel-item-notes-sheet.tsx');
    const actions = read('src/features/travel/travel-details-card-actions.tsx');
    const timeline = read('src/features/travel/travel-itinerary-timeline.tsx');

    expect(node).toContain('GlassIconWell');
    expect(node).toContain('GlassPlate');
    expect(node).not.toContain('backgroundColor: tint');
    expect(node).not.toContain('kindTint,');
    expect(nodeChrome).not.toContain('theme.backgroundSunken');
    expect(collapsible).toContain('GlassTonePill');
    expect(collapsible).not.toContain('backgroundColor: accent');
    expect(progress).toContain('GlassTonePill');
    expect(progress).toContain('GlassIconWell');
    expect(day).toContain('GlassMetaChip');
    expect(day).not.toContain('chipBackground');
    expect(dates).toContain('GlassMetaChip');
    expect(dates).not.toContain('travelItineraryBadgeFill');
    expect(summary).toContain('GlassIconWell');
    expect(summary).not.toContain('variant="tint"');
    expect(addModal).toContain('GlassIconWell');
    expect(addModal).not.toContain('backgroundColor: colors.tint');
    expect(notes).toContain('Card airy');
    expect(notes).not.toContain('theme.backgroundSunken');
    expect(actions).not.toContain('theme.backgroundSunken');
    expect(timeline).not.toContain('travelPanelTint');
    expect(timeline).not.toContain('#DCEAF8');
  });

  it('keeps Food components on shared Glass* primitives', () => {
    const image = read('src/components/primitives/food-image.tsx');
    const recipe = read('src/features/food/components/recipe-card.tsx');
    const stat = read('src/features/food/components/nutrition-stat.tsx');
    const safety = read('src/features/food/components/ingredient-safety-row.tsx');
    const country = read('src/features/food/components/country-restriction-row.tsx');
    const stack = read('src/features/food/components/avatar-stack.tsx');
    const sheet = read('src/features/food/food-sheet.tsx');

    expect(image).toContain('GlassPlate');
    expect(image).toContain('mist');
    expect(recipe).toContain('FoodImage');
    expect(recipe).toContain('Card');
    expect(stat).toContain('GlassPlate');
    expect(stat).toContain('mist');
    expect(safety).toContain('GlassIconWell');
    expect(safety).toContain('StatusBadge');
    expect(country).toContain('GlassMetaChip');
    expect(country).toContain('GlassIconWell');
    expect(stack).toContain('GlassPlate');
    expect(sheet).toContain('SheetScaffold');
    expect(sheet).toContain('surface="glass"');
    // No opaque paper fills or hand-rolled blur geometry in Food chrome.
    for (const src of [image, recipe, stat, safety, country, stack, sheet]) {
      expect(src).not.toContain('backgroundElevated');
      expect(src).not.toContain('backgroundSunken');
      expect(src).not.toContain('accentFaint');
      expect(src).not.toContain('BlurView');
    }
  });

  it('keeps Today weather/empty CTA/FAB on frosted glass', () => {
    const header = read('src/features/daily-tracking/day-header.tsx');
    const dayView = read('src/features/daily-tracking/day-view.tsx');
    const empty = read('src/components/primitives/empty-state.tsx');
    expect(header).toContain('airy');
    expect(header).toContain("'transparent'");
    expect(header).not.toContain('background="transparent"');
    expect(empty).toContain('GlassPlate');
    expect(empty).not.toContain('variant="secondary"');
    expect(dayView).not.toContain('background={theme.accentPrimary}');
    expect(dayView).not.toContain('shadows.raised');
  });
});
