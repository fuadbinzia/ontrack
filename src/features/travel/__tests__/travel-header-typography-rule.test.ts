import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('travel section header typography', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-collapsible-section.tsx'),
    'utf8',
  );

  it('keeps compact nested labels at readable overline sizing', () => {
    expect(source).toContain("variant={compact && nested ? 'overline' : titleVariant}");
    expect(source).toContain('fit={Boolean(compact && nested) || !compact}');
    expect(source).toContain('fitMinimumScale={compact && nested ? 0.9 : undefined}');
    expect(source).not.toMatch(/compactNestedTitle:\s*\{[^}]*fontSize/s);
  });

  it('shows expand and collapse affordances on compact nested sections', () => {
    expect(source).toContain('DisclosureChevron');
    expect(source).toContain('expanded={expanded}');
    expect(source).not.toContain('{compact && nested ? null : (');
  });

  it('keeps compact card titles from shrink-to-fit crushing', () => {
    expect(source).toContain('compact && !nested ? styles.compactCardTitle');
    // Parent titles are short — never allow adjustsFontSizeToFit on them.
    expect(source).toContain('fit={Boolean(compact && nested) || !compact}');
    expect(source).not.toMatch(/compactCardTitle:\s*\{[^}]*fontSize/s);
  });

  it('uses the travel editorial face for section titles (match plan hero)', () => {
    expect(source).toContain('travelEditorialTextStyle');
    expect(source).toMatch(/title:\s*\{[^}]*\.\.\.travelEditorialTextStyle/s);
  });

  it('uses the shared mock icon→title gap for parent and nested headers', () => {
    expect(source).toContain('TRAVEL_TITLE_ICON_GAP');
    expect(source).toContain(
      'const titleIconGap = Math.max(TRAVEL_TITLE_ICON_GAP, s(TRAVEL_TITLE_ICON_GAP))',
    );
    expect(source).toContain('const headerGap = titleIconGap');
  });

  it('uses theme-aware ink on white (light) / dark-glass (dark) card panels', () => {
    expect(source).toContain('useTravelItineraryShellProps');
    expect(source).toContain('useTravelItineraryInk');
    expect(source).toContain('travelAccent(theme)');
    expect(source).not.toContain('TRAVEL_EDITORIAL_ACCENT');
    expect(source).not.toContain('inverted=');
    // No paper `wash` prop — allow the word in comments only.
    expect(source).not.toMatch(/^\s*wash\b/m);
    expect(source).not.toMatch(/<\w+[^>]*\swash[\s=/>]/);
  });
});

describe('itinerary page glass chrome', () => {
  it('keeps dates/notes/section shells on frosted airy glass; nested boards on mist', () => {
    for (const file of [
      'travel-trip-dates-row.tsx',
      'travel-trip-notes-card.tsx',
      'travel-collapsible-section.tsx',
    ]) {
      const src = readFileSync(
        join(process.cwd(), `src/features/travel/${file}`),
        'utf8',
      );
      expect(src).toContain('useTravelItineraryShellProps');
      expect(src).not.toContain('travelItineraryShellFillStyle');
      expect(src).not.toContain('inverted=');
    }
    for (const file of [
      'travel-timeline-node.tsx',
      'travel-itinerary-timeline.tsx',
      'travel-transport-sections.tsx',
      'travel-list-actions.tsx',
    ]) {
      const src = readFileSync(
        join(process.cwd(), `src/features/travel/${file}`),
        'utf8',
      );
      // Nested board/timeline chips use translucent mist (not airy milk).
      expect(src).toContain('useTravelItineraryMistProps');
    }
    const surface = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-surface.tsx'),
      'utf8',
    );
    // Default airy frost; dense only while an expanded flight darkens the hero.
    expect(surface).toContain('airy: !dense');
    expect(surface).toContain('dense?: boolean');
    expect(surface).toContain('? 64');
    expect(surface).toContain('? 40');
    expect(surface).not.toMatch(/:\s*\{\s*clear:\s*true\s*\}/);
    const planDetail = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-detail.tsx'),
      'utf8',
    );
    expect(planDetail).toContain('denseHeroGlass');
    expect(planDetail).toContain("item.kind === 'flight'");
    const board = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-timeline-node.tsx'),
      'utf8',
    );
    // Parent overflow:hidden kills iOS frost on mist shells (board + non-dense).
    expect(board).toContain("overflow: useMistShell ? 'visible' : 'hidden'");
    expect(board).toContain('useMistShell');
    const body = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-detail-body.tsx'),
      'utf8',
    );
    // Sky wash is local to the body — no dead sheetBase context.
    expect(body).toContain('travelPlanSkyPageWashStyle');
    expect(body).toContain('washTop');
    expect(body).toContain('TravelArtworkTintProvider');
    expect(body).toContain('resolveTravelArtworkTintHex');
    expect(body).not.toContain('TravelItinerarySheetBaseProvider');
    const notes = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-trip-notes-card.tsx'),
      'utf8',
    );
    // Notes title matches Transportation subheading scale (no caption crush).
    expect(notes).toContain('variant="subheading"');
    expect(notes).not.toMatch(/variant="caption"/);
  });
});

