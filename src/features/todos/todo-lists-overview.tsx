import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    Keyboard,
    Platform,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import DraggableFlatList, {
    type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bottomNavContentInset } from '@/components/navigation/bottom-nav-inset';
import {
  appPrompt,
  AppText,
  Button,
  GlassPlate,
  IconButton,
  Screen,
  SegmentedControl,
  Symbol,
} from '@/components/primitives';
import { fontFamilies, glassMaterials, layout, radii, spacing, typography } from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import { EmptyChecklists } from '@/features/todos/empty-checklists';
import { TodoListCard } from '@/features/todos/todo-list-card';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { deletePersistedRecipeImage } from '@/services/recipes';
import {
    deleteSharedTodoList,
    leaveTodoList,
} from '@/services/todos/collaboration';
import {
    useTodos,
    type TodoList,
    type TodoListKind,
} from '@/store/todos';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { listReferenceEquality } from '@/utils/list-equality';

export function TodoListsOverview() {
  const router = useRouter();
  const theme = useTheme();
  const { s } = useResponsive();
  const insets = useSafeAreaInsets();
  const { user } = useAuthSession();
  const { refreshControl } = usePullToRefresh();
  const lists = useTodos((state) => state.lists);
  const counts = useTodos(
    (state) => {
      const next = new Map<string, { open: number; total: number }>();
      for (const task of state.tasks) {
        const entry = next.get(task.listId) ?? { open: 0, total: 0 };
        entry.total += 1;
        if (!task.completed) entry.open += 1;
        next.set(task.listId, entry);
      }
      return next;
    },
    (a, b) => {
      if (a === b) return true;
      if (a.size !== b.size) return false;
      for (const [key, value] of a) {
        const other = b.get(key);
        if (!other || other.open !== value.open || other.total !== value.total) {
          return false;
        }
      }
      return true;
    },
  );
  const members = useTodos((state) => state.members, listReferenceEquality);
  const invites = useTodos((state) => state.invites, listReferenceEquality);
  const createList = useTodos((state) => state.createList);
  const deletePrivateList = useTodos((state) => state.deleteList);
  const reorderLists = useTodos((state) => state.reorderLists);
  const renameList = useTodos((state) => state.renameList);
  const [draft, setDraft] = useState('');
  const [draftKind, setDraftKind] = useState<TodoListKind>('checklist');
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [editingListIds, setEditingListIds] =
    useState<ReadonlySet<string> | null>(null);
  const editMode =
    editingListIds !== null &&
    lists.some((list) => editingListIds.has(list.id));

  const totalOpen = useMemo(() => {
    let open = 0;
    for (const value of counts.values()) open += value.open;
    return open;
  }, [counts]);
  const listContentStyle = useMemo(
    () => [
      styles.listContent,
      {
        paddingBottom:
          bottomNavContentInset(
            insets.bottom,
            spacing.sm,
            Platform.OS,
            layout.bottomNavBarBaseHeight,
          ) + spacing.lg,
      },
    ],
    [insets.bottom],
  );
  const collaboratorsByList = useMemo(() => {
    const byList = new Map<
      string,
      { userId?: string; displayName: string; isSelf?: boolean }[]
    >();
    for (const member of members) {
      if (member.userId === user?.id) continue;
      const listPeople = byList.get(member.listId) ?? [];
      if (listPeople.some((person) => person.userId === member.userId)) continue;
      listPeople.push({
        userId: member.userId,
        displayName: member.displayName,
      });
      byList.set(member.listId, listPeople);
    }
    return byList;
  }, [members, user?.id]);

  const add = () => {
    const list = createList(draft, draftKind);
    if (!list) return;
    setEditingListIds(null);
    setDraft('');
    Keyboard.dismiss();
    haptics.success();
    router.push(`/(tabs)/to-do/${list.id}` as never);
  };

  const moveList = useCallback((id: string, offset: number) => {
    const from = lists.findIndex((list) => list.id === id);
    const to = Math.max(0, Math.min(lists.length - 1, from + offset));
    if (from < 0 || from === to) return;
    const reordered = [...lists];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    reorderLists(reordered.map((list) => list.id));
    haptics.select();
  }, [lists, reorderLists]);

  const commitListName = useCallback(
    (id: string, value: string) => {
      const list = lists.find((item) => item.id === id);
      if (!list || list.role !== 'owner') return false;
      const nextName = value.trim().replace(/\s+/g, ' ');
      if (!nextName || nextName === list.name) return false;
      renameList(id, nextName);
      return true;
    },
    [lists, renameList],
  );

  const beginEditing = () => {
    Keyboard.dismiss();
    setNameDrafts(
      Object.fromEntries(
        lists
          .filter((list) => list.role === 'owner')
          .map((list) => [list.id, list.name]),
      ),
    );
    setEditingListIds(new Set(lists.map((list) => list.id)));
    haptics.select();
  };

  const finishEditing = () => {
    Keyboard.dismiss();
    let renamed = false;
    for (const list of lists) {
      renamed =
        commitListName(list.id, nameDrafts[list.id] ?? list.name) || renamed;
    }
    setNameDrafts({});
    setEditingListIds(null);
    if (renamed) haptics.success();
    else haptics.select();
  };

  const newListNameAgent = useAgentUiTarget(AgentUiIds.checklists.newListName, {
    label: 'New list name',
  });

  const removeList = useCallback(
    (list: TodoList) => {
      const leaving = list.mode === 'shared' && list.role !== 'owner';
      const title = leaving
        ? `Leave “${list.name}”?`
        : `Delete “${list.name}”?`;
      const message = leaving
          ? 'This checklist will be removed from your account. The owner and other collaborators will keep it.'
          : 'The checklist and every item in it will be permanently deleted.';
      const remove = () => {
        if (list.mode === 'private') {
          useTodos
            .getState()
            .recipes.filter((recipe) => recipe.listId === list.id)
            .forEach((recipe) =>
              deletePersistedRecipeImage(recipe.sourceImageUri),
            );
        }
        const action =
          list.mode === 'private'
            ? Promise.resolve(deletePrivateList(list.id))
            : leaving
              ? leaveTodoList(list.id)
              : deleteSharedTodoList(list.id);
        void action
          .then(() => haptics.warning())
          .catch((caught: unknown) => {
            appPrompt.alert(
              leaving ? 'Could not leave checklist' : 'Could not delete checklist',
              caught instanceof Error ? caught.message : 'Please try again.',
            );
          });
      };

      confirmDestructiveAction({
        title,
        message,
        actionLabel: leaving ? 'Leave' : 'Delete',
        onConfirm: remove,
      });
    },
    [deletePrivateList],
  );

  const renderList = useCallback(
    ({
      item,
      isActive,
      drag,
      getIndex,
    }: RenderItemParams<TodoList>) => {
      const count = counts.get(item.id) ?? { open: 0, total: 0 };
      const index = getIndex() ?? lists.findIndex((list) => list.id === item.id);
      return (
        <View style={styles.listItem}>
          <TodoListCard
            editMode={editMode}
            isActive={isActive}
            list={item}
            collaborators={collaboratorsByList.get(item.id)}
            open={count.open}
            total={count.total}
            nameDraft={nameDrafts[item.id] ?? item.name}
            testID={AgentUiIds.checklists.list(item.id)}
            onDragStart={drag}
            onNameChange={(name) =>
              setNameDrafts((current) => ({ ...current, [item.id]: name }))
            }
            onNameSubmit={(name) => {
              if (commitListName(item.id, name)) haptics.success();
              Keyboard.dismiss();
            }}
            onMoveDown={() => moveList(item.id, 1)}
            onMoveUp={() => moveList(item.id, -1)}
            onRemove={() => removeList(item)}
            canMoveDown={index < lists.length - 1}
            canMoveUp={index > 0}
            onPress={() => router.push(`/(tabs)/to-do/${item.id}` as never)}
          />
        </View>
      );
    },
    [
      collaboratorsByList,
      counts,
      editMode,
      lists,
      nameDrafts,
      commitListName,
      moveList,
      removeList,
      router,
    ],
  );

  return (
    <Screen
      scroll={false}
      bottomInset={false}
      contentStyle={styles.screenContent}>
      <View style={styles.content}>
        <DraggableFlatList
          activationDistance={8}
          automaticallyAdjustKeyboardInsets
          autoscrollSpeed={180}
          autoscrollThreshold={80}
          containerStyle={styles.dragList}
          contentContainerStyle={listContentStyle}
          contentInsetAdjustmentBehavior="never"
          data={lists}
          refreshControl={refreshControl}
          dragItemOverflow={false}
          onDragBegin={() => {
            haptics.heavy();
          }}
          onDragEnd={({ data, from, to }) => {
            if (!editMode || from < 0 || to < 0) return;
            haptics.select();
            reorderLists(data.map((list) => list.id));
          }}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.heading}>
                <View style={styles.headingCopy}>
                  <AppText variant="overline" color="accent">Your checklists</AppText>
                  <AppText
                    style={[
                      styles.title,
                      { fontSize: s(35), lineHeight: s(42) },
                    ]}>
                    Checklists
                  </AppText>
                  <AppText variant="body" color="secondary">
                    {totalOpen
                      ? `${totalOpen} open ${totalOpen === 1 ? 'item' : 'items'} across ${lists.length} ${lists.length === 1 ? 'list' : 'lists'}.`
                      : 'Everything is handled. Make a list for what comes next.'}
                  </AppText>
                </View>
                <View style={styles.headingActions}>
                  {lists.length > 0 ? (
                    <Button
                      testID={AgentUiIds.checklists.editMode}
                      accessibilityLabel={
                        editMode
                          ? 'Finish editing checklists'
                          : 'Edit checklists'
                      }
                      size="sm"
                      variant={editMode ? 'primary' : 'secondary'}
                      onPress={() => {
                        if (editMode) finishEditing();
                        else beginEditing();
                      }}
                      style={[
                        styles.editModeButton,
                        {
                          borderColor: editMode
                            ? theme.accentPrimary
                            : theme.separator,
                        },
                      ]}
                      textStyle={editMode ? undefined : { color: theme.accentPrimary }}>
                      {editMode ? 'Done' : 'Edit'}
                    </Button>
                  ) : null}
                  <IconButton
                    testID={AgentUiIds.checklists.collaborators}
                    accessibilityLabel={
                      invites.length
                        ? `Add collaborators, ${invites.length} invitations waiting`
                        : 'Add collaborators'
                    }
                    icon="invite"
                    iconSize={21}
                    color={
                      invites.length
                        ? theme.accentPrimary
                        : theme.textSecondary
                    }
                    onPress={() => router.push('/todo-collaborators' as never)}
                  />
                </View>
              </View>

              {!editMode ? (
                <View style={styles.newListBlock}>
                  <SegmentedControl
                    value={draftKind}
                    options={[
                      {
                        value: 'checklist',
                        label: 'Checklist',
                        icon: 'tasks',
                        testID: AgentUiIds.checklists.newListKind('checklist'),
                      },
                      {
                        value: 'grocery',
                        label: 'Grocery',
                        icon: 'groceries',
                        testID: AgentUiIds.checklists.newListKind('grocery'),
                      },
                    ]}
                    onChange={setDraftKind}
                  />
                  <GlassPlate
                    style={[
                      styles.composer,
                      {
                        borderColor: draft.trim()
                          ? theme.accentPrimary
                          : theme.name === 'dark'
                            ? glassMaterials.border.dark
                            : glassMaterials.border.light,
                        borderWidth: draft.trim() ? 1 : StyleSheet.hairlineWidth,
                      },
                    ]}>
                    <Symbol name="add" size={21} color={theme.accentPrimary} />
                    <AgentTestId
                      testID={newListNameAgent.testID}
                      label="New list name"
                      onPress={() => undefined}
                      style={styles.inputWrap}>
                      <View collapsable={false} style={styles.inputWrap}>
                        <TextInput
                          accessibilityLabel="New list name"
                          maxLength={80}
                          onChangeText={setDraft}
                          onSubmitEditing={add}
                          placeholder={
                            draftKind === 'grocery'
                              ? 'New grocery list'
                              : 'New checklist'
                          }
                          placeholderTextColor={theme.textTertiary}
                          returnKeyType="done"
                          underlineColorAndroid="transparent"
                          style={[styles.input, { color: theme.textPrimary }]}
                          value={draft}
                        />
                      </View>
                    </AgentTestId>
                    <IconButton
                      testID={AgentUiIds.checklists.createList}
                      accessibilityLabel="Create list"
                      icon="arrow-up"
                      iconSize={18}
                      appearance={draft.trim() ? 'solid' : 'glass'}
                      color={
                        draft.trim() ? theme.textOnAccent : theme.textSecondary
                      }
                      background={
                        draft.trim()
                          ? theme.accentPrimary
                          : theme.separator
                      }
                      disabled={!draft.trim()}
                      onPress={add}
                    />
                  </GlassPlate>
                </View>
              ) : null}

            </View>
          }
          ListEmptyComponent={<EmptyChecklists />}
          renderItem={renderList}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Screen>
  );
}


const styles = StyleSheet.create({
  screenContent: {
    paddingTop: Platform.select({ web: 76, default: spacing.lg }),
    paddingBottom: 0,
  },
  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    flex: 1,
    alignSelf: 'center',
  },
  dragList: { flex: 1 },
  listContent: { paddingTop: 0 },
  listItem: { paddingBottom: spacing.md },
  header: { gap: spacing.lg, paddingBottom: spacing.md },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headingCopy: { flex: 1, gap: spacing.xs },
  headingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
    letterSpacing: -0.7,
  },
  editModeButton: {
    minWidth: 58,
    borderWidth: StyleSheet.hairlineWidth,
  },
  composer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    zIndex: 1,
  },
  newListBlock: { gap: spacing.sm },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
  },
});
