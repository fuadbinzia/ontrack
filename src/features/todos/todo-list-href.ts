import { router } from 'expo-router';

export const CHECKLISTS_HREF = '/to-do' as const;

/** Same href goto uses. `push` / `/(tabs)/to-do/${id}` is a same-tab no-op. */
export function checklistDetailHref(listId: string) {
  return `/to-do/${listId}` as const;
}

export function openChecklist(listId: string) {
  router.replace(checklistDetailHref(listId));
}

export function openChecklists() {
  router.replace(CHECKLISTS_HREF);
}
