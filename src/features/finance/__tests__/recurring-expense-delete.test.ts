import { confirmDestructiveAction } from '@/utils/confirm-destructive';

import { createFinanceBill } from '../create';
import { openRecurringExpenseDeleteConfirmation } from '../recurring-expense-delete';

function expense(kind: 'bill' | 'subscription' = 'subscription') {
  return createFinanceBill({
    id: 'recurring-1',
    name: 'Cloud Storage',
    amount: 2.99,
    currency: 'USD',
    cadence: 'monthly',
    nextDue: '2026-09-01',
    entityId: 'personal',
    kind,
  });
}

describe('recurring expense delete confirmation', () => {
  it('keeps the edit sheet open behind confirmation and leaves it open on cancel', () => {
    const row = expense();
    const actions = {
      closeEditor: jest.fn(),
      removeBill: jest.fn(),
      removeSubscription: jest.fn(),
    };
    const confirm = jest.fn(
      (_options: Parameters<typeof confirmDestructiveAction>[0]) => undefined,
    );

    openRecurringExpenseDeleteConfirmation(row, actions, confirm);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(actions.closeEditor).not.toHaveBeenCalled();
    expect(actions.removeSubscription).not.toHaveBeenCalled();
    expect(actions.removeBill).not.toHaveBeenCalled();
  });

  it.each([
    ['subscription', 'removeSubscription', 'removeBill'],
    ['bill', 'removeBill', 'removeSubscription'],
  ] as const)('confirms deletion for a %s and then closes the editor', (
    kind,
    expectedRemoval,
    otherRemoval,
  ) => {
    const actions = {
      closeEditor: jest.fn(),
      removeBill: jest.fn(),
      removeSubscription: jest.fn(),
    };

    openRecurringExpenseDeleteConfirmation(
      expense(kind),
      actions,
      (options) => options.onConfirm(),
    );

    expect(actions[expectedRemoval]).toHaveBeenCalledWith('recurring-1');
    expect(actions[otherRemoval]).not.toHaveBeenCalled();
    expect(actions.closeEditor).toHaveBeenCalledTimes(1);
  });
});
