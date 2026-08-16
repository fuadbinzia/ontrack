import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('keyboard scrolling invariant', () => {
  it('keeps shared scrollable screens usable above the keyboard', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/components/primitives/screen.tsx'),
      'utf8',
    );

    expect(screen).toContain('automaticallyAdjustKeyboardInsets');
    expect(screen).toContain('keyboardShouldPersistTaps="handled"');
    expect(screen).toContain(
      "Platform.OS === 'ios' ? 'interactive' : 'on-drag'",
    );
    expect(screen).toContain('scrollContent: { flexGrow: 1 }');
  });

  it('preserves the non-scrolling top safe-area ownership', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/components/primitives/screen.tsx'),
      'utf8',
    );

    expect(screen).toContain('contentInsetAdjustmentBehavior="never"');
    expect(screen).not.toMatch(/paddingTop\s*:\s*.*insets\.top/);
  });

  it('keeps docked composers and sheets on the shared keyboard inset hook', () => {
    const hook = readFileSync(
      join(process.cwd(), 'src/hooks/use-docked-keyboard-inset.ts'),
      'utf8',
    );
    const chatScreen = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-chat-screen.tsx'),
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

    expect(hook).toContain('dockedKeyboardInsetFromEvent');
    expect(hook).toContain("androidMode === 'resize'");
    expect(hook).not.toContain('insets.bottom');
    expect(chatScreen).toContain('useDockedKeyboardInset');
    // Absolute dock: IME lifts via `bottom`, not margin (flush under tab bar).
    expect(chatScreen).toContain('bottom: composerLift');
    expect(chatScreen).toMatch(
      /const composerLift = keyboardOpen[\s\S]*?keyboardInset[\s\S]*?tabBarHeight/,
    );
    expect(chatScreen).not.toContain('<KeyboardAvoidingView');
    expect(scaffold).toContain('useDockedKeyboardInset');
    expect(scaffold).toContain("androidMode: 'modal'");
    expect(scaffold).toContain('bottom: keyboardInset');
    expect(scaffold).toContain('automaticallyAdjustKeyboardInsets={false}');
    expect(addSheet).toContain('useDockedKeyboardInset');
    expect(addSheet).toContain("androidMode: 'resize'");
    expect(addSheet).toContain('sheetBottom');
    expect(addSheet).not.toContain('screenY - insets.bottom');
    expect(addSheet).not.toContain('kbHeight - insets.bottom');
  });

  it('keeps sheet CTAs in-scroll (never pinned under the tab dock)', () => {
    const scaffold = readFileSync(
      join(process.cwd(), 'src/components/primitives/sheet-scaffold.tsx'),
      'utf8',
    );
    const addSheet = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-itinerary-add-sheet.tsx'),
      'utf8',
    );

    for (const source of [scaffold, addSheet]) {
      expect(source).toContain('styles.body');
      expect(source).toContain('styles.headerSlot');
      expect(source).not.toContain('styles.footerSlot');
      expect(source).toMatch(/body:\s*\{[\s\S]*?minHeight:\s*0/);
      expect(source).toContain('<ScrollView');
    }

    // Footer / submit rendered inside the ScrollView children, not as a sibling.
    expect(scaffold).toMatch(
      /<ScrollView[\s\S]*\{footer \? \([\s\S]*<\/ScrollView>/,
    );
    expect(addSheet).toMatch(
      /<ScrollView[\s\S]*ItinerarySheetSubmitButton[\s\S]*<\/ScrollView>/,
    );
    expect(addSheet).toContain('sheetBottom');
  });

  it('lets the to-do list own the complete page scroll gesture', () => {
    const todoScreen = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-list-screen.tsx'),
      'utf8',
    );

    expect(todoScreen).toContain('<DraggableFlatList');
    expect(todoScreen).toContain('containerStyle={styles.list}');
    expect(todoScreen).toContain('ListHeaderComponent=');
    expect(todoScreen).toContain('automaticallyAdjustKeyboardInsets');
    expect(todoScreen).not.toContain('TouchableWithoutFeedback');
  });

  it('lifts the vehicle parts search modal above the soft keyboard', () => {
    const sheet = readFileSync(
      join(
        process.cwd(),
        'src/features/vehicles/vehicle-parts-search-sheet.tsx',
      ),
      'utf8',
    );
    const scaffold = readFileSync(
      join(process.cwd(), 'src/components/primitives/sheet-scaffold.tsx'),
      'utf8',
    );
    // The sheet delegates keyboard lift to SheetScaffold's docked inset —
    // never a raw Modal without keyboard handling.
    expect(sheet).toContain('SheetScaffold');
    expect(sheet).not.toContain('<Modal');
    expect(scaffold).toContain('useDockedKeyboardInset');
    expect(scaffold).toContain("androidMode: 'modal'");
    expect(scaffold).toContain('keyboardInset');
  });

  it('re-places dropdown overlay menus above the soft keyboard', () => {
    const dropdown = readFileSync(
      join(process.cwd(), 'src/components/primitives/dropdown.tsx'),
      'utf8',
    );
    const layout = readFileSync(
      join(process.cwd(), 'src/components/primitives/dropdown-layout.ts'),
      'utf8',
    );
    expect(dropdown).toContain('useDockedKeyboardInset');
    expect(dropdown).toContain("androidMode: 'modal'");
    expect(dropdown).toContain('keyboardInset');
    expect(dropdown).toContain('measureAnchor');
    expect(layout).toContain('keyboardInset');
    expect(layout).toContain('bottomClearance');
  });
});