describe('transport board section header', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-transport-sections.tsx'),
    'utf8',
  );
  const collapsible = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-collapsible-section.tsx'),
    'utf8',
  );

  it('uses the suitcase glyph and subheading title for Transportation, Stays & Events', () => {
    expect(source).toContain('title="Transportation, Stays & Events"');
    expect(source).toContain('icon="suitcase"');
    expect(source).toContain('tightHeader');
    expect(source).toContain('titleVariant="subheading"');
  });

  it('keeps nested kind headers theme-aware (kind accents on white, light ink on dark)', () => {
    expect(source).toContain('title="FLIGHTS"');
    expect(source).toContain('nested');
    expect(collapsible).toContain('useTravelItineraryOnGlass');
    expect(collapsible).toContain('useTravelItineraryInk');
    expect(collapsible).toContain('useTravelItineraryShellProps');
  });
});

describe('timeline progress + dense rows on glass', () => {
  it('uses artwork-aware itinerary ink for progress text on dark glass', () => {
    const progress = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-timeline-progress-chrome.tsx'),
      'utf8',
    );
    expect(progress).toContain('useTravelItineraryInk()');
    expect(progress).toContain("useTravelItineraryInk('secondary')");
    expect(progress).toContain('useTravelItineraryOnGlass()');
    expect(progress).toContain('GlassTonePill');
    expect(progress).toContain('toneColor={onGlass ? primaryInk : badgeColor}');
    expect(progress).toContain('textColor={onGlass ? primaryInk : undefined}');
    expect(progress).toContain('const trackFill = onGlass');
    expect(progress).toContain('useTravelItineraryMistProps()');
    expect(progress).toContain('<TravelHomeGlass');
    expect(progress).toContain('color="#000000"');
    expect(progress).toContain('color: primaryInk');
    expect(progress).not.toContain('style={{ color: badgeColor');
  });

  it('treats dense timeline rows as onGlass only on dark mist stacks', () => {
    const node = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-timeline-node.tsx'),
      'utf8',
    );
    expect(node).toContain(
      'const onGlass = (isCompactBoardCard || dense) && darkGlass',
    );
    expect(node).toContain('useTravelItineraryOnGlass');
    expect(node).toContain('onGlass={onGlass}');
  });

  it('keeps dense timeline chrome vertically centered (tight leading, no collapsed gap)', () => {
    const node = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-timeline-node.tsx'),
      'utf8',
    );
    const chrome = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-timeline-node-chrome.tsx'),
      'utf8',
    );
    const timeline = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-itinerary-timeline-days.tsx'),
      'utf8',
    );
    expect(node).toContain('denseChromeLineHeight');
    expect(chrome).toContain('denseTitleStack');
    const nodeBody = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-timeline-node-body.tsx'),
      'utf8',
    );
    const nodeStyles = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-timeline-node-styles.ts'),
      'utf8',
    );
    expect(nodeStyles).toContain('denseCopy');
    expect(nodeStyles).toMatch(
      /itemHeader:\s*\{\s*flexDirection:\s*'row',\s*alignItems:\s*'center'/,
    );
    expect(nodeBody).toMatch(
      /dense && !isExpanded && photos\.length === 0\s*\?\s*0/,
    );
    expect(chrome).toContain('denseLine');
    expect(timeline).toContain('paddingVertical: Math.max(8, s(8))');
    expect(timeline).toContain('justifyContent: \'center\'');
  });
});

describe('timeline section header', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-plan-detail-body.tsx'),
    'utf8',
  );

  it('matches the transport board title treatment', () => {
    expect(source).toContain('title="Timeline"');
    expect(source).toContain('icon="clock"');
    expect(source).toContain('titleVariant="subheading"');
    expect(source).toContain('tightHeader');
    expect(source).toContain('travelAccent(theme)');
    expect(source).toContain('timelineSection');
  });
});

describe('trip tools section header', () => {
  it('uses subheading so the title stays readable on the glass card', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-trip-tools.tsx'),
      'utf8',
    );
    expect(source).toContain('title="Trip Tools"');
    expect(source).toContain('titleVariant="subheading"');
    expect(source).toContain('travelAccent(theme)');
  });

  it('keeps action-group labels on itinerary ink (readable on cream sheet)', () => {
    const grid = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-trip-action-grid.tsx'),
      'utf8',
    );
    expect(grid).toContain("travelItineraryInk(theme, 'secondary')");
    expect(grid).not.toContain("color: 'rgba(255,255,255,0.72)'");
  });
});

describe('travel title icon gap token', () => {
  it('is shared at 8pt for mock-matched logo+title rows', () => {
    const chrome = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-chrome.ts'),
      'utf8',
    );
    expect(chrome).toMatch(/export const TRAVEL_TITLE_ICON_GAP = 8/);
    for (const file of [
      'travel-timeline-node.tsx',
      'travel-trip-notes-card.tsx',
      'travel-trip-dates-row.tsx',
    ]) {
      const source = readFileSync(
        join(process.cwd(), `src/features/travel/${file}`),
        'utf8',
      );
      expect(source).toContain('TRAVEL_TITLE_ICON_GAP');
    }
  });
});
