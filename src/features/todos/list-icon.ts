import type { AppIconName } from '@/design-system';
import { isGroceryListName, type ChecklistKind } from '@/store/todos';

export function checklistIcon(
  name: string,
  kind?: ChecklistKind,
): AppIconName {
  if (kind === 'grocery' || isGroceryListName(name)) return 'groceries';
  if (/\b(maintenance|repair|repairs)\b/i.test(name.trim())) return 'maintenance';
  return 'tasks';
}

export function collaboratorInitial(name: string): string {
  return name.trim().slice(0, 1).toLocaleUpperCase();
}
