import { readFileSync } from 'node:fs';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChecklistTaskDetailsSheet } from '@/features/todos/checklist-task-details-sheet';
import type { TodoCategory, TodoMember, TodoTask } from '@/store/todos';

jest.mock('@/components/primitives/sheet-scaffold', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  let nextInstance = 0;
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
    }) => {
      const [instance] = React.useState(() => ++nextInstance);
      return visible
        ? React.createElement(
          View,
          {
            accessibilityLabel: `Sheet instance ${instance}`,
            testID: 'mock-sheet-scaffold',
          },
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

jest.mock('@/components/primitives/dropdown', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    Dropdown: ({
      accessibilityLabel,
      value,
      options,
      onChange,
      onReselect,
      open: openProp,
      onOpenChange,
      menuFooter,
    }: {
      accessibilityLabel: string;
      value: string;
      options: { value: string; label: string; leading?: React.ReactNode }[];
      onChange: (value: string) => void;
      onReselect?: (value: string) => void;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
      menuFooter?: React.ReactNode;
    }) => {
      const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
      const open = openProp ?? uncontrolledOpen;
      const setOpen = (next: boolean) => {
        onOpenChange?.(next);
        if (openProp === undefined) setUncontrolledOpen(next);
      };
      const selected = options.find((option) => option.value === value);
      return React.createElement(
        View,
        null,
        React.createElement(
          Pressable,
          { accessibilityLabel, onPress: () => setOpen(!open) },
          React.createElement(Text, null, selected?.label),
        ),
        open
          ? React.createElement(
              View,
              null,
              options.map((option) => React.createElement(
                Pressable,
                {
                  key: option.value,
                  accessibilityLabel: option.label,
                  testID: `${accessibilityLabel}-option-${options.indexOf(option)}`,
                  onPress: () => {
                    if (option.value === value) onReselect?.(option.value);
                    else onChange(option.value);
                    setOpen(false);
                  },
                },
                option.leading,
                React.createElement(Text, null, option.label),
              )),
              menuFooter,
            )
          : null,
      );
    },
  };
});

const createdAt = '2026-08-12T00:00:00.000Z';
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const category: TodoCategory = {
  id: 'category-finance',
  listId: 'list-checklist',
  name: 'Finance',
  position: 0,
  createdAt,
  updatedAt: createdAt,
};
const member: TodoMember = {
  listId: category.listId,
  userId: 'member-jordan',
  displayName: 'Jordan Lee',
  role: 'member',
  joinedAt: createdAt,
};
const task: TodoTask = {
  id: 'task-finance',
  listId: category.listId,
  title: 'Review property tax tracker',
  completed: false,
  important: false,
  createdAt,
  updatedAt: createdAt,
  version: 0,
};

