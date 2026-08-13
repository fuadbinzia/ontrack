import type { TodoMember, TodoTask } from '@/store/todos';

export const ALL_ASSIGNEES = 'all';
export const ANYONE_ASSIGNEE = 'anyone';

export function checklistAssigneeFilterChoices(
  members: readonly TodoMember[],
) {
  const membersByUserId = new Map<string, TodoMember>();
  for (const member of members) {
    const existing = membersByUserId.get(member.userId);
    if (!existing || member.role === 'owner') {
      membersByUserId.set(member.userId, member);
    }
  }
  const uniqueMembers = [...membersByUserId.values()].sort((left, right) => {
    if (left.role === 'owner' && right.role !== 'owner') return -1;
    if (right.role === 'owner' && left.role !== 'owner') return 1;
    return left.displayName.localeCompare(right.displayName);
  });
  return [
    { value: ALL_ASSIGNEES, label: 'All assignees' },
    ...uniqueMembers.map((member) => ({
      value: member.userId,
      label: member.displayName,
    })),
  ];
}

export function matchesChecklistAssignee(
  task: Pick<TodoTask, 'assigneeUserIds'>,
  assigneeId: string,
) {
  if (assigneeId === ALL_ASSIGNEES) return true;
  const assigneeUserIds = task.assigneeUserIds ?? [];
  if (assigneeId === ANYONE_ASSIGNEE) return assigneeUserIds.length === 0;
  return assigneeUserIds.includes(assigneeId);
}

export function filterChecklistTasksByAssignee<T extends TodoTask>(
  tasks: T[],
  assigneeId: string,
): T[] {
  if (assigneeId === ALL_ASSIGNEES) return tasks;
  return tasks.filter((task) => matchesChecklistAssignee(task, assigneeId));
}
