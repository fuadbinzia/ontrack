import { AgentUiIds } from '@/utils/agent-ui';
import type { ChecklistMember } from '@/store/todos';

import {
  parseChecklistToolbarAction,
  checklistToolbarActionId,
  checklistToolbarActionItems,
  checklistToolbarActionTestID,
} from '../todo-list-toolbar-actions';

const member: ChecklistMember = {
  listId: 'list-1',
  userId: 'user-alex',
  displayName: 'Alex Rivera',
  role: 'editor',
  joinedAt: '2026-08-12T00:00:00.000Z',
};

describe('checklistToolbarActionItems', () => {
  it('puts sort, assignee, and list actions in one menu', () => {
    const items = checklistToolbarActionItems({
      sort: 'smart',
      members: [member],
      selectedAssigneeId: 'all',
      owner: true,
      canEdit: true,
      completedCount: 2,
    });

    expect(items.map((item) => item.id)).toEqual([
      'sort:manual',
      'sort:smart',
      'sort:newest',
      'sort:oldest',
      'sort:alphabetical',
      'assignee:all',
      'assignee:user-alex',
      'copy',
      'share',
      'clear',
      'remove',
    ]);
    expect(items.find((item) => item.id === 'sort:smart')?.selected).toBe(true);
    expect(items.find((item) => item.id === 'assignee:all')?.selected).toBe(true);
    expect(items.find((item) => item.id === 'assignee:all')?.dividerBefore).toBe(true);
    expect(items.find((item) => item.id === 'copy')?.dividerBefore).toBe(true);
  });

  it('offers Delete List only to the owner', () => {
    const ownerItems = checklistToolbarActionItems({
      sort: 'manual',
      members: [],
      selectedAssigneeId: 'all',
      owner: true,
      canEdit: true,
      completedCount: 0,
    });
    const editorItems = checklistToolbarActionItems({
      sort: 'manual',
      members: [member],
      selectedAssigneeId: 'all',
      owner: false,
      canEdit: true,
      completedCount: 0,
    });
    const memberItems = checklistToolbarActionItems({
      sort: 'manual',
      members: [member],
      selectedAssigneeId: 'all',
      owner: false,
      canEdit: false,
      completedCount: 0,
    });

    expect(ownerItems.find((item) => item.id === 'remove')).toMatchObject({
      title: 'Delete List',
    });
    expect(editorItems.find((item) => item.id === 'remove')).toMatchObject({
      title: 'Leave List',
    });
    expect(memberItems.find((item) => item.id === 'remove')).toMatchObject({
      title: 'Leave List',
    });
    expect(editorItems.some((item) => item.title === 'Delete List')).toBe(false);
  });

  it('omits assignee rows on a private list', () => {
    const items = checklistToolbarActionItems({
      sort: 'manual',
      members: [],
      selectedAssigneeId: 'all',
      owner: true,
      canEdit: true,
      completedCount: 0,
    });

    expect(items.some((item) => item.id.startsWith('assignee:'))).toBe(false);
    expect(items.some((item) => item.id === 'clear')).toBe(false);
  });
});

describe('todoListToolbarAction routing', () => {
  it('parses sort, assignee, and list-action ids', () => {
    expect(parseChecklistToolbarAction(checklistToolbarActionId('sort', 'newest'))).toEqual({
      kind: 'sort',
      value: 'newest',
    });
    expect(parseChecklistToolbarAction(checklistToolbarActionId('assignee', 'all'))).toEqual({
      kind: 'assignee',
      value: 'all',
    });
    expect(parseChecklistToolbarAction('copy')).toEqual({
      kind: 'action',
      value: 'copy',
    });
  });

  it('stamps sort and assignee choices with their own testIDs', () => {
    expect(checklistToolbarActionTestID('sort:smart')).toBe(
      AgentUiIds.checklists.detail.sortOption('smart'),
    );
    expect(checklistToolbarActionTestID('assignee:all')).toBe(
      AgentUiIds.checklists.detail.assigneeOption('all'),
    );
    expect(checklistToolbarActionTestID('copy')).toBe(
      AgentUiIds.checklists.detail.action('copy'),
    );
  });
});