describe('ChecklistTaskDetailsSheet', () => {
  it('keys the complete editor to the active task', () => {
    const source = readFileSync(
      'src/features/todos/checklist-task-details-sheet.tsx',
      'utf8',
    );
    expect(source).toContain(
      "<ChecklistTaskDetailsSheet\n      key={task?.id ?? 'closed-item-details'}",
    );
  });

  it('remounts sheet layout when switching between items', () => {
    const props = {
      members: [member],
      categories: [category],
      onUpdateTitle: jest.fn(),
      onSetAssignee: jest.fn(),
      onSetCategory: jest.fn(),
      onCreateCategory: jest.fn(),
      onClose: jest.fn(),
    };
    const view = render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistTaskDetailsSheet task={task} {...props} />
      </SafeAreaProvider>,
    );
    const firstInstance = screen.getByTestId('mock-sheet-scaffold').props
      .accessibilityLabel;

    view.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistTaskDetailsSheet
          task={{ ...task, id: 'task-short', title: 'Pet' }}
          {...props}
        />
      </SafeAreaProvider>,
    );
    const secondInstance = screen.getByTestId('mock-sheet-scaffold').props
      .accessibilityLabel;
    expect(secondInstance).not.toBe(firstInstance);

    view.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistTaskDetailsSheet task={task} {...props} />
      </SafeAreaProvider>,
    );
    expect(
      screen.getByTestId('mock-sheet-scaffold').props.accessibilityLabel,
    ).not.toBe(secondInstance);
  });

  it('reserves wrapped-line height for a long title before native measurement', () => {
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistTaskDetailsSheet
          task={{
            ...task,
            title:
              'Finance section with bill management, property tax tracker, insurance tracker, car, credit cards, and more',
          }}
          members={[member]}
          categories={[category]}
          onUpdateTitle={jest.fn()}
          onSetAssignee={jest.fn()}
          onSetCategory={jest.fn()}
          onCreateCategory={jest.fn()}
          onClose={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    const titleInput = screen.getByLabelText('Item title');
    const style = StyleSheet.flatten(titleInput.props.style);
    expect(style?.minHeight).toBeGreaterThan(100);
    expect(style?.maxHeight).toBeGreaterThanOrEqual(style?.minHeight ?? 0);
    expect(titleInput.props.scrollEnabled).toBe(true);
  });

  it('grows the title field from content size up to a fitContent-friendly cap', () => {
    const view = render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistTaskDetailsSheet
          task={{ ...task, title: 'Pet' }}
          members={[member]}
          categories={[category]}
          onUpdateTitle={jest.fn()}
          onSetAssignee={jest.fn()}
          onSetCategory={jest.fn()}
          onCreateCategory={jest.fn()}
          onClose={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    const titleInput = screen.getByLabelText('Item title');
    const compactStyle = StyleSheet.flatten(titleInput.props.style);
    expect(titleInput.props.scrollEnabled).toBe(true);

    fireEvent(titleInput, 'contentSizeChange', {
      nativeEvent: { contentSize: { width: 280, height: 72 } },
    });

    const multilineInput = screen.getByLabelText('Item title');
    const multilineStyle = StyleSheet.flatten(multilineInput.props.style);
    const padY = Number(multilineStyle?.paddingVertical ?? 0);
    expect(multilineStyle?.minHeight).toBeGreaterThan(compactStyle?.minHeight ?? 0);
    expect(multilineStyle?.minHeight).toBe(Math.ceil(72 + padY * 2));
    expect(multilineStyle?.maxHeight).toBeGreaterThanOrEqual(
      multilineStyle?.minHeight ?? 0,
    );
    expect(multilineInput.props.scrollEnabled).toBe(true);

    fireEvent(multilineInput, 'focus');
    expect(StyleSheet.flatten(multilineInput.props.style)?.color).not.toBe(
      'transparent',
    );
    fireEvent(multilineInput, 'blur');

    view.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistTaskDetailsSheet
          task={{ ...task, title: 'A different long checklist item title' }}
          members={[member]}
          categories={[category]}
          onUpdateTitle={jest.fn()}
          onSetAssignee={jest.fn()}
          onSetCategory={jest.fn()}
          onCreateCategory={jest.fn()}
          onClose={jest.fn()}
        />
      </SafeAreaProvider>,
    );
    expect(
      StyleSheet.flatten(screen.getByLabelText('Item title').props.style)
        ?.minHeight,
    ).toBeLessThan(multilineStyle?.minHeight ?? Number.POSITIVE_INFINITY);

    fireEvent(screen.getByLabelText('Item title'), 'contentSizeChange', {
      nativeEvent: { contentSize: { width: 280, height: 240 } },
    });

    const expandedInput = screen.getByLabelText('Item title');
    const expandedStyle = StyleSheet.flatten(expandedInput.props.style);
    expect(expandedStyle?.minHeight).toBe(expandedStyle?.maxHeight);
    expect(expandedInput.props.scrollEnabled).toBe(true);
  });

  it('edits the title, assignee, and category from the same sheet', () => {
    const onUpdateTitle = jest.fn();
    const onSetAssignee = jest.fn();
    const onSetCategory = jest.fn();
    const onClose = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistTaskDetailsSheet
          task={task}
          members={[member]}
          categories={[category]}
          onUpdateTitle={onUpdateTitle}
          onSetAssignee={onSetAssignee}
          onSetCategory={onSetCategory}
          onCreateCategory={jest.fn()}
          onClose={onClose}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Item Details')).toBeTruthy();
    expect(screen.getByDisplayValue(task.title)).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Item title'), 'Review taxes');
    fireEvent.press(screen.getByLabelText(/Save item title/i));
    expect(screen.getByText('Anyone')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Assigned to'));
    expect(screen.getByLabelText(`${member.displayName} avatar`)).toBeTruthy();
    fireEvent.press(screen.getByLabelText(member.displayName));
    fireEvent.press(screen.getByLabelText('Category'));
    fireEvent.press(screen.getByLabelText(category.name));
    fireEvent.press(screen.getByLabelText('Close item details'));

    expect(onUpdateTitle).toHaveBeenCalledWith('Review taxes');
    expect(onSetAssignee).toHaveBeenCalledWith(member.userId);
    expect(onSetCategory).toHaveBeenCalledWith(category.id);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('creates a category and selects it without leaving the sheet', () => {
    const createdCategory: TodoCategory = {
      ...category,
      id: 'category-pet',
      name: 'Pet',
      position: 1,
    };
    const onCreateCategory = jest.fn(() => createdCategory);
    const onSetCategory = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistTaskDetailsSheet
          task={task}
          members={[member]}
          categories={[category]}
          onUpdateTitle={jest.fn()}
          onSetAssignee={jest.fn()}
          onSetCategory={onSetCategory}
          onCreateCategory={onCreateCategory}
          onClose={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    expect(screen.queryByLabelText('New category name')).toBeNull();
    fireEvent.press(screen.getByLabelText('Category'));
    fireEvent.changeText(screen.getByLabelText('New category name'), 'Pet');
    expect(screen.queryByText('Add')).toBeNull();
    fireEvent.press(screen.getByLabelText(/Create category/i));

    expect(onCreateCategory).toHaveBeenCalledWith('Pet');
    expect(onSetCategory).toHaveBeenCalledWith(createdCategory.id);
    expect(screen.getByText('Item Details')).toBeTruthy();
  });

  it('removes the category when the selected category is tapped again', () => {
    const onSetCategory = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistTaskDetailsSheet
          task={{ ...task, categoryId: category.id }}
          members={[member]}
          categories={[category]}
          onUpdateTitle={jest.fn()}
          onSetAssignee={jest.fn()}
          onSetCategory={onSetCategory}
          onCreateCategory={jest.fn()}
          onClose={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByLabelText('Category'));
    fireEvent.press(screen.getByLabelText(category.name));

    expect(onSetCategory).toHaveBeenCalledWith(undefined);
  });

  it('pins each selection first and alphabetizes the remaining options', () => {
    const alex: TodoMember = {
      ...member,
      userId: 'member-alex',
      displayName: 'Alex Morgan',
    };
    const zoe: TodoMember = {
      ...member,
      userId: 'member-zoe',
      displayName: 'Zoe Chen',
    };
    const food: TodoCategory = {
      ...category,
      id: 'category-food',
      name: 'Food',
    };
    const travel: TodoCategory = {
      ...category,
      id: 'category-travel',
      name: 'Travel',
    };
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ChecklistTaskDetailsSheet
          task={{
            ...task,
            assigneeUserId: member.userId,
            categoryId: category.id,
          }}
          members={[zoe, member, alex]}
          categories={[travel, category, food]}
          onUpdateTitle={jest.fn()}
          onSetAssignee={jest.fn()}
          onSetCategory={jest.fn()}
          onCreateCategory={jest.fn()}
          onClose={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByLabelText('Assigned to'));
    expect(screen.getByTestId('Assigned to-option-0')).toHaveProp(
      'accessibilityLabel',
      member.displayName,
    );
    expect(screen.getByTestId('Assigned to-option-1')).toHaveProp(
      'accessibilityLabel',
      alex.displayName,
    );
    expect(screen.getByTestId('Assigned to-option-2')).toHaveProp(
      'accessibilityLabel',
      'Anyone',
    );
    expect(screen.getByTestId('Assigned to-option-3')).toHaveProp(
      'accessibilityLabel',
      zoe.displayName,
    );

    fireEvent.press(screen.getByLabelText('Assigned to'));
    fireEvent.press(screen.getByLabelText('Category'));
    expect(screen.getByTestId('Category-option-0')).toHaveProp(
      'accessibilityLabel',
      category.name,
    );
    expect(screen.getByTestId('Category-option-1')).toHaveProp(
      'accessibilityLabel',
      food.name,
    );
    expect(screen.getByTestId('Category-option-2')).toHaveProp(
      'accessibilityLabel',
      travel.name,
    );
    expect(screen.getByTestId('Category-option-3')).toHaveProp(
      'accessibilityLabel',
      'Uncategorized',
    );
  });
});
