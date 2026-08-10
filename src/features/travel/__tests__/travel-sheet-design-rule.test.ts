import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function travelSheetFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return travelSheetFiles(path);
    if (!entry.name.endsWith('-sheet.tsx') || entry.name === 'travel-sheet.tsx') {
      return [];
    }
    return [path];
  });
}

function travelTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return travelTsxFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('canonical travel sheet design', () => {
  it('keeps every rendered travel sheet on the shared scaffold or header', () => {
    const directory = join(process.cwd(), 'src/features/travel');
    const sheets = travelSheetFiles(directory);

    expect(sheets.length).toBeGreaterThan(0);
    for (const path of sheets) {
      const source = readFileSync(path, 'utf8');
      // Some `*-sheet` modules only launch a native system surface and render no UI.
      if (/return null;/.test(source)) continue;
      expect({ path, source }).toEqual(
        expect.objectContaining({
          source: expect.stringMatching(
            /@\/features\/travel\/travel-sheet|@\/components\/primitives/,
          ),
        }),
      );
    }
  });

  it('keeps Travel modal sheets on frosted glass surfaces', () => {
    const sheet = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-sheet.tsx'),
      'utf8',
    );
    const scaffold = readFileSync(
      join(process.cwd(), 'src/components/primitives/sheet-scaffold.tsx'),
      'utf8',
    );
    const addSheet = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-itinerary-add-sheet.tsx'),
      'utf8',
    );
    const directGlass = [
      'travel-remove-confirm-modal.tsx',
      'travel-timeline-add-modal.tsx',
      'travel-add-photos-modal.tsx',
      'travel-calendar-updated-modal.tsx',
      'travel-import-result-modal.tsx',
      'travel-item-notes-sheet.tsx',
    ];

    expect(sheet).toContain('surface="glass"');
    expect(sheet).toContain('closeAppearance="glass"');
    expect(scaffold).toContain("surface?: 'solid' | 'glass'");
    expect(scaffold).toContain('<SheetGrabber');
    expect(scaffold).toContain('<BlurView');
    expect(addSheet).toContain('<BlurView');
    expect(addSheet).not.toContain('chrome.sheetBg');
    for (const name of directGlass) {
      const source = readFileSync(
        join(process.cwd(), 'src/features/travel', name),
        'utf8',
      );
      expect({ name, source }).toEqual(
        expect.objectContaining({
          source: expect.stringContaining('surface="glass"'),
        }),
      );
    }
  });

  it('uses the travel sheet header for chat instead of the default stack bar', () => {
    const chat = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-chat-screen.tsx'),
      'utf8',
    );
    const travelLayout = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/travel/_layout.tsx'),
      'utf8',
    );

    expect(chat).toContain('<TravelSheetHeader');
    expect(chat).toContain('goBackOrReplace');
    expect(chat).not.toContain('router.back()');
    // Nested under (tabs)/travel so the bottom nav stays on itinerary + tools.
    expect(travelLayout).toContain("anchor: 'index'");
    expect(travelLayout).toContain('headerShown: false');

    const planHero = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-hero.tsx'),
      'utf8',
    );
    // Itinerary back must dismiss to Travel home, never stack-pop to a prior trip.
    expect(planHero).toContain("dismissTo('/(tabs)/travel'");
    expect(planHero).toContain('canDismiss()');
    expect(planHero).toContain("replace('/(tabs)/travel'");
    expect(planHero).not.toContain('goBackOrReplace');
  });

  it('keeps full-screen Travel headers on the shared small top inset', () => {
    const chat = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-chat-screen.tsx'),
      'utf8',
    );
    const accessGate = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-chat-access-gate.tsx'),
      'utf8',
    );
    const detail = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-detail.tsx'),
      'utf8',
    );

    expect(chat).not.toContain('paddingTop={rs.md}');
    expect(accessGate).not.toContain('paddingTop={rs.md}');
    expect(chat.match(/paddingTop=\{rs\.sm\}/g)).toHaveLength(1);
    expect(accessGate.match(/paddingTop=\{rs\.sm\}/g)).toHaveLength(2);
    expect(detail).not.toMatch(/screen:\s*\{[^}]*paddingTop:\s*0/);
  });

  it('keeps Travel action buttons compact, glass, and arrow-free', () => {
    const actions = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-list-actions.tsx'),
      'utf8',
    );

    expect(actions).not.toContain('chevron-right');
    expect(actions).toContain('TravelHomeGlass');
    expect(actions).toContain('mist');
    expect(actions).not.toMatch(
      /<TravelHomeGlass(?:\s[^>]*)?\sclear[\s/>]/,
    );
    expect(actions).toContain('GlassIconWell');
    expect(actions).not.toContain('backgroundColor: iconTone.bg');
    // Primary sheet footer CTA = shared sage GlassPrimaryAction (not solid Button).
    expect(actions).toMatch(
      /function TravelSheetPrimaryAction[\s\S]*?<GlassPrimaryAction[\s\S]*?function TravelSheetSecondaryAction/,
    );
    expect(actions).not.toMatch(
      /function TravelSheetPrimaryAction[\s\S]*?<Button\b[\s\S]*?function TravelSheetSecondaryAction/,
    );
    const primary = readFileSync(
      join(process.cwd(), 'src/components/primitives/glass-primary-action.tsx'),
      'utf8',
    );
    expect(primary).toContain('accent="green"');
    // Grid tiles + wide CTAs center icon+label in the glass plate.
    expect(actions).toMatch(
      /actionGlass:\s*\{[^}]*justifyContent:\s*['"]center['"]/s,
    );
    expect(actions).toMatch(
      /actionContent:\s*\{[^}]*justifyContent:\s*['"]center['"]/s,
    );
    expect(actions).toContain('align="center"');
    // Icon+label share one centered row (not Button leading/label split).
    expect(actions).toMatch(/actionContent:\s*\{[^}]*alignItems:\s*['"]center['"]/s);
    expect(actions).not.toContain('translateY');
  });

  it('marks the trip Calendar action as a sync and refreshes its schedule entries', () => {
    const grid = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-trip-action-grid.tsx'),
      'utf8',
    );
    const tools = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-trip-tools.tsx'),
      'utf8',
    );

    expect(grid).toContain('icon="sync"');
    expect(grid).not.toContain('badgeIcon=');
    expect(grid).toContain('Sync changes for ${tripTitle} with Calendar');
    expect(tools).toContain('travelCalendarDrafts(plan)');
    expect(tools).toContain('replaceTravelActivities');
  });

  it('keeps Travel CTA buttons at the shared default size', () => {
    const files = travelTsxFiles(join(process.cwd(), 'src/features/travel'));

    for (const path of files) {
      const source = readFileSync(path, 'utf8');
      expect({ path, source }).toEqual(
        expect.objectContaining({
          source: expect.not.stringMatching(/<Button\b[^>]*\bsize="lg"/s),
        }),
      );
    }
  });

  it('edits both trip-date endpoints in the canonical Travel sheet', () => {
    const row = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-trip-dates-row.tsx'),
      'utf8',
    );
    const sheet = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-trip-dates-sheet.tsx'),
      'utf8',
    );

    expect(row).toContain('accessibilityRole="button"');
    expect(sheet).toContain('<TravelSheetModal');
    expect(sheet).toContain('<DateFieldCalendar');
    expect(sheet).toContain('rangeStart={fromDateKey(draftStart)}');
    expect(sheet).toContain('rangeEnd={fromDateKey(draftEnd)}');
    expect(sheet).toContain('AgentUiIds.travel.dates.start');
    expect(sheet).toContain('AgentUiIds.travel.dates.end');
  });

  it('wraps trip titles to two lines then ellipsizes at a fixed size', () => {
    const tripCardHeader = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-trip-card-header.tsx'),
      'utf8',
    );
    const detailHero = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-hero.tsx'),
      'utf8',
    );
    const title = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-title.tsx'),
      'utf8',
    );

    for (const source of [tripCardHeader, detailHero]) {
      expect(source).toContain('<TravelPlanTitle');
    }
    expect(tripCardHeader).toContain('styles.content');
    expect(tripCardHeader).toMatch(
      /content:[\s\S]*?flex: 1,[\s\S]*?minWidth: 0,[\s\S]*?position: "relative"/,
    );
    expect(tripCardHeader).toContain('Math.max(22, s(24))');
    expect(tripCardHeader).toContain('paddingRight: controlsWidth + rs.sm');
    expect(title).toContain('numberOfLines={2}');
    expect(title).toContain('ellipsizeMode="tail"');
    expect(title).toContain("width: '100%'");
    expect(title).not.toContain('adjustsFontSizeToFit');
    expect(title).not.toContain('fitMinimumScale');
    expect(title).not.toContain('MINIMUM_SCALE');
  });
});
