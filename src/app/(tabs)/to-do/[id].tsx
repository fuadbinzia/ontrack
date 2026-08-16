import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { GroceryListScreen } from '@/features/todos/grocery-list-screen';
import { TodoListScreen } from '@/features/todos/todo-list-screen';
import { useHeldVisible } from '@/features/todos/todo-list-visible';
import { useTodos } from '@/store/todos';

export default function TodoListRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kind = useTodos(
    (state) => state.lists.find((list) => list.id === id)?.kind,
  );
  const rememberedKind = useHeldVisible(kind);
  const touchList = useTodos((state) => state.touchList);
  useEffect(() => {
    if (typeof id === 'string' && id) touchList(id);
  }, [id, touchList]);
  return rememberedKind.value === 'grocery' ? (
    <GroceryListScreen listId={id} />
  ) : (
    <TodoListScreen listId={id} />
  );
}
