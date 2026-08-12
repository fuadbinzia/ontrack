import { fireEvent, render, screen } from '@testing-library/react-native';
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
      children,
    }: {
      visible: boolean;
      title: string;
      subtitle?: string;
      closeAccessibilityLabel?: string;
      onClose: () => void;
      children: React.ReactNode;
    }) => visible
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
      : null,
  };
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

describe('ChecklistPopoverMenu', () => {
  it('opens list actions as a bottom sheet and selects an action', () => {
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
    expect(onSelect).toHaveBeenCalledWith('copy');
    expect(screen.queryByText('List Actions')).toBeNull();
  });
});
