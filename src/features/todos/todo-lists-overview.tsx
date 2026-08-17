import { useCallback, useMemo, useState } from 'react';
import {
    FlatList,
    Keyboard,
    Platform,
    StyleSheet,
    View,
    type ListRenderItemInfo,
} from 'react-native';
import DraggableFlatList, {
    type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bottomNavContentInset } from '@/components/navigation/bottom-nav-inset';
import { Screen } from '@/components/primitives';
import { layout, spacing } from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import { canShowChecklistCollaborator } from '@/features/todos/checklist-collaborator-visibility';
import { EmptyChecklists } from '@/features/todos/empty-checklists';
import { ChecklistCard } from '@/features/todos/todo-list-card';
import { checklistDetailHref, openChecklist } from '@/features/todos/todo-list-href';
import { checklistHubWindowing } from '@/features/todos/todo-list-hub-windowing';
import { confirmRemoveChecklist } from '@/features/todos/todo-list-remove';
import { ChecklistsOverviewHeader } from '@/features/todos/todo-lists-overview-header';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useFriends } from '@/store/friends';
import {
    useChecklists,
    type Checklist,
} from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { listReferenceEquality } from '@/utils/list-equality';
import { useWarmHrefs } from '@/utils/warm-navigation';

export function ChecklistsOverview() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthSession();
  const { refreshControl } = usePullToRefresh();
  const lists = useChecklists((state) => state.lists, listReferenceEquality);
  const counts = useChecklists(
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
  const members = useChecklists((state) => state.members, listReferenceEquality);
  const friends = useFriends((state) => state.friends);
  const createList = useChecklists((state) => state.createList);
  const reorderLists = useChecklists((state) => state.reorderLists);
  const renameList = useChecklists((state) => state.renameList);
  const [draft, setDraft] = useState('');
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [editingListIds, setEditingListIds] =
    useState<ReadonlySet<string> | null>(null);
  const editMode =
    editingListIds !== null &&
    lists.some((list) => editingListIds.has(list.id));
  // Warm only the top list: the router keeps one preloaded route per screen
  // name, so warming every id is mount/unmount churn with a single survivor —
  // and a surviving wrong-id route is what made first taps open the wrong list.
  useWarmHrefs(lists.slice(0, 1).map((list) => checklistDetailHref(list.id)));

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
    openChecklist(list.id);
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

  const renderCard = useCallback(
    (
      item: Checklist,
      index: number,
      drag: () => void,
      isActive: boolean,
    ) => {
      const count = counts.get(item.id) ?? { open: 0, total: 0 };
      return (
        <View style={styles.listItem}>
          <ChecklistCard
            editMode={editMode}
            isActive={isActive}
            list={item}
            collaborators={collaboratorsByList.get(item.id)}
            open={count.open}
            total={count.total}
            nameDraft={nameDrafts[item.id] ?? item.name}
            testID={AgentUiIds.checklists.list(item.id)}
            onDragStart={editMode ? drag : () => undefined}
            onNameChange={(name) =>
              setNameDrafts((current) => ({ ...current, [item.id]: name }))
            }
            onNameSubmit={(name) => {
              if (commitListName(item.id, name)) haptics.success();
              Keyboard.dismiss();
            }}
            onMoveDown={() => moveList(item.id, 1)}
            onMoveUp={() => moveList(item.id, -1)}
            onRemove={() => confirmRemoveChecklist(item)}
            canMoveDown={index < lists.length - 1}
            canMoveUp={index > 0}
            onPress={() => openChecklist(item.id)}
          />
        </View>
      );
    },
    [
      collaboratorsByList,
      counts,
      editMode,
      lists.length,
      nameDrafts,
      commitListName,
      moveList,
    ],
  );

  const renderBrowseItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Checklist>) =>
      renderCard(item, index, () => undefined, false),
    [renderCard],
  );

  const renderDragItem = useCallback(
    ({ item, isActive, drag, getIndex }: RenderItemParams<Checklist>) =>
      renderCard(
        item,
        getIndex() ?? lists.findIndex((list) => list.id === item.id),
        drag,
        isActive,
      ),
    [lists, renderCard],
  );

  const listHeader = (
    <ChecklistsOverviewHeader
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
  );
  const listShared = {
    automaticallyAdjustKeyboardInsets: true,
    contentContainerStyle: listContentStyle,
    contentInsetAdjustmentBehavior: 'never' as const,
    data: lists,
    extraData: editMode,
    ...checklistHubWindowing(lists.length),
    refreshControl,
    keyboardDismissMode:
      Platform.OS === 'ios' ? ('interactive' as const) : ('on-drag' as const),
    keyboardShouldPersistTaps: 'handled' as const,
    keyExtractor: (item: Checklist) => item.id,
    ListHeaderComponent: listHeader,
    ListEmptyComponent: <EmptyChecklists />,
    showsVerticalScrollIndicator: false,
  };

  return (
    <Screen
      scroll={false}
      bottomInset={false}
      contentStyle={styles.screenContent}>
      <View style={styles.content}>
        {editMode ? (
          <DraggableFlatList
            {...listShared}
            activationDistance={8}
            autoscrollSpeed={180}
            autoscrollThreshold={80}
            containerStyle={styles.dragList}
            dragItemOverflow={false}
            onDragBegin={() => {
              haptics.heavy();
            }}
            onDragEnd={({ data, from, to }) => {
              if (from < 0 || to < 0 || from === to) return;
              haptics.select();
              reorderLists(data.map((list) => list.id));
            }}
            renderItem={renderDragItem}
          />
        ) : (
          <FlatList
            {...listShared}
            style={styles.dragList}
            renderItem={renderBrowseItem}
          />
        )}
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
