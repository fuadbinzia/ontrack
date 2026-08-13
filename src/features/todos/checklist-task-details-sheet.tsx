import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import {
  Keyboard,
  StyleSheet,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';

import {
  Dropdown,
  ErrorMessage,
  IconButton,
  Input,
  SheetScaffold,
  Symbol,
} from '@/components/primitives';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { ANYONE_ASSIGNEE } from '@/features/todos/checklist-assignee-filter';
import { sortCategoriesForList } from '@/features/todos/checklist-category-helpers';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
  useTodos,
  type TodoCategory,
  type TodoMember,
  type TodoTask,
} from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { listReferenceEquality } from '@/utils/list-equality';

const UNCATEGORIZED_ID = 'uncategorized';

export type ChecklistTaskDetailsSheetHandle = {
  open: (taskId: string) => void;
  close: () => void;
};

export const ChecklistTaskDetailsSheetHost = forwardRef<
  ChecklistTaskDetailsSheetHandle,
  { listId: string }
>(function ChecklistTaskDetailsSheetHost({ listId }, ref) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const task = useTodos((state) =>
    state.tasks.find((item) => item.id === taskId),
  );
  const members = useTodos(
    (state) => state.members.filter((member) => member.listId === listId),
    listReferenceEquality,
  );
  const categories = useTodos(
    (state) => sortCategoriesForList(state.categories, listId),
    listReferenceEquality,
  );
  const addCategory = useTodos((state) => state.addCategory);
  const setAssignee = useTodos((state) => state.setAssignee);
  const setTaskCategory = useTodos((state) => state.setTaskCategory);
  const updateTask = useTodos((state) => state.updateTask);

  useImperativeHandle(ref, () => ({
    open: (nextTaskId: string) => {
      // Keep the Modal mounted across item hops — remounting a focused
      // multiline field makes iOS arm the keyboard and inflate contentSize.
      Keyboard.dismiss();
      setTaskId(nextTaskId);
    },
    close: () => {
      Keyboard.dismiss();
      setTaskId(null);
    },
  }), []);

  useEffect(() => {
    if (taskId && !task) setTaskId(null);
  }, [task, taskId]);

  return (
    <ChecklistTaskDetailsSheet
      task={task}
      members={members}
      categories={categories}
      onCreateCategory={(name) => addCategory(listId, name)}
      onUpdateTitle={(title) => {
        if (!taskId) return;
        updateTask(taskId, title);
        haptics.success();
      }}
      onSetAssignee={(userIds) => {
        if (!taskId) return;
        setAssignee(taskId, userIds);
        haptics.select();
      }}
      onSetCategory={(categoryId) => {
        if (!taskId) return;
        setTaskCategory(taskId, categoryId);
        haptics.select();
      }}
      onClose={() => {
        Keyboard.dismiss();
        setTaskId(null);
      }}
    />
  );
});

function selectedFirstAlphabetically<
  T extends { value: string; label: string },
