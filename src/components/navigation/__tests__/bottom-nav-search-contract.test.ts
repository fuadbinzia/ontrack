import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

describe('dock search chrome', () => {
  it('expands over mounted tabs and hosts results outside overflow-hidden chrome', () => {
    const bar = read('src/components/navigation/bottom-nav-bar.tsx');
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const dock = read('src/components/navigation/bottom-nav-dock.tsx');
    expect(bar).toContain('BottomNavSearch');
    expect(bar).toContain("pointerEvents={searchExpanded ? 'none' : 'auto'}");
    expect(bar).toMatch(/barInner: \{[\s\S]*overflow: 'visible'/);
    expect(bar).toMatch(/bar: \{[\s\S]*overflow: 'visible'/);
    expect(bar).toMatch(/chromeClip: \{[\s\S]*overflow: 'hidden'/);
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
    expect(bar).toMatch(/style=\{\[StyleSheet\.absoluteFill,[\s\S]*chromeFade\]\}/);
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
    expect(overlay).toContain('<BlurView');
    expect(overlay).toContain('LinearGradient');
    expect(overlay).toContain('dockSearchBackdropGradientColors');
    expect(overlay).toContain('backdropStyle');
    expect(overlay).toMatch(/withTiming\(expanded \? 1 : 0/);
    expect(overlay).not.toContain('scrimStyle');
    expect(overlay).not.toContain('theme.overlayScrim');
    expect(overlay).toContain(
      'Boolean(query.trim()) && groups.some((group) => group.items.length > 0)',
    );
  });

  it('centers collapsed search between split pins with More last', () => {
    const bar = read('src/components/navigation/bottom-nav-bar.tsx');
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    expect(bar).toContain('splitDockSearchPins');
    expect(bar).toContain('leftPins.map(renderBarSlot)');
    expect(bar).toContain('rightPins.map(renderBarSlot)');
    expect(bar).toContain('width: searchWell');
    expect(bar).not.toContain('paddingLeft: searchWell');
    expect(bar).toContain('collapsedLeft={collapsedLeft}');
    expect(bar).toContain('collapsedLeft = leftPins.length * searchWell');
    expect(bar).toContain('dockSearchMoreIcon(inNav.length)');
    expect(bar).toContain("kind: 'more'");
    expect(bar).not.toContain('more-vertical');
    const layout = read('src/features/search/dock-search-layout.ts');
    expect(layout).toContain("return 'more'");
    expect(layout).not.toContain('more-vertical');
    expect(search).toContain('collapsedLeft');
    expect(search).toMatch(
      /left: interpolate\(progress\.value, \[0, 1\], \[collapsedLeft, 0\]\)/,
    );
    expect(search).toMatch(
      /width: interpolate\(progress\.value, \[0, 1\], \[well, railWidth\]\)/,
    );
    expect(search).toContain('dockSearchCollapsedShellSize');
    expect(search).toContain('collapsedShellHeight');
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
    expect(search).toContain('dockSearchInputShouldScroll');
    expect(search).toContain(
      'scrollEnabled={expandLayout && dockSearchInputShouldScroll(lineCount)}',
    );
    expect(search).not.toContain('scrollEnabled={inputShouldScroll}');
    expect(search).toContain('onContentSizeChange={onContentSizeChange}');
    expect(search).toContain('dockSearchWrappedLineCount');
    expect(search).toContain('DOCK_SEARCH_INPUT_MAX_LINES');
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
      /fieldShellHeight =\s*expandLayout && expanded \? grownHeight : collapsedShellHeight/,
    );
    expect(search).toContain(
      'scrollEnabled={expandLayout && dockSearchInputShouldScroll(lineCount)}',
    );
    expect(search).toContain('setLineCount');
    expect(search).toContain('dockSearchWrappedLineCount');
    expect(bar).toContain('dockSearchBarHeight({');
  });

  it('does not bind the TextInput frame to raw contentSize while typing', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    expect(search).toContain('height: fieldShellHeight');
    expect(search).toContain(
      'scrollEnabled={expandLayout && dockSearchInputShouldScroll(lineCount)}',
    );
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
    expect(search).not.toContain('SheetGrabber');
    expect(search).not.toContain('AgentUiIds.tabs.searchClose');
    expect(search).not.toContain('icon="close"');
    expect(search).not.toContain('icon="chevron-down"');
    const stopIndex = search.indexOf('icon="stop"');
    const micIndex = search.lastIndexOf('icon="microphone"');
    expect(stopIndex).toBeGreaterThan(-1);
    expect(micIndex).toBeGreaterThan(stopIndex);
    expect(search).toMatch(/listening \? \([\s\S]*icon="stop"[\s\S]*icon="microphone"/);
    expect(search).not.toMatch(/listening[\s\S]{0,200}requestMic/);
  });

  it('paints the dock microphone as a ghost glyph on iOS and a glass disc on Android', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const micStart = search.indexOf('icon="microphone"');
    const micEnd = search.indexOf('/>', micStart);
    expect(micStart).toBeGreaterThan(-1);
    expect(micEnd).toBeGreaterThan(micStart);
    const mic = search.slice(micStart, micEnd);
    expect(mic).toContain("appearance={Platform.OS === 'ios' ? 'ghost' : 'glass'}");
    expect(mic).toContain('AgentUiIds.tabs.searchMic');
    expect(mic).not.toContain('backgroundElevated');
    expect(mic).not.toContain('surface="solid"');

    const stopStart = search.indexOf('icon="stop"');
    const stopEnd = search.indexOf('/>', stopStart);
    expect(stopStart).toBeGreaterThan(-1);
    const stop = search.slice(stopStart, stopEnd);
    expect(stop).not.toContain('appearance');
    expect(stop).toContain('AgentUiIds.tabs.searchStop');

    const sendStart = search.indexOf('icon="send"');
    const sendEnd = search.indexOf('/>', sendStart);
    expect(sendStart).toBeGreaterThan(-1);
    const send = search.slice(sendStart, sendEnd);
    expect(send).toContain("appearance={query.trim() ? 'solid' : 'glass'}");
    expect(send).toContain('AgentUiIds.tabs.searchSend');
    expect(send).not.toContain("'ghost'");

    expect(search).toContain('Platform');
    expect(search).toContain('icon="microphone"');
    expect(search).not.toContain('backgroundElevated');
    expect(search).not.toContain('surface="solid"');
  });

  it('renders a raised circular glass search well without an Ask AI caption', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const mark = read('src/components/navigation/dock-search-mark.tsx');
    expect(search).not.toContain('Ask AI');
    expect(search).not.toContain('AuthBrandMark');
    expect(search).toContain('placeholder="Ask onTrack or Search"');
    expect(search).not.toContain('placeholder="Ask onTrack or Search..."');
    expect(search).toContain('<DockSearchMark');
    expect(search).not.toContain('wellPlateStyle');
    expect(search).not.toContain('<Symbol name="search"');
    expect(mark).toContain('<GlassPlate');
    expect(mark).toContain('airy');
    expect(mark).toContain('borderRadius: size / 2');
    expect(search).toContain("accessibilityLabel=\"Search\"");
    expect(search).toContain("label: 'Search'");
    expect(search).toContain('AgentUiIds.tabs.search');
    expect(search).toContain('expand({ listen: true })');
    expect(search).toContain('dockSearchCollapsedWellLift');
    expect(search).toContain('lift={wellLift}');
    expect(mark).toContain('translateY: -lift');
    expect(search).not.toContain('translateY: -s(8)');
    expect(search).not.toContain('surface="solid"');
    expect(search).not.toContain('backgroundElevated');
  });

  it('uses fill-only glass on the expanded search field so iOS does not paint a chroma gradient', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const mark = read('src/components/navigation/dock-search-mark.tsx');
    expect(mark).toContain('<GlassPlate');
    expect(mark).toContain('airy');
    expect(mark).not.toMatch(/<GlassPlate airy[\s\S]{0,80}blur=\{false\}/);
    expect(search).toMatch(
      /<GlassPlate\s+blur=\{false\}\s+style=\{\[\s*styles\.plate/,
    );
    expect(search).not.toContain('experimental_backgroundImage');
    expect(search).not.toContain('surface="solid"');
    expect(search).not.toContain('mist');
  });

  it('does not pass a leading search icon on the expanded Input', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const inputOpen = search.indexOf('<Input');
    const trailingStart = search.indexOf('trailing={', inputOpen);
    expect(inputOpen).toBeGreaterThan(-1);
    expect(trailingStart).toBeGreaterThan(inputOpen);
    const inputHead = search.slice(inputOpen, trailingStart);
    expect(inputHead).not.toMatch(/\bicon=/);
    expect(search).not.toContain('icon="search"');
    expect(search).not.toContain("icon='search'");
    expect(search).not.toContain('icon={query.length > 0');
    expect(search).toContain('placeholder="Ask onTrack or Search"');
    expect(search).not.toContain('placeholder="Ask onTrack or Search..."');
    expect(search).not.toContain('<Symbol name="search"');
    expect(search).toContain('<DockSearchMark');
  });

  it('does not add unused vertical pad onto the expanded 1-line field height', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    expect(search).toMatch(
      /grownHeight = dockSearchFieldHeightForLineCount\(\s*inputBaseHeight,\s*oneLineHeight,\s*visibleLines,\s*\)/,
    );
    expect(search).not.toContain('fieldPadY * 2');
    expect(search).not.toMatch(/grownHeight[\s\S]{0,220}\+\s*fieldPadY/);
    expect(search).not.toContain('const fieldPadY');
    expect(search).not.toContain('paddingTop: fieldPadY');
    expect(search).not.toContain('paddingBottom: fieldPadY');
    expect(search).toMatch(/fieldInputStyle[\s\S]*?paddingVertical:\s*0/);
    expect(search).not.toMatch(
      /Math\.ceil\(oneLineHeight\) \* DOCK_SEARCH_INPUT_MAX_LINES \+ fieldPadY/,
    );
  });

  it('keeps horizontal inset and grows downward only after wrap', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    expect(search).toContain('paddingLeft: fieldPadX');
    expect(search).not.toMatch(/paddingLeft:[\s\S]{0,80}query\.length/);
    expect(search).not.toContain('leadingIconReserve');
    expect(search).toContain('const fieldPadX = s(10)');
    expect(search).toContain(
      "textAlignVertical: (lineCount > 1 ? 'top' : 'center') as 'top' | 'center'",
    );
    expect(search).toContain('dockSearchFieldHeightForLineCount');
    expect(search).toContain('DOCK_SEARCH_INPUT_MAX_LINES');
    expect(search).toContain(
      'scrollEnabled={expandLayout && dockSearchInputShouldScroll(lineCount)}',
    );
    expect(search).toContain('GlassPlate');
    expect(search).not.toContain('surface="solid"');
    expect(search).toContain('placeholder="Ask onTrack or Search"');
    expect(search).not.toContain('placeholder="Ask onTrack or Search..."');
  });

  it('focuses the expanded field on tap without waiting for the chrome timer', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    expect(search).toContain('autoFocus={expanded && !skipFocus}');
    expect(search).toContain('const skipFocus = listenOnExpand || skipFocusAfterListen');
    expect(search).toContain('setSkipFocusAfterListen(true)');
    expect(search).not.toContain('focusReady');
    expect(search).not.toContain('setFocusReady');
    expect(search).toContain('expand({ listen: true })');
  });

  it('centers the collapsed search mark in the circular well', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const mark = read('src/components/navigation/dock-search-mark.tsx');
    expect(search).toContain('<DockSearchMark');
    expect(search).toContain('size={wellButtonSize}');
    expect(search).toContain('lift={wellLift}');
    expect(search).toContain('circulating={!expanded}');
    expect(search).not.toContain('wellIconSlotStyle');
    expect(search).not.toContain('<Symbol name="search"');
    expect(mark).toContain("alignItems: 'center'");
    expect(mark).toContain("justifyContent: 'center'");
    expect(mark).toContain("overflow: 'hidden'");
    expect(mark).toContain("overflow: 'visible'");
    expect(mark).toContain('translateY: -lift');
    expect(search).toContain('dockSearchCollapsedWellLift');
    expect(search).not.toContain('translateY: -s(8)');
    expect(search).toContain("accessibilityLabel=\"Search\"");
    expect(search).toContain('AgentUiIds.tabs.search');
  });

  it('replaces the collapsed search glyph with the app favicon', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const mark = read('src/components/navigation/dock-search-mark.tsx');
    expect(search).toContain('<DockSearchMark');
    expect(search).not.toContain('<Symbol name="search"');
    expect(search).not.toContain("name=\"search\"");
    expect(mark).toContain("require('../../../assets/images/favicon.png')");
    expect(mark).toContain('favicon.png');
    expect(mark).toContain('<Image');
    expect(mark).toContain('resizeMode="cover"');
    expect(mark).toContain('<GlassPlate');
    expect(mark).toContain('airy');
    expect(mark).not.toContain('surface="solid"');
    expect(mark).not.toContain('mist');
  });

  it('circulates a halo around the collapsed favicon and pauses it while search is open', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const mark = read('src/components/navigation/dock-search-mark.tsx');
    const layout = read('src/features/search/dock-search-layout.ts');
    expect(search).toContain('circulating={!expanded}');
    expect(search).toContain("overflow: 'visible'");
    expect(mark).toContain('withRepeat');
    expect(mark).toContain('DOCK_SEARCH_HALO_ORBIT_MS');
    expect(mark).toContain('dockSearchHaloCanvasSize');
    expect(mark).toContain('dockSearchHaloInset');
    expect(mark).toContain('orbit.value * 360');
    expect(mark).toContain("from 'react-native-svg'");
    expect(mark).toContain("overflow: 'visible'");
    expect(mark).toContain('pointerEvents="none"');
    expect(mark).toContain('ReduceMotion.Never');
    expect(layout).toContain('export function dockSearchHaloSize');
    expect(layout).toContain('DOCK_SEARCH_HALO_ORBIT_MS = 3600');
    expect(mark).not.toContain('backgroundElevated');
    expect(mark).not.toContain('surface="solid"');
  });

  it('softens the circulating halo into a feathered glow without hard track or cut ends', () => {
    const mark = read('src/components/navigation/dock-search-mark.tsx');
    const layout = read('src/features/search/dock-search-layout.ts');
    expect(mark).toContain('RadialGradient');
    expect(mark).toContain('stopOpacity={0}');
    expect(mark).toContain('stopOpacity={ambient}');
    expect(mark).toContain('DOCK_SEARCH_HALO_LAYERS');
    expect(mark).toContain('colorWithAlpha');
    expect(mark).toMatch(/\{live \? \(/);
    expect(mark).not.toContain('stroke={track}');
    expect(mark).not.toContain('stroke={accent}');
    expect(mark).not.toContain('stroke={bloom}');
    expect(mark).not.toContain('stroke={trailInk}');
    expect(layout).toContain('DOCK_SEARCH_HALO_GLOW_BLEED');
    expect(layout).toContain('dockSearchHaloOuterExtent');
  });

  it('spins a View comet so Android is not stuck on Svg parent transforms or dashoffset', () => {
    const mark = read('src/components/navigation/dock-search-mark.tsx');
    const layout = read('src/features/search/dock-search-layout.ts');
    expect(mark).toContain('useAnimatedStyle');
    expect(mark).toContain('<Animated.View');
    expect(mark).toContain('renderToHardwareTextureAndroid');
    expect(mark).toContain('collapsable={false}');
    expect(mark).toContain('dockSearchHaloViewRingSize');
    expect(mark).toContain('borderTopColor');
    expect(mark).toContain('live = circulating && !reduceMotion');
    expect(mark).not.toContain('useAnimatedProps');
    expect(mark).not.toContain('createAnimatedComponent');
    expect(mark).not.toContain('strokeDashoffset');
    expect(mark).not.toContain('allowsLoopMotion');
    expect(mark).not.toContain('allowsAnimatedSvgProps');
    expect(mark).not.toContain('ReduceMotion.System');
    expect(layout).not.toContain('dockSearchHaloDashOffset');
  });

  it('keeps collapsed search height on the circular plate instead of 3-pin slot width', () => {
    const search = read('src/components/navigation/bottom-nav-search.tsx');
    const layout = read('src/features/search/dock-search-layout.ts');
    expect(search).toContain('dockSearchCollapsedShellSize');
    expect(layout).toContain('export function dockSearchCollapsedShellSize');
    expect(search).toContain('slotWidth: well');
    expect(search).toContain('wellButtonSize');
    expect(search).toMatch(
      /height: interpolate\(\s*progress\.value,\s*\[0, 1\],\s*\[collapsedShellHeight, shellHeight\.value\],\s*\)/,
    );
    expect(search).not.toMatch(
      /height: interpolate\(progress\.value, \[0, 1\], \[well, shellHeight\.value\]\)/,
    );
    expect(search).toContain('width: interpolate(progress.value, [0, 1], [well, railWidth])');
    expect(search).toMatch(/width: well,/);
    expect(search).not.toContain('collapsedShell.height');
    expect(search).not.toContain('fieldInputStyle = useMemo');
    expect(search).toContain('dockSearchCollapsedWellLift');
    expect(search).toContain('layout.bottomNavBarBaseHeight');
    expect(search).toContain('spacing.xxs');
    expect(search).toContain('lift={wellLift}');
    expect(search).toMatch(
      /dockSearchCollapsedWellLift\(\{\s*barBaseHeight: layout\.bottomNavBarBaseHeight,\s*barPaddingTop: spacing\.xxs,\s*wellButtonSize,\s*\}\)/,
    );
    expect(search).not.toContain('shellHeight: collapsedShellHeight');
    expect(layout).toContain('DOCK_SEARCH_COLLAPSED_WELL_HANG_RATIO = 0.15');
    expect(layout).not.toContain('shellHeight: number');
  });
});
