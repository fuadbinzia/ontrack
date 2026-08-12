import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  GlassIconWell,
  GlassPlate,
  Input,
  SheetScaffold,
  Symbol,
} from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import type { TodoCategory } from '@/store/todos';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

export function ChecklistCategorySheet({
  visible,
  categories,
  onAdd,
  onDelete,
  onClose,
}: {
  visible: boolean;
  categories: TodoCategory[];
  onAdd: (name: string) => boolean;
  onDelete: (category: TodoCategory) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  useEffect(() => {
    if (!visible) setDraft('');
  }, [visible]);

  const add = () => {
    if (onAdd(draft)) setDraft('');
  };

  return (
    <SheetScaffold
      visible={visible}
      eyebrow="Checklist"
      title="Categories"
      subtitle="Create tabs that open just the items you want."
      closeAccessibilityLabel="Close categories"
      closeTestID={AgentUiIds.checklists.categories.close}
      onClose={onClose}
    >
      <View style={styles.composer}>
        <Input
          accessibilityLabel="Category name"
          autoCapitalize="words"
          maxLength={40}
          placeholder="New category"
          returnKeyType="done"
          testID={AgentUiIds.checklists.categories.name}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          containerStyle={styles.input}
        />
        <Button
          accessibilityLabel="Add category"
          disabled={!draft.trim()}
          testID={AgentUiIds.checklists.categories.add}
          onPress={add}
        >
          Add
        </Button>
      </View>

      <View style={styles.list}>
        {categories.length ? (
          categories.map((category) => {
            const confirmRemove = () =>
              confirmDestructiveAction({
                title: `Remove “${category.name}”?`,
                message: 'Items in this category will become uncategorized.',
                actionLabel: 'Remove',
                onConfirm: () => onDelete(category),
              });
            return (
              <GlassPlate key={category.id} airy style={styles.row}>
                <GlassIconWell size={34}>
                  <Symbol name="list" size={17} color={theme.accentPrimary} />
                </GlassIconWell>
                <AppText variant="callout" style={styles.name}>
                  {category.name}
                </AppText>
                <AgentTestId
                  testID={AgentUiIds.checklists.categories.remove(category.id)}
                  label={`Remove ${category.name} category`}
                  onPress={confirmRemove}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${category.name} category`}
                    onPress={confirmRemove}
                    style={({ pressed }) => [
                      styles.delete,
                      { opacity: pressed ? 0.65 : 1 },
                    ]}
                  >
                    <Symbol name="delete" size={18} color={theme.danger} />
                  </Pressable>
                </AgentTestId>
              </GlassPlate>
            );
          })
        ) : (
          <AppText variant="body" color="secondary" align="center">
            Your category tabs will appear above the Open control.
          </AppText>
        )}
      </View>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: { flex: 1, minWidth: 0 },
  list: { gap: spacing.sm, paddingTop: spacing.lg },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
  },
  name: { flex: 1, minWidth: 0 },
  delete: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
