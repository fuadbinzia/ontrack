import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

describe('dock search chrome', () => {
  it('expands over mounted tabs and hosts results outside overflow-hidden barInner', () => {
    const bar = read('src/components/navigation/bottom-nav-bar.tsx');
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const dock = read('src/components/navigation/bottom-nav-dock.tsx');
    expect(bar).toContain('BottomNavSearch');
    expect(bar).toContain("pointerEvents={searchExpanded ? 'none' : 'auto'}");
    expect(bar).toContain('overflow: \'hidden\'');
    expect(dock).toContain('DockSearchOverlay');
    expect(dock).toContain("androidMode: 'resize'");
    expect(dock).toContain("androidMode: 'modal'");
    expect(dock).toContain('searchHeld');
    expect(dock).toContain('useHeldOverlay');
    expect(dock).not.toContain('<KeyboardAvoidingView');
    expect(dock).not.toContain('SheetScaffold');
    expect(search).toContain('delayLongPress');
    expect(search).toContain('GlassPlate');
    expect(search).not.toContain('mist');
    expect(search).toContain('AgentUiIds.tabs.search');
    expect(search).toContain('AgentUiIds.tabs.searchField');
    expect(search).not.toContain('surface="solid"');
    expect(bar).not.toContain('surface="solid"');
  });

  it('hides tab dock chrome when search is expanded without remounting the field', () => {
    const bar = read('src/components/navigation/bottom-nav-bar.tsx');
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const dock = read('src/components/navigation/bottom-nav-dock.tsx');
    const overlay = read('src/features/search/dock-search-overlay.tsx');
    expect(bar).toContain('useHeldOverlay(!searchExpanded, motion.chrome)');
    expect(bar).toContain('chromeFade');
    expect(bar).toContain('tabsFade');
    expect(bar).toMatch(
      /opacity: interpolate\(searchProgress\.value, \[0, 1\], \[1, 0\]\)/,
    );
    expect(bar).toMatch(/style=\{\[StyleSheet\.absoluteFill, chromeFade\]\}/);
    expect(bar).toContain('{chromeHeld ? (');
    expect(bar).toContain('accessibilityElementsHidden={searchExpanded}');
    expect(bar).toContain('<BlurView');
    expect(bar).toContain('glassMaterials.nav.darkFillSolid');
    expect(bar).toContain("pointerEvents={searchExpanded ? 'none' : 'auto'}");
    expect(bar).toContain('BottomNavSearch');
    expect(bar).not.toMatch(/<BottomNavSearch[^>]*\bkey=/);
    expect(search).toContain('GlassPlate');
    expect(search).not.toContain('surface="solid"');
    expect(dock).toContain('DockSearchOverlay');
    expect(overlay).toContain('theme.overlayScrim');
    expect(overlay).toContain(
      'Boolean(query.trim()) && groups.some((group) => group.items.length > 0)',
    );
  });

  it('collapses when a modal sheet opens', () => {
    const bar = read('src/components/navigation/bottom-nav-bar.tsx');
    const overlay = read('src/features/search/dock-search-overlay.tsx');
    expect(bar).toContain('if (modalSheetOpen) collapseSearch()');
    expect(overlay).toContain('if (modalSheetOpen) collapse()');
  });

  it('grows the expanded search field to three lines then scrolls inside', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const bar = read('src/components/navigation/bottom-nav-bar.tsx');

    expect(search).toContain("from '@/features/search/dock-search-layout'");
    expect(search).toContain('DOCK_SEARCH_LAYOUT');
    expect(search).toContain('DOCK_SEARCH_INPUT_MAX_LINES');
    expect(search).toContain('dockSearchFieldHeightForLineCount');
    expect(search).toContain('dockSearchWrappedLineCount');
    expect(search).toContain('multiline={expandLayout}');
    expect(search).toContain("const expandLayout = DOCK_SEARCH_LAYOUT === 'expand'");
    expect(search).toContain('scrollEnabled={expandLayout}');
    expect(search).not.toContain('scrollEnabled={inputShouldScroll}');
    expect(search).toContain('onContentSizeChange={onContentSizeChange}');
    expect(search).toContain('setFieldHeight');
    expect(search).toContain('blurOnSubmit');
    expect(search).toContain('height: fieldShellHeight');
    expect(search).not.toContain('height: expandLayout ? grownHeight');
    expect(search).toContain('bottom: 0');
    expect(search).not.toMatch(/alignItems:\s*['"]flex-start['"]/);
    expect(search).toContain('GlassPlate');
    expect(search).not.toContain('surface="solid"');
    expect(search).not.toContain('backgroundElevated');

    expect(bar).toContain('dockSearchBarHeight');
    expect(bar).toContain('collapsedBarHeight');
    expect(bar).toContain('fieldHeight: searchFieldHeight');
    expect(bar).toContain('expanded: searchExpanded');
  });

  it('keeps a compact single-line field when DOCK_SEARCH_LAYOUT is compact', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const bar = read('src/components/navigation/bottom-nav-bar.tsx');
    expect(search).toContain("DOCK_SEARCH_LAYOUT === 'expand'");
    expect(search).toMatch(
      /const expandLayout = DOCK_SEARCH_LAYOUT === 'expand'/,
    );
    expect(search).toContain('multiline={expandLayout}');
    expect(search).toMatch(
      /fieldShellHeight = expandLayout && expanded \? grownHeight : well/,
    );
    expect(search).toContain('scrollEnabled={expandLayout}');
    expect(search).toContain('setLineCount');
    expect(search).toContain('dockSearchWrappedLineCount');
    expect(bar).toContain('dockSearchBarHeight({');
  });

  it('does not bind the TextInput frame to raw contentSize while typing', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    expect(search).toContain('height: fieldShellHeight');
    expect(search).toContain('scrollEnabled={expandLayout}');
    expect(search).toContain('fieldInputStyle');
    expect(search).not.toContain('setContentHeight');
    expect(search).not.toMatch(/height:\s*expandLayout \? grownHeight/);
    expect(search).not.toContain('contentSize.height +');
    expect(search).not.toContain("alignSelf: 'center'");
  });

  it('shows Stop and elapsed while listening instead of the microphone', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    expect(search).toContain('listening');
    expect(search).toContain('listenStartedAt');
    expect(search).toContain('requestStop');
    expect(search).toContain('icon="stop"');
    expect(search).toContain('AgentUiIds.tabs.searchStop');
    expect(search).toContain('accessibilityLabel="Stop"');
    expect(search).toContain('formatVoiceDuration');
    expect(search).toContain('listenElapsedMs');
    expect(search).toContain('LISTEN_TICK_MS');
    expect(search).toContain("fontVariant: ['tabular-nums']");
    expect(search).toContain('icon="microphone"');
    expect(search).toContain('AgentUiIds.tabs.searchMic');
    const stopIndex = search.indexOf('icon="stop"');
    const micIndex = search.lastIndexOf('icon="microphone"');
    expect(stopIndex).toBeGreaterThan(-1);
    expect(micIndex).toBeGreaterThan(stopIndex);
    expect(search).toMatch(/listening \? \([\s\S]*icon="stop"[\s\S]*icon="microphone"/);
    expect(search).not.toMatch(/listening[\s\S]{0,200}requestMic/);
  });
});
