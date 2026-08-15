import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { AgentUiIds } from '@/utils/agent-ui';

import type { FinanceRecurringBill } from './types';

interface RecurringExpenseDeleteActions {
  closeEditor: () => void;
  removeBill: (id: string) => void;
  removeSubscription: (id: string) => void;
}

type ShowDestructiveConfirmation = typeof confirmDestructiveAction;

/**
 * Presents through SheetScaffold's embedded prompt host so the editor remains
 * mounted behind confirmation. Only a confirmed deletion closes the sheet.
 */
export function openRecurringExpenseDeleteConfirmation(
  expense: FinanceRecurringBill,
  actions: RecurringExpenseDeleteActions,
  confirm: ShowDestructiveConfirmation = confirmDestructiveAction,
): void {
  confirm({
    title: expense.kind === 'subscription'
      ? 'Delete Subscription?'
      : 'Delete Bill?',
    message: `${expense.name} will be removed from recurring expenses.`,
    actionLabel: 'Delete',
    confirmTestID: expense.kind === 'subscription'
      ? AgentUiIds.finance.subscriptions.confirmRemove(expense.id)
      : AgentUiIds.finance.bills.confirmRemove(expense.id),
    onConfirm: () => {
      if (expense.kind === 'subscription') {
        actions.removeSubscription(expense.id);
      } else {
        actions.removeBill(expense.id);
      }
      actions.closeEditor();
    },
  });
}
