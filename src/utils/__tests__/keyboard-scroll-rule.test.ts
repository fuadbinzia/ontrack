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

  it('keeps the travel chat composer above the iOS keyboard', () => {
    const chatScreen = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-chat-screen.tsx'),
      'utf8',
    );

    expect(chatScreen).toContain("'keyboardWillChangeFrame'");
    expect(chatScreen).toContain('Keyboard.scheduleLayoutAnimation(event)');
    expect(chatScreen).toContain('marginBottom: keyboardInset');
    expect(chatScreen).not.toContain('<KeyboardAvoidingView');
  });

  it('lifts modal sheets above the docked soft keyboard', () => {
    const scaffold = readFileSync(
      join(process.cwd(), 'src/components/primitives/sheet-scaffold.tsx'),
      'utf8',
    );

    expect(scaffold).toContain("'keyboardWillChangeFrame'");
    expect(scaffold).toContain('Keyboard.scheduleLayoutAnimation(event)');
    expect(scaffold).toContain('bottom: keyboardInset');
    expect(scaffold).toContain('automaticallyAdjustKeyboardInsets={false}');
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
    expect(todoScreen).not.toContain('TouchableWithoutFeedback');
  });
});