>(options: readonly T[], selectedValues: readonly string[]): T[] {
  const selected = new Set(selectedValues);
  return [...options].sort((left, right) => {
    const leftSelected = selected.has(left.value);
    const rightSelected = selected.has(right.value);
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    return left.label.localeCompare(right.label, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  });
}

function nextAssigneeSelection(
  previous: readonly string[],
  next: readonly string[],
): string[] | undefined {
  const added = next.filter((value) => !previous.includes(value));
  if (added.includes(ANYONE_ASSIGNEE) || next.length === 0) return undefined;
  const people = next.filter((value) => value !== ANYONE_ASSIGNEE);
  return people.length > 0 ? people : undefined;
}

export function ChecklistTaskDetailsSheet({
  task,
  members,
  categories,
  onUpdateTitle,
  onSetAssignee,
  onSetCategory,
  onCreateCategory,
  onClose,
}: {
  task?: TodoTask;
  members: TodoMember[];
  categories: TodoCategory[];
  onUpdateTitle: (title: string) => void;
  onSetAssignee: (userIds?: string[]) => void;
  onSetCategory: (categoryId?: string) => void;
  onCreateCategory: (name: string) => TodoCategory | undefined;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { fontScale, layout, s, spacing, typography, width } = useResponsive();
  const titleMinHeight = Math.max(44, s(48));
  const titlePadY = spacing.md;
  // fitContent sheet: keep the title compact so Assignee/Category stay on-screen.
  const titleMaxLines = 4;
  const assigneeAvatarSize = Math.max(26, s(28));
  const [titleDraft, setTitleDraft] = useState(task?.title ?? '');
  const [titleFocused, setTitleFocused] = useState(false);
  const [titleContentHeight, setTitleContentHeight] = useState<{
    key: string;
    height: number;
  }>();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const scaledTitleLineHeight =
    typography.body.lineHeight * Math.min(fontScale, 1.3);
  const titleMaxHeight = Math.max(
    titleMinHeight,
    Math.ceil(scaledTitleLineHeight * titleMaxLines + titlePadY * 2),
  );
  const titleTextWidth = Math.max(
    120,
    width - layout.screenPadding * 2 - spacing.lg - s(56),
  );
  // Fresh iOS modals can under-report the first contentSize; estimate a floor
  // from average glyph width so long titles aren't clipped before measure.
  const estimatedCharactersPerLine = Math.max(
    12,
    Math.floor(
      titleTextWidth /
        Math.max(1, typography.body.fontSize * Math.min(fontScale, 1.3) * 0.6),
    ),
  );
  const estimatedTitleLines = Math.max(
    1,
    Math.ceil(titleDraft.length / estimatedCharactersPerLine),
  );
  const estimatedTitleTextHeight = Math.ceil(
    estimatedTitleLines * scaledTitleLineHeight,
  );
  const estimatedTitleHeight = Math.min(
    titleMaxHeight,
    Math.max(
      titleMinHeight,
      Math.ceil(estimatedTitleTextHeight + titlePadY * 2),
    ),
  );
  const titleMeasurementKey = `${task?.id ?? ''}:${titleDraft}`;
  const resolvedTitleInputHeight =
    titleContentHeight?.key === titleMeasurementKey
      ? titleContentHeight.height
      : estimatedTitleHeight;
  const categoryFooterHeight = Math.max(64, s(68)) +
    (error ? Math.max(20, s(20)) : 0);
  const selectedAssigneeIds =
    task?.assigneeUserIds && task.assigneeUserIds.length > 0
      ? task.assigneeUserIds
      : [ANYONE_ASSIGNEE];
  const selectedCategoryId = task?.categoryId ?? UNCATEGORIZED_ID;
  const assigneeOptions = selectedFirstAlphabetically([
    {
      value: ANYONE_ASSIGNEE,
      label: 'Anyone',
      leading: (
        <Symbol name="people" size="sm" color={theme.textSecondary} />
      ),
      testID: AgentUiIds.checklists.itemDetails.assigneeOption(
        ANYONE_ASSIGNEE,
      ),
    },
    ...members.map((member) => ({
      value: member.userId,
      label: member.displayName,
      leading: (
        <ProfileAvatar
          accessibilityLabel={`${member.displayName} avatar`}
          displayName={member.displayName}
          size={assigneeAvatarSize}
          userId={member.userId}
        />
      ),
      testID: AgentUiIds.checklists.itemDetails.assigneeOption(member.userId),
    })),
  ], selectedAssigneeIds);
  const categoryOptions = selectedFirstAlphabetically([
    {
      value: UNCATEGORIZED_ID,
      label: 'Uncategorized',
      testID: AgentUiIds.checklists.itemDetails.categoryOption(UNCATEGORIZED_ID),
    },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
      testID: AgentUiIds.checklists.itemDetails.categoryOption(category.id),
    })),
  ], [selectedCategoryId]);

  useEffect(() => {
    Keyboard.dismiss();
    setTitleDraft(task?.title ?? '');
    setTitleFocused(false);
    setTitleContentHeight(undefined);
    setCategoryOpen(false);
    setDraft('');
    setError(undefined);
  }, [task?.id, task?.title, titleMinHeight]);

  const cleanTitle = titleDraft.trim();
  const saveTitle = () => {
    if (!cleanTitle || cleanTitle === task?.title) return;
    Keyboard.dismiss();
    onUpdateTitle(cleanTitle);
    setTitleDraft(cleanTitle);
  };

  const resizeTitleFromContentSize = (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    // With scrollEnabled, contentSize stays on the text block (not the frame).
    // Adding pad once is enough; never set an explicit height from this or it loops.
    const textHeight = Math.ceil(event.nativeEvent.contentSize.height);
    // Unfocused iOS modals (and item-to-item hops) can report a tall bogus
    // contentSize while preparing the keyboard. Keep the glyph estimate until
    // the field is actually focused or the measure is no taller than estimate.
    if (!titleFocused && textHeight > estimatedTitleTextHeight) {
      return;
    }
    const nextHeight = Math.min(
      titleMaxHeight,
      Math.max(
        titleMinHeight,
        Math.ceil(textHeight + titlePadY * 2),
      ),
    );
    setTitleContentHeight((current) =>
      current?.key === titleMeasurementKey && current.height === nextHeight
        ? current
        : { key: titleMeasurementKey, height: nextHeight },
    );
  };

  const handleCategoryOpenChange = (open: boolean) => {
    setCategoryOpen(open);
    if (!open) {
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
    onSetCategory(created.id);
    Keyboard.dismiss();
    setCategoryOpen(false);
  };

  return (
    <SheetScaffold
      visible={Boolean(task)}
      eyebrow="Checklist item"
      title="Item Details"
      fitContent
      scrollKey={task?.id}
      closeAccessibilityLabel="Close item details"
      closeTestID={AgentUiIds.checklists.itemDetails.close}
      onClose={onClose}>
      <Input
        accessibilityLabel="Item title"
        autoCapitalize="sentences"
        maxLength={160}
        multiline
        placeholder="What needs your attention?"
        // Always scrollable: avoids contentSize↔height feedback and keeps the
        // fitContent sheet short enough for Assignee/Category to stay visible.
        scrollEnabled
        testID={AgentUiIds.checklists.itemDetails.title}
        value={titleDraft}
        onChangeText={setTitleDraft}
        onContentSizeChange={resizeTitleFromContentSize}
        onFocus={() => setTitleFocused(true)}
        onBlur={() => setTitleFocused(false)}
        trailing={
          <IconButton
            accessibilityLabel="Save item title"
            color={theme.accentPrimary}
            disabled={!cleanTitle || cleanTitle === task?.title}
            icon="check"
            testID={AgentUiIds.checklists.itemDetails.saveTitle}
            onPress={saveTitle}
          />
        }
        style={[
          styles.titleInput,
          {
            minHeight: resolvedTitleInputHeight,
            maxHeight: titleMaxHeight,
          },
        ]}
      />

      <Dropdown
        label="Assigned to"
        accessibilityLabel="Assigned to"
        multiple
        value={selectedAssigneeIds}
        options={assigneeOptions}
        testID={AgentUiIds.checklists.itemDetails.assignee}
        onChange={(nextIds) =>
          onSetAssignee(nextAssigneeSelection(selectedAssigneeIds, nextIds))
        }
      />

      <Dropdown
        label="Category"
        accessibilityLabel="Category"
        open={categoryOpen}
        onOpenChange={handleCategoryOpenChange}
        value={selectedCategoryId}
        options={categoryOptions}
        menuFooter={
          <>
            <Input
              accessibilityLabel="New category name"
              autoCapitalize="words"
              maxLength={40}
              placeholder="New category"
              returnKeyType="done"
              testID={AgentUiIds.checklists.itemDetails.newCategoryName}
              value={draft}
              onChangeText={(value) => {
                setDraft(value);
                if (error) setError(undefined);
              }}
              onSubmitEditing={createAndSelect}
              trailing={
                <IconButton
                  accessibilityLabel="Create category"
                  color={theme.accentPrimary}
                  disabled={!draft.trim()}
                  icon="add"
                  testID={AgentUiIds.checklists.itemDetails.createCategory}
                  onPress={createAndSelect}
                />
              }
            />
            {error ? <ErrorMessage message={error} variant="caption" /> : null}
          </>
        }
        menuFooterHeight={categoryFooterHeight}
        testID={AgentUiIds.checklists.itemDetails.category}
        onChange={(categoryId) =>
          onSetCategory(
            categoryId === UNCATEGORIZED_ID ? undefined : categoryId,
          )
        }
        onReselect={(categoryId) => {
          if (categoryId !== UNCATEGORIZED_ID) onSetCategory(undefined);
        }}
      />
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  titleInput: { textAlignVertical: 'top' },
});
