import { applyExpenseSheetSavePresentation } from '@/features/travel/expenses/expense-sheet-save-presentation';

function createActions() {
  return {
    dismissSheet: jest.fn(),
    clearDraft: jest.fn(),
    clearPendingImport: jest.fn(),
    showSavedConfirmation: jest.fn(),
  };
}

describe('expense sheet save presentation', () => {
  it('keeps the expense sheet open after updating an existing expense', () => {
    const actions = createActions();

    applyExpenseSheetSavePresentation('edit', actions);

    expect(actions.dismissSheet).not.toHaveBeenCalled();
    expect(actions.clearDraft).not.toHaveBeenCalled();
    expect(actions.clearPendingImport).not.toHaveBeenCalled();
    expect(actions.showSavedConfirmation).not.toHaveBeenCalled();
  });

  it('dismisses the expense sheet after creating an expense', () => {
    const actions = createActions();

    applyExpenseSheetSavePresentation('create', actions);

    expect(actions.dismissSheet).toHaveBeenCalledTimes(1);
    expect(actions.clearDraft).toHaveBeenCalledTimes(1);
    expect(actions.clearPendingImport).toHaveBeenCalledTimes(1);
    expect(actions.showSavedConfirmation).toHaveBeenCalledTimes(1);
  });

  it('continues to keep the sheet open across repeated expense updates', () => {
    const actions = createActions();

    applyExpenseSheetSavePresentation('edit', actions);
    applyExpenseSheetSavePresentation('edit', actions);

    expect(actions.dismissSheet).not.toHaveBeenCalled();
  });
});
