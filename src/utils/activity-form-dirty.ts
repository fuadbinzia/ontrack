type ActivityFormSnapshot = Record<string, unknown> & {
  categoryId?: unknown;
};

function serialize(snapshot: ActivityFormSnapshot) {
  return JSON.stringify(snapshot);
}

/**
 * Category selection is navigation within a new empty draft, not content worth
 * guarding. Existing activities still treat a category change as an edit.
 */
export function hasUnsavedActivityChanges(
  initial: ActivityFormSnapshot,
  current: ActivityFormSnapshot,
  isEditing: boolean,
) {
  if (isEditing) return serialize(current) !== serialize(initial);

  const { categoryId: _initialCategoryId, ...initialDraft } = initial;
  const { categoryId: _currentCategoryId, ...currentDraft } = current;
  return serialize(currentDraft) !== serialize(initialDraft);
}
