export type ExpenseSheetSaveMode = 'create' | 'edit';

type CreatedExpenseActions = {
  dismissSheet: () => void;
  clearDraft: () => void;
  clearPendingImport: () => void;
  showSavedConfirmation: () => void;
};

/** Keep edits in the expense sheet; only a completed create/import flow dismisses it. */
export function applyExpenseSheetSavePresentation(
  mode: ExpenseSheetSaveMode,
  actions: CreatedExpenseActions,
): void {
  if (mode === 'edit') return;

  actions.dismissSheet();
  actions.clearDraft();
  actions.clearPendingImport();
  actions.showSavedConfirmation();
}
