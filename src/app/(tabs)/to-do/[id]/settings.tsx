import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { ChecklistSettingsSheet } from '@/features/todos/todo-list-settings-screen';
import { goBackOrReplace } from '@/utils/navigation';

function paramId(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim());
    return first?.trim() || undefined;
  }
  return undefined;
}

export default function ChecklistSettingsRoute() {
  const router = useRouter();
  const focused = useIsFocused();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const listId = useMemo(() => paramId(params.id), [params.id]);

  useEffect(() => {
    if (!focused || listId) return;
    goBackOrReplace(router, '/(tabs)/to-do' as never);
  }, [focused, listId, router]);

  if (!listId) return null;

  return (
    <ChecklistSettingsSheet
      listId={listId}
      visible={focused}
      onClose={() =>
        goBackOrReplace(router, `/(tabs)/to-do/${listId}` as never)
      }
    />
  );
}
