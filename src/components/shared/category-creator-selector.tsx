import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

import {
  Dropdown,
  ErrorMessage,
  IconButton,
  Input,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

export type CategoryCreatorOption = {
  id: string;
  name: string;
};

export function filterCategoryCreatorOptions(
  options: readonly CategoryCreatorOption[],
  selectedId: string,
  query: string,
): CategoryCreatorOption[] {
  const needle = query.trim().toLocaleLowerCase();
  return options
    .filter((option) => option.name.toLocaleLowerCase().includes(needle))
    .sort((left, right) => {
      const leftSelected = left.id === selectedId;
      const rightSelected = right.id === selectedId;
      if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
      return left.name.localeCompare(right.name, undefined, {
        sensitivity: 'base',
        numeric: true,
      });
    });
}

export function CategoryCreatorSelector({
  value,
  categories,
  onSelect,
  onReselect,
  onCreateCategory,
  testID,
  optionTestID,
  newCategoryNameTestID,
  createCategoryTestID,
  resetKey,
}: {
  value: string;
  categories: readonly CategoryCreatorOption[];
  onSelect: (categoryId: string) => void;
  onReselect?: (categoryId: string) => void;
  onCreateCategory: (name: string) => CategoryCreatorOption | undefined;
  testID: string;
  optionTestID: (categoryId: string) => string;
  newCategoryNameTestID: string;
  createCategoryTestID: string;
  resetKey?: string;
}) {
  const theme = useTheme();
  const { s } = useResponsive();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const footerHeight = Math.max(64, s(68)) + (error ? Math.max(20, s(20)) : 0);
  const options = filterCategoryCreatorOptions(categories, value, draft).map((category) => ({
    value: category.id,
    label: category.name,
    testID: optionTestID(category.id),
  }));

  useEffect(() => {
    setOpen(false);
    setDraft('');
    setError(undefined);
  }, [resetKey]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDraft('');
      setError(undefined);
    }
  };

  const createAndSelect = () => {
    if (!draft.trim()) return;
    const created = onCreateCategory(draft);
    if (!created) {
      setError('Enter a unique category name.');
      return;
    }
    setDraft('');
    setError(undefined);
    onSelect(created.id);
    Keyboard.dismiss();
    setOpen(false);
  };

  return (
    <Dropdown
      label="Category"
      accessibilityLabel="Category"
      open={open}
      onOpenChange={handleOpenChange}
      value={value}
      options={options}
      emptyMessage="No Existing Categories"
      preserveOptionCase
      menuFooter={(
        <>
          <Input
            accessibilityLabel="Search or create category"
            autoCapitalize="words"
            maxLength={40}
            placeholder="Search or create category"
            returnKeyType="done"
            testID={newCategoryNameTestID}
            value={draft}
            onChangeText={(nextDraft) => {
              setDraft(nextDraft);
              if (error) setError(undefined);
            }}
            onSubmitEditing={createAndSelect}
            trailing={(
              <IconButton
                accessibilityLabel="Create category"
                color={theme.accentPrimary}
                disabled={!draft.trim()}
                icon="add"
                testID={createCategoryTestID}
                onPress={createAndSelect}
              />
            )}
          />
          {error ? <ErrorMessage message={error} variant="caption" /> : null}
        </>
      )}
      menuFooterHeight={footerHeight}
      testID={testID}
      onChange={onSelect}
      onReselect={onReselect}
    />
  );
}
