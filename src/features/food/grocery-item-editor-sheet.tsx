import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  GlassPrimaryAction,
  Input,
} from '@/components/primitives';
import { FoodSheet } from '@/features/food/food-sheet';
import { useResponsive } from '@/hooks/use-responsive';
import { useTodos } from '@/store/todos';
import type { TodoTask } from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

/**
 * Grocery Item Editor (BOTTOM_SHEETS.md) over the EXISTING todos store:
 * add → `addTask`, standalone edit → `updateTask`, recipe-ingredient edit →
 * `updateIngredient`, delete → `deleteTask`. No food-side persistence.
 */
export function GroceryItemEditorSheet({
  visible,
  listId,
  task,
  onClose,
}: {
  visible: boolean;
  /** Target grocery list for add mode. */
  listId: string;
  /** Existing task when editing; omit to add a standalone item. */
  task?: TodoTask;
  onClose: () => void;
}) {
  const { spacing } = useResponsive();
  const addTask = useTodos((state) => state.addTask);
  const updateTask = useTodos((state) => state.updateTask);
  const updateIngredient = useTodos((state) => state.updateIngredient);
  const deleteTask = useTodos((state) => state.deleteTask);

  const isIngredient = Boolean(task?.recipeId);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(task ? task.ingredientName || task.title : '');
    setQuantity(
      task?.quantityText ??
        (task?.quantityValue != null ? String(task.quantityValue) : ''),
    );
    setUnit(task?.unit ?? '');
  }, [visible, task]);

  const save = () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    if (!task) {
      // Standalone quick items keep the todos convention: amount in the title.
      const title = [quantity.trim(), unit.trim(), cleanName]
        .filter(Boolean)
        .join(' ');
      addTask(listId, title);
    } else if (isIngredient) {
      const cleanQuantity = quantity.trim();
      const numeric = Number(cleanQuantity.replace(',', '.'));
      updateIngredient(task.id, {
        name: cleanName,
        quantityText: cleanQuantity || undefined,
        quantityValue:
          cleanQuantity && Number.isFinite(numeric) ? numeric : undefined,
        unit: unit.trim() || undefined,
      });
    } else {
      const title = [quantity.trim(), unit.trim(), cleanName]
        .filter(Boolean)
        .join(' ');
      updateTask(task.id, title);
    }
    haptics.success();
    onClose();
  };

  const remove = () => {
    if (!task) return;
    deleteTask(task.id);
    haptics.select();
    onClose();
  };

  return (
    <FoodSheet
      visible={visible}
      name="groceryItem"
      title={task ? 'Edit Item' : 'Add Item'}
      subtitle={
        isIngredient
          ? 'From a meal on this list'
          : 'Saved straight to your grocery list'
      }
      onClose={onClose}
      contentContainerStyle={{ gap: spacing.lg }}
      footer={
        <View style={{ gap: spacing.sm }}>
          <GlassPrimaryAction
            label={task ? 'Save Item' : 'Add Item'}
            icon="check"
            disabled={!name.trim()}
            onPress={save}
            testID={AgentUiIds.food.sheet.done('groceryItem')}
          />
          {task ? (
            <Button
              variant="ghost"
              icon="delete"
              accessibilityLabel="Delete item"
              testID={AgentUiIds.food.plan.editorDelete}
              onPress={remove}>
              Delete Item
            </Button>
          ) : null}
        </View>
      }>
      <Input
        stackedLabel="Item"
        placeholder="Lemons, olive oil…"
        value={name}
        onChangeText={setName}
        maxLength={100}
        testID={AgentUiIds.food.plan.editorName}
      />
      <View style={[styles.amountRow, { gap: spacing.md }]}>
        <Input
          stackedLabel="Quantity"
          placeholder="2"
          value={quantity}
          onChangeText={setQuantity}
          maxLength={20}
          containerStyle={styles.amountField}
          testID={AgentUiIds.food.plan.editorQuantity}
        />
        <Input
          stackedLabel="Unit"
          placeholder="kg"
          value={unit}
          onChangeText={setUnit}
          maxLength={20}
          containerStyle={styles.amountField}
          testID={AgentUiIds.food.plan.editorUnit}
        />
      </View>
      {isIngredient ? (
        <AppText variant="caption" color="secondary" style={styles.note}>
          This ingredient comes from a meal on the list — changes update the
          shared grocery list too.
        </AppText>
      ) : null}
    </FoodSheet>
  );
}

const styles = StyleSheet.create({
  amountRow: {
    flexDirection: 'row',
  },
  amountField: {
    flex: 1,
    minWidth: 0,
  },
  note: {
    flexShrink: 1,
    minWidth: 0,
  },
});
