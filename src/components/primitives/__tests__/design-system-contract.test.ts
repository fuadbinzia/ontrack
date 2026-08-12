import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

describe('canonical design-system contract', () => {
  it('exports the shared composition primitives', () => {
    const barrel = read('src/components/primitives/index.ts');
    for (const name of [
      'ScreenHeader',
      'SegmentedControl',
      'FormSection',
      'SheetGrabber',
      'SheetScaffold',
      'DestructiveSection',
      'DangerZone',
      'StackedFieldLabel',
      'PanelTitle',
      'StatusBadge',
      'MetaList',
      'CollapsibleBody',
      'CollapsibleSection',
      'DisclosureChevron',
      'ToolbarRow',
      'ActionChip',
      'ActionChipRow',
      'Dropdown',
      'fieldTitleCase',
    ]) {
      expect(barrel).toContain(name);
    }
  });

  it('uses SheetGrabber for bottom-sheet dismiss chrome (not header X)', () => {
    const sheet = read('src/components/primitives/sheet-scaffold.tsx');
    expect(sheet).toContain('SheetGrabber');
    expect(sheet).toMatch(/function SheetHeader[\s\S]*?<SheetGrabber/);
    expect(sheet).not.toMatch(
      /function SheetHeader[\s\S]*?onClose=\{close\}[\s\S]*?<\/ScreenHeader>/,
    );
    expect(sheet).toContain('GestureHandlerRootView');
    expect(sheet).toContain('GestureDetector');
    expect(sheet).toContain('useSheetDismissPan');
    expect(sheet).toContain('grabberInteractive={false}');
    expect(
      read('src/components/primitives/use-sheet-dismiss-pan.ts'),
    ).toContain('Gesture.Exclusive');
    expect(
      read('src/features/travel/travel-itinerary-add-sheet.tsx'),
    ).toContain('useSheetDismissPan');
    expect(read('src/features/travel/travel-sheet.tsx')).toContain(
      'SheetHeader',
    );
    expect(read('src/app/activity-form.tsx')).toContain('SheetGrabber');
    expect(read('src/features/social/social-friends-modal.tsx')).toContain(
      'SheetGrabber',
    );
    expect(read('src/features/social/social-action-modal.tsx')).toContain(
      'SheetGrabber',
    );
  });

  it('title-cases chrome titles in shared header and button primitives', () => {
    for (const relative of [
      'src/components/primitives/screen-header.tsx',
      'src/components/primitives/section-header.tsx',
      'src/components/primitives/form-section.tsx',
      'src/components/primitives/panel-title.tsx',
      'src/components/primitives/empty-state.tsx',
      'src/components/primitives/stacked-field-label.tsx',
      'src/components/primitives/settings-row.tsx',
      'src/components/primitives/button.tsx',
      'src/components/primitives/glass-primary-action.tsx',
      'src/components/primitives/action-chip.tsx',
      'src/components/primitives/app-prompt.tsx',
    ]) {
      expect(read(relative)).toContain('fieldTitleCase');
    }
  });

  it('routes stacked icon fields through StackedIconField / StackedFieldLabel', () => {
    expect(read('src/components/primitives/stacked-icon-field.tsx')).toContain(
      'StackedFieldLabel',
    );
    for (const relative of [
      'src/components/primitives/input.tsx',
      'src/components/primitives/date-field.tsx',
      'src/components/primitives/time-field.ios.tsx',
      'src/components/android/material-time-field.tsx',
    ]) {
      const source = read(relative);
      expect(source).toContain('StackedIconField');
      expect(source).not.toMatch(
        /variant="caption"[\s\S]{0,120}\{stackedLabel\}/,
      );
    }
  });

  it('keeps canonical primitives semantic and responsive', () => {
    const files = [
      'src/components/primitives/screen-header.tsx',
      'src/components/primitives/segmented-control.tsx',
      'src/components/primitives/form-section.tsx',
      'src/components/primitives/sheet-scaffold.tsx',
      'src/components/primitives/destructive-section.tsx',
    ];
    for (const relative of files) {
      const source = read(relative);
      expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(source).not.toMatch(/font(?:Size|Family|Weight)\s*:/);
      expect(source).toMatch(/useResponsive|AppText|Button|ScreenHeader/);
    }
  });

  it('fades sheet scrim separately from the sliding card', () => {
    const scaffold = read('src/components/primitives/sheet-scaffold.tsx');
    // Modal slide would drag the dim with the card — keep native anim off.
    expect(scaffold).toContain('animationType="none"');
    expect(scaffold).toContain('FadeIn');
    expect(scaffold).toContain('SlideInDown');
    expect(scaffold).toContain('springs.sheet');
    expect(scaffold).toContain('overshootClamping(1)');
    expect(scaffold).toContain('overlayScrim');
    expect(scaffold).not.toContain('animationType="slide"');
    // Exit must unmount immediately — holding Modal for exit traps touches
    // and makes the next page feel stuck.
    expect(scaffold).not.toContain('FadeOut');
    expect(scaffold).not.toContain('SlideOutDown');
    expect(scaffold).not.toContain('presented');
    // Glass is the app-wide sheet default; solid remains an escape hatch.
    expect(scaffold).toContain("surface?: 'solid' | 'glass'");
    expect(scaffold).toContain("surface = 'glass'");
    expect(scaffold).toContain('<BlurView');
    // Android edge-to-edge: Modal must draw under system bars or the plate floats.
    expect(scaffold).toContain('statusBarTranslucent');
    expect(scaffold).toContain('navigationBarTranslucent');
    // Safe-area pad on footer/body — not sheet chrome — so glass paints flush.
    expect(scaffold).toContain('bottomPad');
    expect(scaffold).toContain('paddingBottom: bottomPad');
    expect(scaffold).toContain('styles.fitContentBody');
    expect(scaffold).toMatch(/fitContent \? \(\s*<View/);
    expect(scaffold).not.toContain('styles.fitContent : null');
    expect(scaffold).not.toContain('fitContentHeight');
    expect(scaffold).not.toContain('fittedMaxHeight');
    expect(scaffold).not.toContain('fitHeaderHeight');
    // Absolute fill host — flex-end left a dock-sized gap under short plates.
    expect(scaffold).toContain('StyleSheet.absoluteFill');
    // Tab dock hides while sheets are open (labels bled through frost as a
    // fake gap); plate stays measurable via the agent-ui anchor.
    expect(scaffold).toContain('beginModalSheet');
    expect(scaffold).toContain('AgentUiIds.sheet.plate');
    expect(read('src/components/navigation/bottom-nav-bar.tsx')).toContain(
      'modalSheetCount',
    );
    expect(scaffold).not.toMatch(
      /styles\.sheet[\s\S]*paddingBottom:\s*Math\.max\(insets\.bottom/,
    );
  });

  it('exports shared glass plate and primary action', () => {
    const barrel = read('src/components/primitives/index.ts');
    expect(barrel).toContain('GlassPlate');
    expect(barrel).toContain('GlassPrimaryAction');
    const glass = read('src/design-system/glass.ts');
    expect(glass).toContain('glassMaterials');
    expect(glass).toContain('atmosphere');
  });

  it('routes Travel sheets and actions through shared primitives', () => {
    const sheet = read('src/features/travel/travel-sheet.tsx');
    const actions = read('src/features/travel/travel-list-actions.tsx');
    const photos = read('src/features/travel/travel-add-photos-modal.tsx');
    const calendar = read(
      'src/features/travel/travel-calendar-updated-modal.tsx',
    );
    const importResult = read(
      'src/features/travel/travel-import-result-modal.tsx',
    );
    const removeConfirm = read(
      'src/features/travel/travel-remove-confirm-modal.tsx',
    );
    expect(sheet).toContain('SheetScaffold');
    expect(sheet).not.toMatch(/\bModal\b/);
    expect(actions).toContain('<Button');
    expect(actions).toContain('<IconButton');
    expect(photos).toContain('SheetScaffold');
    expect(calendar).toContain('SheetScaffold');
    expect(importResult).toContain('SheetScaffold');
    expect(removeConfirm).toContain('SheetScaffold');
    expect(removeConfirm).not.toMatch(/\bModal\b/);
    expect(actions).toContain('TravelHomeGlass');
    expect(actions).not.toContain('<Card');
    expect(actions).not.toContain('numberOfLines={2}');
  });

  it('makes the Travel path obvious instead of presenting equal-weight actions', () => {
    const actions = read('src/features/travel/travel-list-actions.tsx');
    const grid = read('src/features/travel/travel-trip-action-grid.tsx');
    const body = read('src/features/travel/travel-plan-detail-body.tsx');
    expect(actions).toContain('TravelHomeGlass');
    expect(grid).toContain('label="Trip Itinerary"');
    expect(grid).toContain('title="Book & Organize"');
    expect(grid).toContain('title="At Your Destination"');
    expect(grid).toContain('title="Travel Together"');
    expect(grid).toContain('showItineraryAction');
    // Tools sit in a collapsible at the bottom of plan detail (after timeline).
    const tools = read('src/features/travel/travel-plan-trip-tools.tsx');
    expect(tools).toContain('title="Trip Tools"');
    expect(body).toContain("toggleSection('tools')");
    expect(body).toContain('TravelPlanTripTools');
    expect(body.indexOf('<TravelCollapsibleSection')).toBeLessThan(
      body.indexOf('<TravelPlanTripTools'),
    );
  });

  it('uses a single blue-to-neutral background across Travel routes', () => {
    const surface = read('src/features/travel/travel-surface.tsx');
    const travelTab = read(
      'src/features/travel/travel-home-screen-content.tsx',
    );
    const travelScreen = read('src/features/travel/use-travel-home-screen.ts');
    const atmosphereChrome = read(
      'src/features/travel/use-travel-home-atmosphere-chrome.tsx',
    );
    const travelLayout = read('src/app/(tabs)/travel/_layout.tsx');
    const rootLayout = read('src/app/_layout.tsx');
    const safeAreaChrome = read(
      'src/components/primitives/safe-area-chrome.tsx',
    );
    expect(surface).toContain('travelSafeAreaBackground');
    expect(surface).toContain('travelPagePaper');
    expect(surface).toContain('lightTravelTheme.backgroundPrimary');
    expect(surface).toContain('darkTravelTheme.backgroundPrimary');
    expect(surface).toContain('experimental_backgroundImage');
    expect(surface).not.toContain('radial-gradient');
    expect(travelTab).toContain('style={travelStyle}');
    expect(travelScreen).toContain('useTravelPageStyle(theme)');
    expect(atmosphereChrome).toContain('useSafeAreaChrome(');
    expect(atmosphereChrome).toContain('useSafeAreaChromeOverlay(');
    expect(atmosphereChrome).toContain('TravelHomeAtmosphereScrim');
    expect(travelTab).toContain('TravelHomeBackground');
    expect(atmosphereChrome).toContain('atmosphereImage.skyColor');
    expect(atmosphereChrome).toContain(
      'backgroundImage: atmosphereImage.source',
    );
    // Leaf atmosphere must outrank the travel stack layout wash.
    expect(atmosphereChrome).toContain('priority: 1');
    expect(travelLayout).toContain(
      'useSafeAreaChrome(travelSafeAreaBackground(theme))',
    );
    // Stack must stay clear of travelPageStyle's opaque CSS gradient wash.
    expect(travelLayout).toContain(
      "contentStyle: { backgroundColor: 'transparent' }",
    );
    expect(travelLayout).not.toContain('...travelStyle');
    expect(travelLayout).toContain("anchor: 'index'");
    expect(safeAreaChrome).toContain('useSafeAreaChrome');
    // Travel UI lives under (tabs)/travel so the bottom nav persists; API-only
    // routes may remain at app/travel/flights/*+api.ts.
    expect(rootLayout).not.toMatch(/name="travel"/);
    expect(rootLayout).toContain('<AppSafeArea>');
    expect(rootLayout).not.toContain('travelRoute ? travelSafeAreaStyle');
  });

  it('paints Today status-bar chrome from the time-of-day wash', () => {
    const dayHeader = read('src/features/daily-tracking/day-header.tsx');
    const themes = read('src/design-system/themes.ts');
    expect(themes).toContain('timeOfDaySafeAreaBackground');
    expect(dayHeader).toContain(
      'useSafeAreaChrome(timeOfDaySafeAreaBackground(theme, hour))',
    );
  });

  it('extends Screen page fill into the status-bar shell and tab dock', () => {
    const screen = read('src/components/primitives/screen.tsx');
    const atmosphere = read('src/components/primitives/screen-atmosphere.tsx');
    const chrome = read('src/components/primitives/safe-area-chrome.tsx');
    const dayView = read('src/features/daily-tracking/day-view.tsx');
    // Glass atmosphere paints on AppSafeArea chrome (y=0) — not clipped by SafeAreaView.
    expect(screen).toContain('useScreenAtmosphereChrome(');
    expect(atmosphere).toContain('useSafeAreaChromeOverlay(');
    expect(atmosphere).toContain('priority: -1');
    expect(screen).toContain('useSafeAreaChrome(');
    expect(screen).toContain('priority: -1');
    expect(screen).toContain('usePageSurfaceBackground(');
    expect(chrome).toContain('usePageSurfaceBackgroundColor');
    expect(dayView).toContain(
      'usePageSurfaceBackground(screenAtmosphereBottomColor(theme.name))',
    );
    // In-tree wash would stop at the safe-area edge and reintroduce the seam.
    expect(screen).not.toMatch(/\{useAtmosphere \? <ScreenAtmosphere/);
  });

  it('keeps Privacy / Terms stack chrome transparent like Profile glass atmosphere', () => {
    const rootLayout = read('src/app/_layout.tsx');
    expect(rootLayout).toContain('legalDocumentScreenOptions');
    expect(rootLayout).toContain('fallback="/(tabs)/profile"');
    expect(rootLayout).toMatch(
      /name="privacy"[^>]*legalDocumentScreenOptions\('Privacy Policy'\)/,
    );
    expect(rootLayout).toMatch(
      /name="terms"[^>]*legalDocumentScreenOptions\('Terms of Use'\)/,
    );
    const helper = rootLayout.match(
      /function legalDocumentScreenOptions[\s\S]*?\n\}/,
    )?.[0];
    expect(helper).toBeTruthy();
    expect(helper).toContain("contentStyle: { backgroundColor: 'transparent'");
    expect(helper).toContain("headerStyle: { backgroundColor: 'transparent'");
  });

  it('uses X dismissal instead of full-width Cancel actions on migrated surfaces', () => {
    const files = [
      'src/app/(tabs)/travel/index.tsx',
      'src/features/travel/travel-plan-details-editor.tsx',
      'src/features/travel/travel-details-card-actions.tsx',
      'src/features/travel/travel-add-photos-modal.tsx',
      'src/features/travel/travel-remove-confirm-modal.tsx',
      'src/features/travel/trip-people.tsx',
      'src/features/travel/trip-friend-row.tsx',
    ];
    for (const relative of files) {
      expect(read(relative)).not.toMatch(/>\s*Cancel\s*</);
    }
    expect(
      read('src/features/travel/travel-remove-confirm-modal.tsx'),
    ).toContain('closeTestID={AgentUiIds.travel.removeConfirm.close}');
  });

  it('keeps destructive actions standardized and confirmed', () => {
    expect(
      read('src/features/travel/travel-remove-confirm-modal.tsx'),
    ).toContain('variant="danger"');
    expect(read('src/features/travel/travel-add-photos-modal.tsx')).toContain(
      'confirmDestructiveAction',
    );
    expect(
      read('src/features/travel/travel-plan-details-editor.tsx'),
    ).toContain('DestructiveSection');
    expect(
      read('src/features/travel/travel-plan-details-editor.tsx'),
    ).toContain('DangerZone');
    expect(
      read('src/features/travel/travel-plan-details-editor.tsx'),
    ).toContain('descriptionAlign="center"');
    expect(
      read('src/features/travel/travel-plan-details-editor.tsx'),
    ).toContain('title={null}');
    expect(read('src/components/primitives/index.ts')).toContain('DangerZone');
    expect(read('src/app/(tabs)/profile/index.tsx')).toContain('DangerZone');
    expect(read('src/app/(tabs)/profile/index.tsx')).toContain('flush');
  });

  it('keeps the Travel chat composer cohesive and full width', () => {
    const input = read('src/components/primitives/input.tsx');
    const chat = read('src/features/travel/travel-chat-screen.tsx');
    const composer = read('src/features/travel/travel-chat-composer.tsx');
    const notes = read('src/features/travel/travel-item-notes-sheet.tsx');
    expect(input).toContain('containerStyle?: StyleProp<ViewStyle>');
    expect(chat).toContain('styles.composerArea');
    expect(composer).toContain('styles.composer');
    expect(composer).toContain("width: '100%'");
    expect(composer).toContain('containerStyle={styles.composerInput}');
    expect(composer).toContain('trailing={');
    expect(notes).toContain('trailing={');
    expect(notes).toContain('containerStyle={styles.composerInput}');
    expect(chat).toMatch(/paddingTop=\{rs\.(?:sm|md)\}/);
    expect(chat).not.toContain('paddingTop={0}');
  });

  it('ships a development-only gallery and canonical guide', () => {
    expect(read('src/app/(tabs)/profile/design-system.tsx')).toContain(
      'DevAccessGate',
    );
    const gallery = read(
      'src/features/design-system/design-system-gallery.tsx',
    );
    expect(gallery).toContain('SheetScaffold');
    expect(gallery).toContain("value: 'elements'");
    expect(gallery).toContain("value: 'demos'");
    expect(gallery).not.toContain("value: 'catalog'");
    expect(gallery).not.toContain("value: 'components'");
    expect(
      read('src/features/design-system/design-system-demos-panel.tsx'),
    ).toContain('DesignSystemComponentsPanel');
    expect(read('src/features/account/developer-hub.tsx')).toContain(
      'AgentUiIds.developer.designSystem',
    );
    expect(read('docs/design-system.md')).toContain('Consistency wins');
    expect(read('docs/design-system.md')).toContain('## Intuitive path');
    expect(read('docs/design-system.md')).toContain('browse → try → tune');
    expect(read('docs/design-system.md')).toContain('fieldTitleCase');
  });

  it('keeps product UI on the UI font (no AppText mono outside design-system)', () => {
    const { readdirSync, statSync } =
      require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const roots = ['src/features', 'src/app', 'src/components'];
    const skip = (relative: string) =>
      relative.includes('/design-system/') ||
      relative.includes('/__tests__/') ||
      relative.includes('/primitives/');

    const walk = (dir: string, out: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const relative = full.replace(`${root}/`, '');
        if (statSync(full).isDirectory()) {
          if (name === 'node_modules' || name === '.git') continue;
          walk(full, out);
          continue;
        }
        if (!/\.(tsx|ts)$/.test(name) || skip(relative)) continue;
        out.push(relative);
      }
      return out;
    };

    const offenders: string[] = [];
    for (const base of roots) {
      for (const relative of walk(join(root, base))) {
        const source = read(relative);
        if (/variant\s*=\s*["']mono["']/.test(source)) offenders.push(relative);
      }
    }
    expect(offenders).toEqual([]);
  });
});
