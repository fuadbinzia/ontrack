import { useEffect, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText, DragHandle, GlassPlate, Symbol } from '@/components/primitives';
import { glassMaterials, layout, radii, spacing, typography } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import type { TodoMember, TodoTask } from '@/store/todos';
import { AgentTestId } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

const TITLE_COLLAPSED_LINES = 2;

export function TodoRow({
  task,
  canComplete,
  editMode,
  editing,
  expanded,
  isActive,
  listOwner,
  members,
  onCollapseTitle,
  onDelete,
  onDragStart,
  onCycleAssignee,
  onStartEdit,
  onEndEdit,
  onToggle,
  onToggleExpanded,
  onToggleImportant,
  onUpdate,
  testID,
}: {
  task: TodoTask;
  canComplete: boolean;
  editMode: boolean;
  editing: boolean;
  expanded: boolean;
  isActive: boolean;
  listOwner: boolean;
  members: TodoMember[];
  onCollapseTitle: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onCycleAssignee: () => void;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onToggle: () => void;
  onToggleExpanded: () => void;
  onToggleImportant: () => void;
  onUpdate: (title: string) => void;
  testID?: string;
}) {
  const theme = useTheme();
  const dark = theme.name === 'dark';
  const [draft, setDraft] = useState(task.title);
  const [lineCount, setLineCount] = useState(0);
  const [measuredWhileExpanded, setMeasuredWhileExpanded] = useState(false);

  useEffect(() => {
    if (!editing) queueMicrotask(() => setDraft(task.title));
  }, [editing, task.title]);

  useEffect(() => {
    queueMicrotask(() => {
      setLineCount(0);
      setMeasuredWhileExpanded(false);
    });
  }, [task.title]);

  useEffect(() => {
    if (!expanded) queueMicrotask(() => setMeasuredWhileExpanded(false));
  }, [expanded]);

  // Short titles can toggle expanded state, but snap closed once measured.
  useEffect(() => {
    if (
      expanded &&
      measuredWhileExpanded &&
      lineCount > 0 &&
      lineCount <= TITLE_COLLAPSED_LINES
    ) {
      onCollapseTitle();
    }
  }, [expanded, measuredWhileExpanded, lineCount, onCollapseTitle]);

  const dismissChrome = () => {
    Keyboard.dismiss();
    onCollapseTitle();
  };

  const commitEdit = () => {
    const title = draft.trim();
    if (title) onUpdate(title);
    else setDraft(task.title);
    onEndEdit();
  };

  const confirmDelete = () => {
    dismissChrome();
    confirmDestructiveAction({
      title: `Delete “${task.title}”?`,
      message: 'This checklist item will be permanently deleted.',
      actionLabel: 'Delete',
      onConfirm: onDelete,
    });
  };

  const pressRow = () => {
    Keyboard.dismiss();
    if (editMode) onCollapseTitle();
    else onToggleExpanded();
  };
  const titleText = (
    <AppText
      variant="bodyMedium"
      color={task.completed ? 'tertiary' : 'primary'}
      selectable
      selectionColor={theme.accentSoft}
      numberOfLines={expanded ? undefined : TITLE_COLLAPSED_LINES}
      onTextLayout={(event) => {
        const next = event.nativeEvent.lines.length;
        setLineCount((prev) => (prev === next ? prev : next));
        if (expanded) setMeasuredWhileExpanded(true);
      }}
      style={task.completed ? styles.completedTitle : undefined}
    >
      {task.title}
    </AppText>
  );

  return (
    <AgentTestId
      testID={testID}
      label={task.title}
      onPress={pressRow}
      style={styles.taskRowAgent}>
      <GlassPlate
        style={[
          styles.taskRow,
          {
            borderColor:
              task.important && !task.completed
                ? theme.accentSoft
                : dark
                  ? glassMaterials.border.dark
                  : glassMaterials.border.light,
          },
        ]}>
      <Pressable
        accessible={false}
        accessibilityActions={
          listOwner && editMode
            ? [{ name: 'delete', label: `Delete ${task.title}` }]
            : undefined
        }
        onAccessibilityAction={(event) => {
          if (
            listOwner &&
            editMode &&
            event.nativeEvent.actionName === 'delete'
          ) {
            confirmDelete();
          }
        }}
        onPress={pressRow}
        style={styles.taskRowInner}
      >
      {editMode && listOwner ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${task.title}`}
          accessibilityHint="Deletes after confirmation"
          hitSlop={2}
          onPress={confirmDelete}
          style={({ pressed }) => [
            styles.rowAction,
            { backgroundColor: `${theme.danger}18` },
            pressed && styles.pressed,
          ]}>
          <Symbol name="delete" size={18} color={theme.danger} />
        </Pressable>
      ) : (
        <Pressable
          accessibilityLabel={
            task.completed
              ? `Mark ${task.title} as open`
              : `Complete ${task.title}`
          }
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.completed }}
          disabled={!canComplete}
          hitSlop={9}
          onPress={() => {
            dismissChrome();
            onToggle();
          }}
          style={({ pressed }) => [
            styles.checkButton,
            {
              backgroundColor: task.completed ? theme.success : 'transparent',
              borderColor: task.completed ? theme.success : theme.textTertiary,
              opacity: canComplete ? 1 : 0.35,
              transform: [{ scale: pressed ? 0.88 : 1 }],
            },
          ]}>
          {task.completed ? (
            <Symbol name="check" size={15} color={theme.textOnAccent} />
          ) : null}
        </Pressable>
      )}

      <View style={styles.taskCopy}>
        {listOwner && editMode && editing ? (
          <TextInput
            accessibilityLabel={`Edit ${task.title}`}
            autoFocus
            blurOnSubmit
            maxLength={160}
            multiline
            onBlur={commitEdit}
            onChangeText={setDraft}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            scrollEnabled={false}
            selectionColor={theme.accentPrimary}
            underlineColorAndroid="transparent"
            style={[
              styles.editInput,
              {
                color: task.completed ? theme.textTertiary : theme.textPrimary,
              },
              task.completed ? styles.completedTitle : undefined,
            ]}
            value={draft}
          />
        ) : listOwner && editMode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${task.title}`}
            onPress={onStartEdit}
          >
            {titleText}
          </Pressable>
        ) : (
          titleText
        )}
        {task.important && !task.completed ? (
          <AppText variant="overline" color="accent">
            Focus
          </AppText>
        ) : null}
        {members.length > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Assignment for ${task.title}`}
            disabled={!listOwner || editMode}
            onPress={() => {
              dismissChrome();
              onCycleAssignee();
            }}>
            <AppText variant="caption" color="secondary">
              {task.assigneeUserId
                ? members.find((member) => member.userId === task.assigneeUserId)
                    ?.displayName ?? 'Member'
                : 'Anyone'}
              {listOwner && !editMode ? ' · tap to change' : ''}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {listOwner ? (
        editMode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Drag to reorder ${task.title}`}
            accessibilityHint="Long press and drag to move this item"
            disabled={isActive}
            delayLongPress={180}
            onLongPress={onDragStart}
            style={({ pressed }) => [
              styles.rowAction,
              (pressed || isActive) && styles.pressed,
            ]}>
            <DragHandle
              size={20}
              color={
                theme.name === 'dark'
                  ? theme.textOnAccent
                  : theme.textSecondary
              }
            />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              task.important
                ? `Remove ${task.title} from focus`
                : `Mark ${task.title} as focus`
            }
            accessibilityState={{ selected: task.important }}
            hitSlop={2}
            onPress={() => {
              dismissChrome();
              onToggleImportant();
            }}
            style={({ pressed }) => [
              styles.rowAction,
              task.important && { backgroundColor: theme.accentFaint },
              pressed && styles.pressed,
            ]}>
            <Symbol
              name={task.important ? 'important-filled' : 'important'}
              size={19}
              color={task.important ? theme.accentPrimary : theme.textTertiary}
            />
          </Pressable>
        )
      ) : null}
      </Pressable>
      </GlassPlate>
    </AgentTestId>
  );
}

export function ChecklistItemSeparator({
  onPress,
}: {
  onPress?: () => void;
} = {}) {
  return (
    <Pressable
      accessible={false}
      onPress={onPress ?? Keyboard.dismiss}
      style={styles.listSeparator}
    />
  );
}

const styles = StyleSheet.create({
  taskRowAgent: { width: '100%' },
  taskRow: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  taskRowInner: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.md,
    zIndex: 1,
  },
  checkButton: {
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: radii.pill,
  },
  taskCopy: { flex: 1, gap: spacing.xxs, minWidth: 0 },
  completedTitle: { textDecorationLine: 'line-through' },
  editInput: {
    ...typography.bodyMedium,
    margin: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  rowAction: {
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  listSeparator: { height: spacing.sm },
  pressed: { opacity: 0.62 },
});
