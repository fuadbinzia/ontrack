import type { TodoCategory, TodoTask } from '@/store/todos';

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

export function partitionChecklistCategories(
  categories: readonly TodoCategory[],
  tasks: readonly Pick<TodoTask, 'categoryId'>[],
) {
  const populatedCategoryIds = new Set(
    tasks.flatMap((task) => (task.categoryId ? [task.categoryId] : [])),
  );
  return {
    populated: categories.filter((category) =>
      populatedCategoryIds.has(category.id),
    ),
    emptyIds: categories
      .filter((category) => !populatedCategoryIds.has(category.id))
      .map((category) => category.id),
  };
}
