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

  it('renders GlassPlate only when transcript, results, or transcribe/speak/error exist', () => {
    expect(overlay).toContain("voice.phase === 'thinking' || voice.phase === 'speaking'");
    expect(overlay).toMatch(
      /showPlate\s*=\s*\n\s*transcript\.length > 0 \|\|[\s\S]*showResults \|\|[\s\S]*voiceBusy \|\|[\s\S]*Boolean\(voice\.lastError\)/,
    );
    expect(overlay).toMatch(/\{showPlate \? \([\s\S]*<GlassPlate[\s\S]*\) : null\}/);
    expect(overlay).not.toContain('JournalRecordingWave');
    expect(overlay).not.toContain("voice.phase !== 'idle'");
    expect(overlay).toContain('theme.overlayScrim');
    expect(overlay).not.toContain('backgroundElevated');
    expect(overlay).not.toContain("surface=\"solid\"");
    expect(overlay).not.toContain("variant=\"mist\"");
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
    const compactScrollIndex = overlay.indexOf('maxHeight: s(180)');
    expect(buttonIndex).toBeGreaterThan(-1);
    expect(transcriptIndex).toBeGreaterThan(buttonIndex);
    expect(compactScrollIndex).toBeGreaterThan(buttonIndex);
  });
});

describe('dock search overlay expand layout', () => {
  it('fills from the safe-area top down to the search field when results are showing', () => {
    expect(overlay).toContain('dockSearchOverlayBottom');
    expect(overlay).toContain('dockSearchResultsPadding');
    expect(overlay).toContain('dockSearchResultsGap');
    expect(overlay).toContain('insets.top');
    expect(overlay).toContain('const fillScreen = expandLayout && showResults');
    expect(overlay).not.toContain('maxHeight: s(320)');
    expect(overlay).toContain('DOCK_SEARCH_COMPACT_MAX_HEIGHT');
    expect(overlay).toContain("overflow: 'hidden'");
  });

  it('wraps result groups in one ScrollView only when the plate fills the screen', () => {
    expect(overlay).toContain('AgentUiIds.tabs.searchResults');
    expect(overlay).toMatch(
      /fillScreen \? \([\s\S]*<ScrollView[\s\S]*\{plateBody\}[\s\S]*\) : \([\s\S]*plateBody/,
    );
    expect(overlay).toContain('groups.map((group) =>');
    expect(overlay).toContain('keyboardShouldPersistTaps="handled"');
    expect(overlay).toContain('titleCase={false}');
    expect(overlay).not.toMatch(/<AppText variant="callout" fit>/);
  });

  it('keeps a compact floating-card branch for transcript-only and compact layout', () => {
    expect(overlay).toContain("DOCK_SEARCH_LAYOUT === 'expand'");
    expect(overlay).toContain('expandLayout && showResults');
    expect(overlay).toMatch(
      /fillScreen\s*\?[\s\S]*top: insets\.top[\s\S]*maxHeight: s\(DOCK_SEARCH_COMPACT_MAX_HEIGHT\)/,
    );
    expect(overlay).toContain('maxHeight: s(180)');
  });
});
