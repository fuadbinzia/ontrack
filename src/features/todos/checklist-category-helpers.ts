import type { ChecklistCategory, ChecklistTask } from '@/store/todos';

export function sortCategoriesForList(
  categories: ChecklistCategory[],
  listId: string,
): ChecklistCategory[] {
  return categories
    .filter((category) => category.listId === listId)
    .sort(
      (left, right) =>
        left.position - right.position || left.name.localeCompare(right.name),
    );
}

export function partitionChecklistCategories(
  categories: readonly ChecklistCategory[],
  tasks: readonly Pick<ChecklistTask, 'categoryId'>[],
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
