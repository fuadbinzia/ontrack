import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChecklistRow } from '@/features/todos/todo-row';
import type { ChecklistTask } from '@/store/todos';

const task: ChecklistTask = {
  id: 'task-test-copy',
  listId: 'list-test-checklist',
  title: 'Copy this checklist item',
  completed: false,
  important: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
};

describe('ChecklistRow', () => {
  it('allows the checklist item title to use the native copy menu', () => {
    render(
      <ChecklistRow
        task={task}
        canComplete
        editMode={false}
        editing={false}
        isActive={false}
        listOwner
        members={[]}
        showCategory={false}
        onDelete={jest.fn()}
        onDragStart={jest.fn()}
        onOpenDetails={jest.fn()}
        onStartEdit={jest.fn()}
        onEndEdit={jest.fn()}
        onToggle={jest.fn()}
        onToggleImportant={jest.fn()}
        onUpdate={jest.fn()}
        testID="ontrack.checklists.detail.task.task-test-copy"
      />,
    );

    expect(screen.getByText(task.title)).toHaveProp('selectable', true);
  });

  it('renders one metadata line and opens item details from the row', () => {
    const onOpenDetails = jest.fn();
    render(
      <ChecklistRow
        task={{ ...task, assigneeUserIds: ['member'] }}
        canComplete
        editMode={false}
        editing={false}
        isActive={false}
        listOwner
        members={[
          {
            listId: task.listId,
            userId: 'owner',
            displayName: 'Owner',
            role: 'owner',
            joinedAt: task.createdAt,
          },
          {
            listId: task.listId,
            userId: 'member',
            displayName: 'Member',
            role: 'member',
            joinedAt: task.createdAt,
          },
        ]}
        showCategory
        categoryName="Finance"
        onDelete={jest.fn()}
        onDragStart={jest.fn()}
        onOpenDetails={onOpenDetails}
        onStartEdit={jest.fn()}
        onEndEdit={jest.fn()}
        onToggle={jest.fn()}
        onToggleImportant={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Assigned to Member')).toBeTruthy();
    expect(screen.queryByText('Member')).toBeNull();
    expect(screen.getByText('Finance')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(`Open details for ${task.title}`));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it('omits uncategorized metadata and its separator', () => {
    render(
      <ChecklistRow
        task={task}
        canComplete
        editMode={false}
        editing={false}
        isActive={false}
        listOwner
        members={[
          {
            listId: task.listId,
            userId: 'owner',
            displayName: 'Owner',
            role: 'owner',
            joinedAt: task.createdAt,
          },
          {
            listId: task.listId,
            userId: 'member',
            displayName: 'Member',
            role: 'member',
            joinedAt: task.createdAt,
          },
        ]}
        showCategory
        onDelete={jest.fn()}
        onDragStart={jest.fn()}
        onOpenDetails={jest.fn()}
        onStartEdit={jest.fn()}
        onEndEdit={jest.fn()}
        onToggle={jest.fn()}
        onToggleImportant={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.queryByText(/Anyone|Uncategorized/)).toBeNull();
  });

  it('shows a category without an Anyone placeholder', () => {
    render(
      <ChecklistRow
        task={task}
        canComplete
        editMode={false}
        editing={false}
        isActive={false}
        listOwner
        members={[]}
        showCategory
        categoryName="Travel"
        onDelete={jest.fn()}
        onDragStart={jest.fn()}
        onOpenDetails={jest.fn()}
        onStartEdit={jest.fn()}
        onEndEdit={jest.fn()}
        onToggle={jest.fn()}
        onToggleImportant={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.getByText('Travel')).toBeTruthy();
    expect(screen.queryByText(/Anyone/)).toBeNull();
  });

  it('lets a completed item recede without a filled checkbox well', () => {
    render(
      <ChecklistRow
        task={{ ...task, completed: true }}
        canComplete
        editMode={false}
        editing={false}
        isActive={false}
        listOwner
        members={[]}
        showCategory={false}
        onDelete={jest.fn()}
        onDragStart={jest.fn()}
        onOpenDetails={jest.fn()}
        onStartEdit={jest.fn()}
        onEndEdit={jest.fn()}
        onToggle={jest.fn()}
        onToggleImportant={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    const checkbox = screen.getByLabelText(`Mark ${task.title} as open`);
    expect(checkbox.props.accessibilityState).toMatchObject({ checked: true });
    expect(checkbox.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: 'transparent' }),
      ]),
    );
    expect(screen.queryByText('Focus')).toBeNull();
  });

  it('does not print a Focus caption on important items', () => {
    render(
      <ChecklistRow
        task={{ ...task, important: true }}
        canComplete
        editMode={false}
        editing={false}
        isActive={false}
        listOwner
        members={[]}
        showCategory={false}
        onDelete={jest.fn()}
        onDragStart={jest.fn()}
        onOpenDetails={jest.fn()}
        onStartEdit={jest.fn()}
        onEndEdit={jest.fn()}
        onToggle={jest.fn()}
        onToggleImportant={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.queryByText('Focus')).toBeNull();
    expect(screen.getByLabelText(`Remove ${task.title} from focus`)).toBeTruthy();
  });
});
