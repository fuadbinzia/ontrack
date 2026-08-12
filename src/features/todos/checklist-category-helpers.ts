import type { TodoCategory } from '@/store/todos';

export function sortCategoriesForList(
  categories: TodoCategory[],
  listId: string,
): TodoCategory[] {
  return categories
    .filter((category) => category.listId === listId)
    .sort(
      (left, right) =>
        left.position - right.position || left.name.localeCompare(right.name),
    );
}
