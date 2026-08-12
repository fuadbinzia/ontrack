import type { AppIconName } from '@/design-system';
import { isGroceryListName, type TodoListKind } from '@/store/todos';

export function todoListIcon(
  name: string,
  kind?: TodoListKind,
): AppIconName {
  if (kind === 'grocery' || isGroceryListName(name)) return 'groceries';
  if (/\b(maintenance|repair|repairs)\b/i.test(name.trim())) return 'maintenance';
  return 'tasks';
}

export function collaboratorInitial(name: string): string {
  return name.trim().slice(0, 1).toLocaleUpperCase();
}
