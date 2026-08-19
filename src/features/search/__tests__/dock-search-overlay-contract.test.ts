import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const overlay = readFileSync(
  join(process.cwd(), 'src/features/search/dock-search-overlay.tsx'),
  'utf8',
);

describe('dock search overlay chrome', () => {
  it('does not render Screens catalog groups unless the query is non-empty', () => {
    expect(overlay).toMatch(
      /showResults\s*=\s*\n\s*Boolean\(query\.trim\(\)\) && groups\.some/,
    );
    expect(overlay).not.toContain('|| !showChat');
    expect(overlay).toMatch(/\{showResults\s*\?[\s\S]*groups\.map\(/);
    const showResultsDecl = overlay.indexOf('const showResults');
    const groupsMap = overlay.indexOf('groups.map((group)');
    expect(showResultsDecl).toBeGreaterThan(-1);
    expect(groupsMap).toBeGreaterThan(showResultsDecl);
  });

  it('maps result rows when a typed query has matching groups', () => {
    expect(overlay).toContain('groups.some((group) => group.items.length > 0)');
    expect(overlay).toContain('groups.map((group) =>');
    expect(overlay).toContain('DockSearchResultRow');
    expect(overlay).toContain('item.title');
    expect(overlay).toContain('item.href');
  });

  it('frosts the page with BlurView and a light black gradient when search is open', () => {
    expect(overlay).toContain('<BlurView');
    expect(overlay).toContain('LinearGradient');
    expect(overlay).toContain('dockSearchBackdropGradientColors');
    expect(overlay).toContain('DOCK_SEARCH_BACKDROP_BLUR_INTENSITY');
    expect(overlay).toContain('tint="dark"');
    expect(overlay).toContain('usePerformanceTier');
    expect(overlay).toContain('allowsBlur');
    expect(overlay).toContain("Platform.OS === 'ios'");
    expect(overlay).toContain('AgentUiIds.tabs.searchBackdrop');
    expect(overlay).toContain('accessibilityLabel="Close Search"');
    expect(overlay).not.toContain('theme.overlayScrim');
    expect(overlay).not.toContain('backgroundElevated');
    expect(overlay).not.toContain('backgroundSunken');
    const blurIndex = overlay.indexOf('<BlurView');
    const gradientIndex = overlay.indexOf('<LinearGradient');
    const plateIndex = overlay.indexOf('{showPlate ? (');
    expect(blurIndex).toBeGreaterThan(-1);
    expect(gradientIndex).toBeGreaterThan(blurIndex);
    expect(plateIndex).toBeGreaterThan(gradientIndex);
  });

  it('drops overlay frost intensity on type-ahead and conversation plates so iOS does not paint a chroma gradient', () => {
    expect(overlay).toContain('dockSearchOverlayFrosted');
    expect(overlay).toContain("ios: Platform.OS === 'ios'");
    expect(overlay).toContain('fillScreen');
    expect(overlay).toContain(
      'intensity={frosted ? DOCK_SEARCH_BACKDROP_BLUR_INTENSITY : 0}',
    );
    expect(overlay).toContain('blurred: frosted');
    expect(overlay).toContain("Platform.OS === 'ios' ? (");
    expect(overlay).toContain('<BlurView');
  });

  it('uses fill-only GlassPlate on type-ahead results and conversation bubbles', () => {
    expect(overlay).toContain('blur={false}');
    expect(overlay).toMatch(
      /<GlassPlate\s+airy\s+blur=\{false\}\s+tintColor=\{isUser \? theme\.accentPrimary : undefined\}/,
    );
    expect(overlay).toMatch(
      /\{showPlate \? \([\s\S]*<GlassPlate\s+blur=\{false\}/,
    );
    expect(overlay).not.toContain('experimental_backgroundImage');
    expect(overlay).not.toContain('backgroundElevated');
    expect(overlay).not.toContain("surface=\"solid\"");
    expect(overlay).not.toContain("variant=\"mist\"");
  });

  it('reveals the frosted veil as soon as search expands, not when typing starts', () => {
    expect(overlay).toContain('backdropStyle');
    expect(overlay).toContain('backdropProgress');
    expect(overlay).toContain('useLayoutEffect');
    expect(overlay).toMatch(/withTiming\(expanded \? 1 : 0/);
    expect(overlay).toContain('motion.chrome');
    expect(overlay).not.toContain('scrimStyle');
    expect(overlay).not.toMatch(/StyleSheet\.absoluteFill,\s*scrimStyle/);
    const blurIndex = overlay.indexOf('<BlurView');
    const plateIndex = overlay.indexOf('{showPlate ? (');
    expect(blurIndex).toBeGreaterThan(-1);
    expect(plateIndex).toBeGreaterThan(blurIndex);
    expect(overlay).toMatch(
      /showPlate \? \([\s\S]*onSheetLayout\(Math\.round\(event\.nativeEvent\.layout\.height\)\)/,
    );
  });

  it('renders GlassPlate only when transcript, results, or transcribe/speak/error exist', () => {
    expect(overlay).toContain("voice.phase === 'thinking' || voice.phase === 'speaking'");
    expect(overlay).toMatch(
      /showPlate\s*=\s*\n\s*transcript\.length > 0 \|\|[\s\S]*showResults \|\|[\s\S]*voiceBusy \|\|[\s\S]*Boolean\(voice\.lastError\)/,
    );
    expect(overlay).toMatch(/\{showPlate \? \([\s\S]*<GlassPlate[\s\S]*\) : null\}/);
    expect(overlay).not.toContain('JournalRecordingWave');
    expect(overlay).not.toContain("voice.phase !== 'idle'");
    expect(overlay).toContain('<BlurView');
    expect(overlay).toContain('LinearGradient');
    expect(overlay).not.toContain('theme.overlayScrim');
    expect(overlay).not.toContain('backgroundElevated');
    expect(overlay).not.toContain("surface=\"solid\"");
    expect(overlay).not.toContain("variant=\"mist\"");
  });

  it('shows a pull-down grabber when the plate fills the screen', () => {
    expect(overlay).toContain('SheetGrabber');
    expect(overlay).toContain('AgentUiIds.tabs.searchClose');
    expect(overlay).toContain('fillScreen ? (');
    expect(overlay).toContain('closeResults');
  });

  it('does not collapse search when voice returns to idle', () => {
    expect(overlay).not.toContain('hadVoice');
    expect(overlay).not.toMatch(/voice\.phase === 'idle'[\s\S]{0,80}collapse\(\)/);
  });
});

describe('dock search overlay Clear Conversation', () => {
  it('stamps searchClearConversation on a glass ghost Button', () => {
    expect(overlay).toContain('AgentUiIds.tabs.searchClearConversation');
    expect(overlay).toContain('variant="ghost"');
    expect(overlay).toContain('icon="delete"');
    expect(overlay).toContain('accessibilityLabel="Clear Conversation"');
    expect(overlay).toContain('Clear Conversation');
    expect(overlay).not.toContain('backgroundElevated');
    expect(overlay).not.toContain('backgroundSunken');
    expect(overlay).not.toContain("surface=\"solid\"");
  });

  it('renders Clear Conversation only when the transcript is non-empty', () => {
    expect(overlay).toMatch(
      /transcript\.length > 0 \? \([\s\S]*AgentUiIds\.tabs\.searchClearConversation[\s\S]*\) : null/,
    );
    const buttonIndex = overlay.indexOf('AgentUiIds.tabs.searchClearConversation');
    const transcriptIndex = overlay.indexOf('AgentUiIds.tabs.searchTranscript');
    expect(buttonIndex).toBeGreaterThan(-1);
    expect(transcriptIndex).toBeGreaterThan(-1);
    expect(buttonIndex).toBeGreaterThan(transcriptIndex);
  });

  it('scrolls Clear Conversation with the transcript instead of pinning it above the scroller', () => {
    const transcriptIndex = overlay.indexOf('AgentUiIds.tabs.searchTranscript');
    const scrollRef = overlay.indexOf('ref={transcriptScrollRef}');
    const compactScrollIndex = overlay.indexOf('maxHeight: s(180)');
    const buttonIndex = overlay.indexOf('AgentUiIds.tabs.searchClearConversation');
    const turns = overlay.indexOf('{transcriptTurns}');
    expect(transcriptIndex).toBeGreaterThan(-1);
    expect(scrollRef).toBeGreaterThan(transcriptIndex);
    expect(compactScrollIndex).toBeGreaterThan(scrollRef);
    expect(buttonIndex).toBeGreaterThan(compactScrollIndex);
    expect(turns).toBeGreaterThan(buttonIndex);
    expect(overlay).not.toMatch(
      /styles\.chatHeader[\s\S]{0,180}<AgentTestId[\s\S]{0,80}AgentUiIds\.tabs\.searchTranscript/,
    );
  });

  it('centers Clear Conversation above the first bubble when the transcript does not scroll', () => {
    expect(overlay).toMatch(
      /chatHeader:\s*\{[^}]*alignItems: 'center'[^}]*justifyContent: 'center'/,
    );
    expect(overlay).not.toMatch(
      /chatHeader:\s*\{[^}]*justifyContent: 'flex-end'/,
    );
    expect(overlay).not.toMatch(
      /chatHeader:\s*\{[^}]*justifyContent: 'flex-start'/,
    );
  });
});

describe('dock search overlay expand layout', () => {
  it('fills from the safe-area top down to the search field when results are showing', () => {
    expect(overlay).toContain('dockSearchOverlayBottom');
    expect(overlay).toContain('dockSearchResultsPadding');
    expect(overlay).toContain('dockSearchResultsGap');
    expect(overlay).toContain('insets.top');
    expect(overlay).toContain(
      'const fillScreen = expandLayout && (showResults || transcript.length > 0)',
    );
    expect(overlay).not.toContain('maxHeight: s(320)');
    expect(overlay).toContain('DOCK_SEARCH_COMPACT_MAX_HEIGHT');
    expect(overlay).toContain("overflow: 'hidden'");
  });

  it('keeps a dedicated transcript scroller when the plate fills the screen', () => {
    expect(overlay).toContain('AgentUiIds.tabs.searchResults');
    expect(overlay).toContain('AgentUiIds.tabs.searchTranscript');
    expect(overlay).toMatch(
      /fillScreen \? \([\s\S]*AgentUiIds\.tabs\.searchResults[\s\S]*\{plateBody\}[\s\S]*\) : \([\s\S]*plateBody/,
    );
    expect(overlay).toContain('groups.map((group) =>');
    expect(overlay).toContain('keyboardShouldPersistTaps="handled"');
    expect(overlay).toContain('titleCase={false}');
    expect(overlay).not.toMatch(/<AppText variant="callout" fit>/);
  });

  it('caps the floating card only when there is no conversation and no results', () => {
    expect(overlay).toContain("DOCK_SEARCH_LAYOUT === 'expand'");
    expect(overlay).toContain(
      'const fillScreen = expandLayout && (showResults || transcript.length > 0)',
    );
    expect(overlay).toMatch(
      /fillScreen\s*\?[\s\S]*top: insets\.top[\s\S]*maxHeight: s\(DOCK_SEARCH_COMPACT_MAX_HEIGHT\)/,
    );
    expect(overlay).toContain('maxHeight: s(180)');
  });

  it('clips the compact Transcribing plate so iOS fill corners do not flare past the radius', () => {
    expect(overlay).toMatch(/plateCompact:\s*\{[\s\S]*?overflow: 'hidden'/);
    expect(overlay).not.toMatch(/plateCompact:\s*\{[\s\S]*?overflow: 'visible'/);
    expect(overlay).toContain('Transcribing…');
    expect(overlay).toContain("voice.phase === 'thinking'");
    expect(overlay).toMatch(/\{voice\.phase === 'thinking' \? \([\s\S]*Transcribing…/);
    expect(overlay).toMatch(/plateExpand:[\s\S]*overflow: 'hidden'/);
    expect(overlay).toMatch(
      /\{showPlate \? \([\s\S]*<GlassPlate\s+blur=\{false\}/,
    );
    expect(overlay).toContain("voice.phase === 'thinking' || voice.phase === 'speaking'");
    expect(overlay).toMatch(
      /showPlate\s*=\s*\n\s*transcript\.length > 0 \|\|[\s\S]*showResults \|\|[\s\S]*voiceBusy \|\|[\s\S]*Boolean\(voice\.lastError\)/,
    );
    expect(overlay).toContain(
      'const fillScreen = expandLayout && (showResults || transcript.length > 0)',
    );
  });
});

describe('dock search overlay conversation bubbles', () => {
  it('uses the app favicon as the assistant mark, not AuthBrandMark', () => {
    expect(overlay).toContain("<Image");
    expect(overlay).toContain("require('../../../assets/images/favicon.png')");
    expect(overlay).toContain('favicon.png');
    expect(overlay).toContain('resizeMode="cover"');
    expect(overlay).not.toContain('AuthBrandMark');
    expect(overlay).not.toContain("@/features/auth/auth-brand-mark");
    expect(overlay).not.toContain('showContainer={true}');
    expect(overlay).not.toContain('orbitTilted={true}');
  });

  it('does not render onTrack or You as transcript sender chrome', () => {
    expect(overlay).not.toContain("turn.role === 'user' ? 'You' : 'onTrack'");
    expect(overlay).not.toMatch(/['"]onTrack['"]/);
    expect(overlay).not.toMatch(/['"]You['"]/);
  });

  it('sits the app mark above the assistant bubble instead of vertically centering it', () => {
    expect(overlay).toContain("turn.role === 'user'");
    expect(overlay).toContain('styles.turnRowUser');
    expect(overlay).toContain("alignSelf: 'flex-end'");
    expect(overlay).toContain("justifyContent: 'flex-end'");
    expect(overlay).toContain('styles.turnRowAssistant');
    expect(overlay).toContain("alignSelf: 'flex-start'");
    expect(overlay).toMatch(/turnRowAssistant:\s*\{[^}]*alignItems: 'flex-start'/);
    expect(overlay).toMatch(/markSlot:\s*\{[^}]*alignSelf: 'flex-start'/);
    expect(overlay).toContain('marginTop: -s(6)');
    expect(overlay).not.toMatch(/turnRow:\s*\{[^}]*alignItems: 'flex-end'/);
    expect(overlay).not.toMatch(/turnRow:\s*\{[^}]*alignItems: 'center'/);
    expect(overlay).not.toMatch(/turnRowAssistant:\s*\{[^}]*alignItems: 'center'/);
    expect(overlay).not.toMatch(/turnRowAssistant:\s*\{[^}]*alignItems: 'flex-end'/);
    expect(overlay).toMatch(/isUser \? null : \([\s\S]*<Image/);
    expect(overlay).toMatch(/isUser \? null : \([\s\S]*favicon\.png/);
    expect(overlay).toMatch(/width: s\(2[4-8]\)/);
    expect(overlay).toMatch(/height: s\(2[4-8]\)/);
    expect(overlay).toContain("overflow: 'hidden'");
    expect(overlay).toMatch(/borderRadius: s\(\d+\)/);
  });

  it('renders GlassPlate airy bubbles with a tighter outgoing bottom-right corner', () => {
    expect(overlay).toContain('<GlassPlate');
    expect(overlay).toContain('airy');
    expect(overlay).toContain('blur={false}');
    expect(overlay).toContain('tintColor={isUser ? theme.accentPrimary : undefined}');
    expect(overlay).toContain("maxWidth: '84%'");
    expect(overlay).toContain('styles.userBubble');
    expect(overlay).toContain('styles.assistantBubble');
    expect(overlay).toMatch(
      /userBubble:[\s\S]*borderTopLeftRadius: radii\.xl[\s\S]*borderTopRightRadius: radii\.xl[\s\S]*borderBottomLeftRadius: radii\.xl[\s\S]*borderBottomRightRadius: radii\.sm/,
    );
    expect(overlay).toMatch(
      /assistantBubble:[\s\S]*borderTopLeftRadius: radii\.xl[\s\S]*borderTopRightRadius: radii\.xl[\s\S]*borderBottomRightRadius: radii\.xl[\s\S]*borderBottomLeftRadius: radii\.sm/,
    );
    expect(overlay).toContain("color={isUser ? 'onAccent' : 'primary'}");
    expect(overlay).toContain('titleCase={false}');
    expect(overlay).not.toContain('backgroundElevated');
    expect(overlay).not.toContain('backgroundSunken');
    expect(overlay).not.toContain('surface="solid"');
    expect(overlay).not.toContain('variant="mist"');
  });

  it('keeps the transcript testID around the turn list', () => {
    expect(overlay).toContain('AgentUiIds.tabs.searchTranscript');
    const transcriptIndex = overlay.indexOf('AgentUiIds.tabs.searchTranscript');
    const turnMap = overlay.indexOf('transcript.map((turn)');
    expect(transcriptIndex).toBeGreaterThan(-1);
    expect(turnMap).toBeGreaterThan(-1);
  });
});

describe('dock search overlay latest-turn scroll', () => {
  it('scrolls the active transcript scroller to the end when content or turns change', () => {
    expect(overlay).toContain('transcriptScrollRef');
    expect(overlay).toContain('scrollToEnd');
    expect(overlay).toContain('{ animated: true }');
    expect(overlay).toContain('onContentSizeChange');
    expect(overlay).toContain('onContentSizeChange={scrollTranscriptToEnd}');
    expect(overlay).toContain('lastTurnId');
    expect(overlay).toContain('transcript.length');
    expect(overlay).toMatch(
      /useEffect\(\(\) => \{[\s\S]*scrollTranscriptToEnd\(\);[\s\S]*\}, \[lastTurnId, scrollTranscriptToEnd\]\)/,
    );
  });

  it('scrolls the transcript scroller itself, not the results list', () => {
    expect(overlay).toContain('ref={transcriptScrollRef}');
    expect(overlay).toContain('maxHeight: s(180)');
    expect(overlay).toContain('AgentUiIds.tabs.searchTranscript');
    const transcriptId = overlay.indexOf('AgentUiIds.tabs.searchTranscript');
    const transcriptRef = overlay.indexOf('ref={transcriptScrollRef}');
    const resultsId = overlay.indexOf('AgentUiIds.tabs.searchResults');
    expect(transcriptId).toBeGreaterThan(-1);
    expect(transcriptRef).toBeGreaterThan(transcriptId);
    expect(resultsId).toBeGreaterThan(transcriptRef);
    expect(overlay).toContain(
      'style={fillScreen ? styles.scroller : { maxHeight: s(180) }}',
    );
  });
});
