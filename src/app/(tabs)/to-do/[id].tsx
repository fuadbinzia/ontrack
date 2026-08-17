import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { GroceryListScreen } from '@/features/todos/grocery-list-screen';
import { ChecklistScreen } from '@/features/todos/todo-list-screen';
import { useHeldVisible } from '@/features/todos/todo-list-visible';
import { flushCloudDomain } from '@/services/cloud/sync';
import { useChecklists } from '@/store/todos';

export default function ChecklistRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kind = useChecklists(
    (state) => state.lists.find((list) => list.id === id)?.kind,
  );
  const rememberedKind = useHeldVisible(kind);
  const touchList = useChecklists((state) => state.touchList);
  // Focus-only: hub prefetch mounts this route while warming — a warm must
  // never count as an open, or the hub reorders itself on every land.
  useFocusEffect(
    useCallback(() => {
      if (typeof id === 'string' && id && touchList(id)) {
        // Push the promotion now — the debounced sync loses it if the app is
        // killed right after, and a sign-in restore then reverts the order.
        void flushCloudDomain('todos');
      }
    }, [id, touchList]),
  );
  return rememberedKind.value === 'grocery' ? (
    <GroceryListScreen listId={id} />
  ) : (
    <ChecklistScreen listId={id} />
  );
}
