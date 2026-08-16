import { fireEvent, render, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChecklistPopoverMenu } from '@/features/todos/checklist-popover-menu';

jest.mock('@/components/primitives/sheet-scaffold', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    SheetHeader: () => null,
    SheetScaffold: ({
      visible,
      title,
      subtitle,
      closeAccessibilityLabel,
      onClose,
      onExited,
      children,
    }: {
      visible: boolean;
      title: string;
      subtitle?: string;
      closeAccessibilityLabel?: string;
      onClose: () => void;
      onExited?: () => void;
      children: React.ReactNode;
    }) => {
      const wasVisible = React.useRef(false);
      React.useEffect(() => {
        if (visible) {
          wasVisible.current = true;
          return;
        }
        if (!wasVisible.current) return;
        wasVisible.current = false;
        onExited?.();
      }, [visible, onExited]);
      return visible
        ? React.createElement(
            View,
            null,
            React.createElement(Text, null, title),
            React.createElement(Text, null, subtitle),
            React.createElement(
              Pressable,
              { accessibilityLabel: closeAccessibilityLabel, onPress: onClose },
            ),
            children,
          )
        : null;
    },
  };
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

describe('ChecklistPopoverMenu', () => {
  it('opens list actions as a bottom sheet and selects an action after exit', () => {
    const onSelect = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistPopoverMenu
          accessibilityLabel="Finance actions"
          title="List Actions"
          triggerIcon="more"
          presentation="sheet"
          sheetSubtitle="Finance"
          items={[
            {
              id: 'copy',
              title: 'Copy',
              description: 'Copy a polished text checklist',
              icon: 'copy',
            },
          ]}
          onSelect={onSelect}
        />
      </SafeAreaProvider>,
    );

    expect(screen.queryByText('List Actions')).toBeNull();
    fireEvent.press(screen.getByLabelText('Finance actions'));
    expect(screen.getByText('List Actions')).toBeTruthy();
    expect(screen.getByText('Finance')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Copy'));
    expect(screen.queryByText('List Actions')).toBeNull();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('copy');
  });

  it('does not run a list action when the sheet is dismissed without a selection', () => {
    const onSelect = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistPopoverMenu
          accessibilityLabel="Finance actions"
          title="List Actions"
          triggerIcon="more"
          presentation="sheet"
          items={[
            {
              id: 'remove',
              title: 'Delete List',
              description: 'Remove this checklist',
              icon: 'delete',
            },
          ]}
          onSelect={onSelect}
        />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByLabelText('Finance actions'));
    fireEvent.press(screen.getByLabelText('Close list actions'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('waits for list actions to finish closing before opening delete confirm', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/todos/checklist-popover-menu.tsx'),
      'utf8',
    );
    expect(source).toContain('onExited={flushPendingSelect}');
    expect(source).not.toContain('setTimeout(() => onSelect(id), 48)');
  });
});
