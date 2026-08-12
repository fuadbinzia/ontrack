import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import type {
  TodoList,
  TodoMember,
  TodoRecipe,
  TodoTask,
} from '@/store/todos';

export const ONTRACK_LIST_SHARE_URL =
  process.env.EXPO_PUBLIC_TODO_SHARE_BASE_URL ?? 'https://ontrack--links.expo.app';

function assigneeName(task: TodoTask, members: TodoMember[]): string | undefined {
  const ids = task.assigneeUserIds ?? [];
  if (ids.length === 0) return 'Anyone';
  const names = ids.map(
    (userId) =>
      members.find((member) => member.userId === userId)?.displayName ?? 'Member',
  );
  return names.join(', ');
}

export function formatTodoListText(
  list: Pick<TodoList, 'name'>,
  tasks: TodoTask[],
  members: TodoMember[] = [],
  recipes: TodoRecipe[] = [],
): string {
  const openTasks = tasks.filter((task) => !task.completed);
  const collaborative = members.length > 1;
  const taskLine = (task: TodoTask) => {
    const focus = task.important ? '★ ' : '';
    const assignment = collaborative ? assigneeName(task, members) : undefined;
    return `${focus}☐ ${task.title}${assignment ? ` — ${assignment}` : ''}`;
  };
  const recipeLines = recipes.flatMap((recipe) => {
    const ingredients = openTasks.filter((task) => task.recipeId === recipe.id);
    if (!ingredients.length) return [];
    const source = recipe.sourceUrl ? `\n  ${recipe.sourceUrl}` : '';
    return [
      `\n🍽 ${recipe.name}${recipe.targetServings ? ` · ${recipe.targetServings} servings` : ''}${source}`,
      ...ingredients.map((task) => `  ${taskLine(task)}`),
    ];
  });
  const standaloneLines = openTasks
    .filter((task) => !task.recipeId)
    .map(taskLine);
  const lines = [
    ...recipeLines,
    ...(standaloneLines.length && recipeLines.length ? ['\nOther items'] : []),
    ...standaloneLines,
  ];
  const body = lines.length > 0 ? lines.join('\n') : '✓ All done!';
  const summary =
    openTasks.length === 0
      ? 'All done · onTrack'
      : `${openTasks.length} open ${openTasks.length === 1 ? 'item' : 'items'} · onTrack`;
  return [`📝 ${list.name}`, '', body, '', summary].join('\n');
}

export async function copyTodoListText(
  list: Pick<TodoList, 'name'>,
  tasks: TodoTask[],
  members: TodoMember[] = [],
  recipes: TodoRecipe[] = [],
): Promise<boolean> {
  return Clipboard.setStringAsync(
    formatTodoListText(list, tasks, members, recipes),
  );
}

export async function shareTodoListText(
  list: Pick<TodoList, 'name'>,
  tasks: TodoTask[],
  members: TodoMember[] = [],
  recipes: TodoRecipe[] = [],
): Promise<boolean> {
  const result = await Share.share(
    {
      title: `${list.name} · onTrack`,
      message: formatTodoListText(list, tasks, members, recipes),
    },
    { subject: list.name },
  );
  return result.action !== Share.dismissedAction;
}

export function createTodoJoinUrl(code: string): string {
  return `${ONTRACK_LIST_SHARE_URL.replace(/\/$/, '')}/l/${code}`;
}

export function createInstalledTodoJoinUrl(code: string): string {
  return `ontrack:///l/${code}`;
}

export function createTodoCollaboratorJoinUrl(code: string): string {
  return `${ONTRACK_LIST_SHARE_URL.replace(/\/$/, '')}/c/${code}`;
}

export function createInstalledTodoCollaboratorJoinUrl(code: string): string {
  return `ontrack:///c/${code}`;
}

export async function shareTodoInvite(listName: string, code: string): Promise<boolean> {
  const url = createTodoJoinUrl(code);
  const message = [`Join my “${listName}” list on onTrack 📝`, url].join('\n\n');
  const result = await Share.share(
    {
      title: `${listName} · onTrack`,
      message,
    },
    { subject: `Join ${listName} on onTrack` },
  );
  return result.action !== Share.dismissedAction;
}

export async function shareTodoCollaboratorInvite(
  listNames: string[],
  code: string,
): Promise<boolean> {
  const url = createTodoCollaboratorJoinUrl(code);
  const label =
    listNames.length === 1
      ? `my “${listNames[0]}” checklist`
      : `${listNames.length} of my checklists`;
  const invitation = `Collaborate on ${label} in onTrack 📝`;
  const result = await Share.share(
    {
      title: 'Collaborate in onTrack',
      message: `${invitation}\n\n${url}`,
    },
    { subject: 'Join my checklists on onTrack' },
  );
  return result.action !== Share.dismissedAction;
}
