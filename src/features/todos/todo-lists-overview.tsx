import { useCallback, useMemo, useState } from 'react';
import {
    Keyboard,
    Platform,
    StyleSheet,
    View,
} from 'react-native';
import DraggableFlatList, {
    type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bottomNavContentInset } from '@/components/navigation/bottom-nav-inset';
import { Screen } from '@/components/primitives';
import { layout, spacing } from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import { EmptyChecklists } from '@/features/todos/empty-checklists';
import { canShowChecklistCollaborator } from '@/features/todos/checklist-collaborator-visibility';
import { TodoListCard } from '@/features/todos/todo-list-card';
import { openTodoList, todoListDetailHref } from '@/features/todos/todo-list-href';
import { TodoListsOverviewHeader } from '@/features/todos/todo-lists-overview-header';
import { confirmRemoveTodoList } from '@/features/todos/todo-list-remove';
import { sortTodoListsByRecent } from '@/features/todos/todo-sort';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import {
    useTodos,
    type TodoList,
} from '@/store/todos';
import { useFriends } from '@/store/friends';
import { AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { listReferenceEquality } from '@/utils/list-equality';
import { useWarmHrefs } from '@/utils/warm-navigation';

export function TodoListsOverview() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthSession();
  const { refreshControl } = usePullToRefresh();
  const lists = useTodos(
    (state) => sortTodoListsByRecent(state.lists, state.listOpenedAt),
    listReferenceEquality,
  );
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
  const friends = useFriends((state) => state.friends);
  const createList = useTodos((state) => state.createList);
  const reorderLists = useTodos((state) => state.reorderLists);
  const renameList = useTodos((state) => state.renameList);
  const [draft, setDraft] = useState('');
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [editingListIds, setEditingListIds] =
    useState<ReadonlySet<string> | null>(null);
  const editMode =
    editingListIds !== null &&
    lists.some((list) => editingListIds.has(list.id));
  useWarmHrefs(lists.map((list) => todoListDetailHref(list.id)));

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
    const friendUserIds = new Set(friends.map((friend) => friend.userId));
    const byList = new Map<
      string,
      { userId?: string; displayName: string; isSelf?: boolean }[]
    >();
    for (const member of members) {
      if (!canShowChecklistCollaborator({
        collaboratorUserId: member.userId,
        viewerUserId: user?.id,
        friendUserIds,
      })) continue;
      const listPeople = byList.get(member.listId) ?? [];
      if (listPeople.some((person) => person.userId === member.userId)) continue;
      listPeople.push({
        userId: member.userId,
        displayName: member.displayName,
      });
      byList.set(member.listId, listPeople);
    }
    return byList;
  }, [friends, members, user?.id]);

  const add = () => {
    const list = createList(draft);
    if (!list) return;
    setEditingListIds(null);
    setDraft('');
    Keyboard.dismiss();
    haptics.success();
    openTodoList(list.id);
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
            onRemove={() => confirmRemoveTodoList(item)}
            canMoveDown={index < lists.length - 1}
            canMoveUp={index > 0}
            onPress={() => openTodoList(item.id)}
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
            <TodoListsOverviewHeader
              listCount={lists.length}
              totalOpen={totalOpen}
              editMode={editMode}
              draft={draft}
              onDraftChange={setDraft}
              onSubmitDraft={add}
              onToggleEditMode={() => {
                if (editMode) finishEditing();
                else beginEditing();
              }}
            />
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
});
