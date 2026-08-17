import {
  ALL_ASSIGNEES,
  ANYONE_ASSIGNEE,
  checklistAssigneeFilterChoices,
  filterChecklistTasksByAssignee,
  matchesChecklistAssignee,
} from '@/features/todos/checklist-assignee-filter';
import type { ChecklistTask } from '@/store/todos';

const createdAt = '2026-08-12T00:00:00.000Z';

function task(id: string, assigneeUserIds?: string[]): ChecklistTask {
  return {
    id,
    listId: 'list-packing',
    title: id,
    completed: false,
    important: false,
    assigneeUserIds,
    createdAt,
    updatedAt: createdAt,
    version: 1,
  };
}

describe('checklist assignee filter', () => {
  const tasks = [
    task('anyone'),
    task('alex', ['user-alex']),
    task('shared', ['user-alex', 'user-jordan']),
  ];

  it('shows every item when all assignees is selected', () => {
    const filtered = filterChecklistTasksByAssignee(tasks, ALL_ASSIGNEES);

    expect(filtered).toBe(tasks);
    expect(filtered.map((item) => item.id)).toEqual([
      'anyone',
      'alex',
      'shared',
    ]);
  });

  it('offers the host first, then collaborators alphabetically without Anyone', () => {
    expect(
      checklistAssigneeFilterChoices([
        {
          listId: 'list-packing',
          userId: 'user-jordan',
          displayName: 'Jordan Lee',
          role: 'member',
          joinedAt: createdAt,
        },
        {
          listId: 'list-packing',
          userId: 'user-alex',
          displayName: 'Alex Rivera',
          role: 'editor',
          joinedAt: createdAt,
        },
        {
          listId: 'list-packing',
          userId: 'user-host',
          displayName: 'Zoe Morgan',
          role: 'owner',
          joinedAt: createdAt,
        },
      ]),
    ).toEqual([
      { value: ALL_ASSIGNEES, label: 'All assignees' },
      { value: 'user-host', label: 'Zoe Morgan' },
      { value: 'user-alex', label: 'Alex Rivera' },
      { value: 'user-jordan', label: 'Jordan Lee' },
    ]);
  });

  it('keeps the owner role when duplicate member snapshots are merged', () => {
    expect(
      checklistAssigneeFilterChoices([
        {
          listId: 'list-packing',
          userId: 'user-host',
          displayName: 'Zoe Morgan',
          role: 'member',
          joinedAt: createdAt,
        },
        {
          listId: 'list-packing',
          userId: 'user-host',
          displayName: 'Zoe Morgan',
          role: 'owner',
          joinedAt: createdAt,
        },
        {
          listId: 'list-packing',
          userId: 'user-alex',
          displayName: 'Alex Rivera',
          role: 'editor',
          joinedAt: createdAt,
        },
      ]).map((choice) => choice.value),
    ).toEqual([ALL_ASSIGNEES, 'user-host', 'user-alex']);
  });

  it('shows only unassigned items for Anyone', () => {
    expect(
      filterChecklistTasksByAssignee(tasks, ANYONE_ASSIGNEE).map(
        (item) => item.id,
      ),
    ).toEqual(['anyone']);
    expect(matchesChecklistAssignee(task('empty', []), ANYONE_ASSIGNEE)).toBe(
      true,
    );
  });

  it('matches every item containing the selected collaborator', () => {
    expect(
      filterChecklistTasksByAssignee(tasks, 'user-alex').map(
        (item) => item.id,
      ),
    ).toEqual(['alex', 'shared']);
    expect(
      filterChecklistTasksByAssignee(tasks, 'user-jordan').map(
        (item) => item.id,
      ),
    ).toEqual(['shared']);
  });

  it('returns no items for a collaborator without assignments', () => {
    expect(filterChecklistTasksByAssignee(tasks, 'user-missing')).toEqual([]);
  });
});
