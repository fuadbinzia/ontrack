import { useEffect, useRef } from 'react';

import { openTodoLists } from '@/features/todos/todo-list-href';
import { useTodos, type TodoList } from '@/store/todos';

/** Keep the last painted list while it leaves the store so delete can go to the hub. */
export function rememberVisibleTodoList<T>(
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
  const remembered = rememberVisibleTodoList(current, heldRef.current);
  heldRef.current = remembered.held;
  return remembered;
}

export function useVisibleTodoList(
  listId: string | undefined,
): TodoList | undefined {
  const storeList = useTodos((state) =>
    listId ? state.lists.find((item) => item.id === listId) : undefined,
  );
  const remembered = useHeldVisible(storeList);

  useEffect(() => {
    if (!remembered.vanished) return;
    openTodoLists();
  }, [remembered.vanished]);

  return remembered.value;
}
