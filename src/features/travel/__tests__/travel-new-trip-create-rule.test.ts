import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('new trip creation feedback', () => {
  it('keeps the form open and renders an inline error when storage rejects a trip', () => {
    const planActions = readFileSync(
      join(process.cwd(), 'src/features/travel/use-travel-home-plan-actions.ts'),
      'utf8',
    );
    const newTripSheet = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-new-trip-sheet.tsx'),
      'utf8',
    );

    expect(planActions).toMatch(/const saved = savePlan\(/);
    expect(planActions).toContain('creatingPlanRef');
    expect(planActions).toMatch(
      /if \(!saved\) \{\s*creatingPlanRef\.current = false;\s*setError\([\s\S]*?\);\s*return;\s*\}/,
    );
    expect(newTripSheet).toContain(
      '{error ? <ErrorMessage message={error} align="center" /> : null}',
    );
  });

  it('disables pull-to-refresh while the form is open and targets the saved card', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-screen-content.tsx'),
      'utf8',
    );

    const screenHook = readFileSync(
      join(process.cwd(), 'src/features/travel/use-travel-home-screen.ts'),
      'utf8',
    );
    const planActions = readFileSync(
      join(process.cwd(), 'src/features/travel/use-travel-home-plan-actions.ts'),
      'utf8',
    );

    expect(screen).toContain('refresh={!showForm}');
    expect(planActions).toContain('setPendingCreatedTripId(planId)');
    expect(screenHook).toContain('tripOffsets.current[scrollTargetTripId]');
  });

  it('consumes a social or deep-link trip focus after scrolling once', () => {
    const screenHook = readFileSync(
      join(process.cwd(), 'src/features/travel/use-travel-home-screen.ts'),
      'utf8',
    );

    expect(screenHook).toContain('pendingFocusedTripId');
    expect(screenHook).toContain('router.setParams({ tripId: undefined }');
    expect(screenHook).toContain('setPendingFocusedTripId(undefined)');
    expect(screenHook).not.toMatch(
      /pendingCreatedTripId \?\? pendingFollowTripId \?\? focusedTripId/,
    );
  });

  it('starts each new trip with empty departure and return dates', () => {
    const screenHook = readFileSync(
      join(process.cwd(), 'src/features/travel/use-travel-home-screen.ts'),
      'utf8',
    );

    const planActions = readFileSync(
      join(process.cwd(), 'src/features/travel/use-travel-home-plan-actions.ts'),
      'utf8',
    );

    expect(screenHook).toContain("const [startDate, setStartDate] = useState('')");
    expect(screenHook).toContain("const [endDate, setEndDate] = useState('')");
    expect(planActions).toMatch(
      /setDestination\(''\);\s*setDestinationLocation\(undefined\);\s*setStartDate\(''\);\s*setEndDate\(''\);\s*setNotes\(''\);/,
    );
    expect(screenHook).toMatch(
      /useEffect\(\(\) => \{\s*if \(!showForm\) return;\s*setStartDate\(''\);\s*setEndDate\(''\);\s*\}, \[showForm\]\);/,
    );
  });

  it('opens Start a New Trip as a canonical travel bottom sheet', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-home-screen-content.tsx'),
      'utf8',
    );
    const newTripSheet = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-new-trip-sheet.tsx'),
      'utf8',
    );
    const chrome = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-itinerary-sheet-chrome.ts'),
      'utf8',
    );
    const editTrip = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-details-editor.tsx'),
      'utf8',
    );

    expect(screen).toContain('<TravelNewTripSheet');
    expect(screen).toContain('visible={showForm}');
    expect(newTripSheet).toContain('<TravelSheetModal');
    expect(newTripSheet).toContain('title="Start a New Trip"');
    expect(newTripSheet).not.toContain('eyebrow=');
    expect(newTripSheet).not.toContain('TravelPlanModePicker');
    expect(editTrip).not.toContain('TravelPlanModePicker');
    expect(newTripSheet).not.toContain('Import Flight Itinerary');
    expect(newTripSheet).not.toContain('importItinerary');
    expect(newTripSheet).not.toContain('Starting Point');
    expect(newTripSheet).not.toContain('newTrip.origin');
    expect(editTrip).not.toContain('Starting Point');
    expect(newTripSheet).toContain('testID={AgentUiIds.travel.newTrip.dates}');
    expect(newTripSheet).toContain(
      'calendarTestID={AgentUiIds.travel.newTrip.calendar}',
    );
    // Fields sit on the glass sheet as frosted pills, not solid white cards.
    expect(newTripSheet).toContain('itinerarySheetFieldProps');
    expect(editTrip).toContain('itinerarySheetFieldProps');
    expect(newTripSheet).toContain('TRIP_TITLE_PLACEHOLDER');
    expect(editTrip).toContain('TRIP_TITLE_PLACEHOLDER');
    expect(chrome).toContain('glassFieldBackground');
    expect(chrome).toContain('fieldBorderRadius: radii.pill');
    expect(chrome).not.toMatch(/field:\s*'#FFFFFF'/);
  });

  it('opens a Dates field into a multiselect range calendar modal', () => {
    const newTripSheet = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-new-trip-sheet.tsx'),
      'utf8',
    );
    const dateRangeEditor = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-date-range-editor.tsx'),
      'utf8',
    );

    expect(newTripSheet).toContain('testID={AgentUiIds.travel.newTrip.dates}');
    expect(newTripSheet).toContain(
      'calendarTestID={AgentUiIds.travel.newTrip.calendar}',
    );
    expect(dateRangeEditor).toContain('Dates');
    expect(dateRangeEditor).toContain('<TravelSheetModal');
    expect(dateRangeEditor).toContain('<DateFieldCalendar');
    expect(dateRangeEditor).toContain('controlAppearance="glass"');
    expect(dateRangeEditor).toContain('<TravelSheetPrimaryAction');
    expect(dateRangeEditor).not.toMatch(/<Button\b/);
    expect(dateRangeEditor).toContain(
      'rangeStart={draftHasStart ? fromDateKey(draftStart) : undefined}',
    );
    expect(dateRangeEditor).toContain(
      'rangeEnd={draftHasEnd ? fromDateKey(draftEnd) : undefined}',
    );
  });
});
