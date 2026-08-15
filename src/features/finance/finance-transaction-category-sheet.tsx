import { useEffect, useMemo, useState } from 'react';

import {
  AppText,
  Button,
  SheetScaffold,
} from '@/components/primitives';
import {
  CategoryCreatorSelector,
  type CategoryCreatorOption,
} from '@/components/shared';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import {
  EZPASS_REPLENISHMENT_CATEGORY,
  FINANCE_CATEGORIES,
} from './categories';
import type { FinanceTransaction } from './types';

const TRANSACTION_CATEGORIES = [
  ...FINANCE_CATEGORIES,
  EZPASS_REPLENISHMENT_CATEGORY,
];
const STANDARD_CATEGORY_IDS = new Set(
  TRANSACTION_CATEGORIES.map((category) => category.id.toLocaleLowerCase()),
);

export function FinanceTransactionCategorySheet({
  transaction,
  availableCategoryIds,
  onClose,
  onSave,
}: {
  transaction?: FinanceTransaction;
  availableCategoryIds: readonly string[];
  onClose: () => void;
  onSave: (categoryId: string) => void;
}) {
  const [categoryId, setCategoryId] = useState('other');
  const [customCategories, setCustomCategories] = useState<CategoryCreatorOption[]>([]);

  useEffect(() => {
    if (!transaction) return;
    setCategoryId(transaction.categoryId);
    setCustomCategories(
      [...new Set([...availableCategoryIds, transaction.categoryId])]
        .filter((id) => !STANDARD_CATEGORY_IDS.has(id.toLocaleLowerCase()))
        .map((id) => ({ id, name: id })),
    );
  }, [availableCategoryIds, transaction]);

  const categories = useMemo(
    () => [
      ...TRANSACTION_CATEGORIES.map((category) => ({
        id: category.id,
        name: category.label,
      })),
      ...customCategories,
    ],
    [customCategories],
  );

  const createCategory = (name: string): CategoryCreatorOption | undefined => {
    const clean = name.trim();
    if (!clean || categories.some(
      (category) => category.name.localeCompare(clean, undefined, { sensitivity: 'base' }) === 0,
    )) {
      return undefined;
    }
    const created = { id: clean, name: clean };
    setCustomCategories((current) => [...current, created]);
    return created;
  };

  const save = () => {
    onSave(categoryId);
    onClose();
  };

  return (
    <SheetScaffold
      visible={Boolean(transaction)}
      eyebrow="Transaction"
      title="Categorize Transaction"
      subtitle={transaction
        ? `${transaction.merchant} · ${formatMoney(transaction.amount, transaction.currency)}`
        : undefined}
      onClose={onClose}
      closeAccessibilityLabel="Close Categorize Transaction"
      closeTestID={AgentUiIds.finance.transactions.categoryClose}
      backdropTestID={AgentUiIds.finance.transactions.categoryBackdrop}
      fitContent
      footer={(
        <Button
          icon="check"
          onPress={save}
          testID={AgentUiIds.finance.transactions.categorySave}>
          Save Category
        </Button>
      )}>
      <AgentTestId
        testID={AgentUiIds.finance.transactions.categorySheet}
        label="Categorize Transaction">
        <AppText variant="caption" color="secondary">
          This category will also apply to transactions with the same merchant.
        </AppText>
        <CategoryCreatorSelector
          value={categoryId}
          categories={categories}
          onSelect={setCategoryId}
          onCreateCategory={createCategory}
          testID={AgentUiIds.finance.transactions.categorySelector}
          optionTestID={AgentUiIds.finance.transactions.category}
          newCategoryNameTestID={AgentUiIds.finance.transactions.newCategoryName}
          createCategoryTestID={AgentUiIds.finance.transactions.createCategory}
          resetKey={transaction?.id}
        />
      </AgentTestId>
    </SheetScaffold>
  );
}
