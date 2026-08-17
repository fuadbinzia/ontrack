import { useEffect, useRef } from 'react';

import { openChecklists } from '@/features/todos/todo-list-href';
import { useChecklists, type Checklist } from '@/store/todos';

/** Keep the last painted list while it leaves the store so delete can go to the hub. */
export function rememberVisibleChecklist<T>(
  current: T | undefined,
  held: T | undefined,
): { value: T | undefined; held: T | undefined; vanished: boolean } {
  if (current !== undefined) {
    return { value: current, held: current, vanished: false };
  }
  if (held !== undefined) {
    return { value: held, held, vanished: true };
  }
  return { value: undefined, held: undefined, vanished: false };
}

export function useHeldVisible<T>(
  current: T | undefined,
): { value: T | undefined; vanished: boolean } {
  const heldRef = useRef(current);
  const remembered = rememberVisibleChecklist(current, heldRef.current);
  heldRef.current = remembered.held;
  return remembered;
}

export function useVisibleChecklist(
  listId: string | undefined,
): Checklist | undefined {
  const storeList = useChecklists((state) =>
    listId ? state.lists.find((item) => item.id === listId) : undefined,
  );
  const remembered = useHeldVisible(storeList);

  useEffect(() => {
    if (!remembered.vanished) return;
    openChecklists();
  }, [remembered.vanished]);

  return remembered.value;
}
