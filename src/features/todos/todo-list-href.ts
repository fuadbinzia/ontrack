import { router } from 'expo-router';

export const TODO_LISTS_HREF = '/to-do' as const;

/** Same href goto uses. `push` / `/(tabs)/to-do/${id}` is a same-tab no-op. */
export function todoListDetailHref(listId: string) {
  return `/to-do/${listId}` as const;
}

export function openTodoList(listId: string) {
  router.replace(todoListDetailHref(listId));
}

export function openTodoLists() {
  router.replace(TODO_LISTS_HREF);
}
