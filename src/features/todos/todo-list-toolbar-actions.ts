import {
  ALL_ASSIGNEES,
  checklistAssigneeFilterChoices,
} from '@/features/todos/checklist-assignee-filter';
import type { ChecklistPopoverItem } from '@/features/todos/checklist-popover-menu';
import type { TodoSort } from '@/features/todos/todo-sort';
import type { TodoMember } from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';

export const TODO_LIST_SORT_OPTIONS: {
  id: TodoSort;
  title: string;
  description: string;
  icon: ChecklistPopoverItem['icon'];
}[] = [
  {
    id: 'manual',
    title: 'Manual',
    description: 'Your drag-and-drop order',
    icon: 'list',
  },
  {
    id: 'smart',
    title: 'Smart',
    description: 'Important first, then recent',
    icon: 'smart',
  },
  {
    id: 'newest',
    title: 'Newest First',
    description: 'Most recently added at the top',
    icon: 'arrow-down',
  },
  {
    id: 'oldest',
    title: 'Oldest First',
    description: 'Longest-standing items at the top',
    icon: 'arrow-up',
  },
  {
    id: 'alphabetical',
    title: 'A–Z',
    description: 'Arrange items alphabetically',
    icon: 'alphabetical',
  },
];

const SORT_PREFIX = 'sort:';
const ASSIGNEE_PREFIX = 'assignee:';

export function todoListToolbarActionId(
  kind: 'sort' | 'assignee' | 'action',
  id: string,
): string {
  if (kind === 'sort') return `${SORT_PREFIX}${id}`;
  if (kind === 'assignee') return `${ASSIGNEE_PREFIX}${id}`;
  return id;
}

export function parseTodoListToolbarAction(id: string): {
  kind: 'sort' | 'assignee' | 'action';
  value: string;
} {
  if (id.startsWith(SORT_PREFIX)) {
    return { kind: 'sort', value: id.slice(SORT_PREFIX.length) };
  }
  if (id.startsWith(ASSIGNEE_PREFIX)) {
    return { kind: 'assignee', value: id.slice(ASSIGNEE_PREFIX.length) };
  }
  return { kind: 'action', value: id };
}

export function todoListToolbarActionTestID(id: string): string {
  const parsed = parseTodoListToolbarAction(id);
  if (parsed.kind === 'sort') {
    return AgentUiIds.checklists.detail.sortOption(parsed.value);
  }
  if (parsed.kind === 'assignee') {
    return AgentUiIds.checklists.detail.assigneeOption(parsed.value);
  }
  return AgentUiIds.checklists.detail.action(parsed.value);
}

export function todoListToolbarActionItems({
  sort,
  members,
  selectedAssigneeId,
  owner,
  canEdit,
  completedCount,
}: {
  sort: TodoSort;
  members: readonly TodoMember[];
  selectedAssigneeId: string;
  owner: boolean;
  canEdit: boolean;
  completedCount: number;
}): ChecklistPopoverItem[] {
  const assigneeChoices = checklistAssigneeFilterChoices(members);
  const showAssignees = members.length > 0;

  return [
    ...TODO_LIST_SORT_OPTIONS.map((option, index) => ({
      ...option,
      id: todoListToolbarActionId('sort', option.id),
      selected: sort === option.id,
      dividerBefore: index === 0 ? false : undefined,
    })),
    ...(showAssignees
      ? assigneeChoices.map((choice, index) => ({
          id: todoListToolbarActionId('assignee', choice.value),
          title: choice.label,
          description:
            choice.value === ALL_ASSIGNEES
              ? 'Show items for everyone'
              : 'Show items assigned to this person',
          icon: (choice.value === ALL_ASSIGNEES ? 'filter' : 'people') as ChecklistPopoverItem['icon'],
          selected: selectedAssigneeId === choice.value,
          dividerBefore: index === 0,
        }))
      : []),
    {
      id: 'copy',
      title: 'Copy',
      description: 'Copy a polished text checklist',
      icon: 'copy',
      dividerBefore: true,
    },
    {
      id: 'share',
      title: owner ? 'Share' : 'Members',
      description: owner
        ? 'Invite friends, join links, and list settings'
        : 'View people with access',
      icon: owner ? 'share' : 'people',
    },
    ...(canEdit && completedCount > 0
      ? [
          {
            id: 'clear',
            title: 'Clear Completed',
            description: 'Remove every completed item',
            icon: 'delete' as const,
            destructive: true,
            dividerBefore: true,
          },
        ]
      : []),
    {
      id: 'remove',
      title: owner ? 'Delete List' : 'Leave List',
      description: owner
        ? 'Permanently delete this list for everyone'
        : 'Remove this list from your account',
      icon: 'delete' as const,
      destructive: true,
      dividerBefore: !(canEdit && completedCount > 0),
    },
  ];
}
