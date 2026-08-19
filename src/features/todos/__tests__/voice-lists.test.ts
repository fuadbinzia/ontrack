import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import {
  applyVoicePendingToStore,
  buildVoiceSnapshot,
  inferVoiceKindHint,
  matchVoiceList,
  voiceListNameQuery,
} from '@/features/todos/voice-lists';
import { useChecklists } from '@/store/todos';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

const updatedAt = '2026-08-12T12:00:00.000Z';

describe('voice lists', () => {
  beforeEach(() => {
    useChecklists.getState().reset();
  });

  it('infers grocery vs checklist hints and ignores generic list names', () => {
    expect(inferVoiceKindHint('my grocery list')).toBe('grocery');
    expect(inferVoiceKindHint('shopping')).toBe('grocery');
    expect(inferVoiceKindHint('to-do list')).toBe('checklist');
    expect(voiceListNameQuery('grocery list')).toBeUndefined();
    expect(voiceListNameQuery('Costco')).toBe('Costco');
  });

  it('matches an editable list by name, then kind, then recency', () => {
    const lists = [
      {
        id: 'old',
        name: 'Inbox',
        kind: 'checklist' as const,
        canEdit: true,
        updatedAt: '2026-08-01T00:00:00.000Z',
        openTitles: ['Call'],
      },
      {
        id: 'food',
        name: 'Costco',
        kind: 'grocery' as const,
        canEdit: true,
        updatedAt,
        openTitles: ['Milk'],
      },
    ];
    expect(matchVoiceList(lists, 'costco')?.id).toBe('food');
    expect(matchVoiceList(lists, 'grocery list', 'grocery')?.id).toBe('food');
    expect(matchVoiceList(lists, undefined, 'checklist')?.id).toBe('old');
    expect(matchVoiceList(lists)?.id).toBe('food');
  });

  it('honors an exact To Do list name instead of the most recent checklist', () => {
    const lists = [
      {
        id: 'recent',
        name: '7 Maple',
        kind: 'checklist' as const,
        canEdit: true,
        updatedAt: '2026-08-13T02:00:00.000Z',
        openTitles: [],
      },
      {
        id: 'default',
        name: 'To Do',
        kind: 'checklist' as const,
        canEdit: true,
        updatedAt: '2026-08-01T00:00:00.000Z',
        openTitles: [],
      },
    ];

    expect(matchVoiceList(lists, 'To Do')?.id).toBe('default');
    expect(matchVoiceList(lists, '  to do  ', 'checklist')?.id).toBe('default');
  });

  it('adds a Siri item requested for To Do to To Do instead of another checklist', () => {
    const toDo = useChecklists.getState().lists.find((list) => list.name === 'To Do')!;
    const other = useChecklists.getState().createList('7 Maple', 'checklist')!;
    useChecklists.setState((state) => ({
      lists: state.lists.map((list) => ({
        ...list,
        updatedAt:
          list.id === other.id
            ? '2026-08-13T02:00:00.000Z'
            : '2026-08-01T00:00:00.000Z',
      })),
    }));

    expect(
      applyVoicePendingToStore([
        {
          id: 'op-to-do',
          title: 'Test',
          listName: 'To Do',
          kindHint: 'checklist',
          createdAt: updatedAt,
        },
      ]),
    ).toBe(1);
    expect(useChecklists.getState().tasks).toEqual([
      expect.objectContaining({ title: 'Test', listId: toDo.id }),
    ]);
  });

  it('still falls back by checklist recency when a generic named list does not exist', () => {
    const lists = [
      {
        id: 'older',
        name: 'Weekend',
        kind: 'checklist' as const,
        canEdit: true,
        updatedAt: '2026-08-01T00:00:00.000Z',
        openTitles: [],
      },
      {
        id: 'recent',
        name: '7 Maple',
        kind: 'checklist' as const,
        canEdit: true,
        updatedAt: '2026-08-13T02:00:00.000Z',
        openTitles: [],
      },
    ];

    expect(matchVoiceList(lists, 'checklist')?.id).toBe('recent');
  });

  it('builds a snapshot of open titles and applies pending adds', () => {
    const groceries = useChecklists.getState().createList('Groceries', 'grocery');
    useChecklists.getState().addTask(groceries!.id, 'Eggs');
    const snapshot = buildVoiceSnapshot(useChecklists.getState());
    expect(snapshot.lists).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Groceries',
          kind: 'grocery',
          canEdit: true,
          openTitles: ['Eggs'],
        }),
      ]),
    );

    expect(
      applyVoicePendingToStore([
        {
          id: 'op-1',
          title: 'Milk',
          listName: 'Groceries',
          kindHint: 'grocery',
          createdAt: updatedAt,
        },
      ]),
    ).toBe(1);
    expect(
      useChecklists
        .getState()
        .tasks.filter((task) => !task.completed)
        .map((task) => task.title)
        .sort(),
    ).toEqual(['Eggs', 'Milk']);
  });

  it('groups open tasks by list and preserves their position order', () => {
    const first = useChecklists.getState().createList('First', 'checklist')!;
    const second = useChecklists.getState().createList('Second', 'checklist')!;
    useChecklists.getState().addTask(first.id, 'Later');
    useChecklists.getState().addTask(first.id, 'Sooner');
    useChecklists.getState().addTask(second.id, 'Elsewhere');

    const firstTasks = useChecklists.getState().tasks.filter((task) => task.listId === first.id);
    const later = firstTasks.find((task) => task.title === 'Later')!;
    const sooner = firstTasks.find((task) => task.title === 'Sooner')!;
    useChecklists.setState((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id === later.id) return { ...task, position: 2 };
        if (task.id === sooner.id) return { ...task, position: 1 };
        return task;
      }),
    }));
    useChecklists.getState().toggleTask(later.id);

    const snapshot = buildVoiceSnapshot(useChecklists.getState());
    expect(snapshot.lists.find((list) => list.id === first.id)?.openTitles).toEqual([
      'Sooner',
    ]);
    expect(snapshot.lists.find((list) => list.id === second.id)?.openTitles).toEqual([
      'Elsewhere',
    ]);
  });

  it('creates To Do when no list exists yet', () => {
    useChecklists.setState({
      lists: [],
      tasks: [],
      categories: [],
      recipes: [],
      members: [],
    });
    expect(
      applyVoicePendingToStore([
        { id: 'op-empty', title: 'Pack charger', createdAt: updatedAt },
      ]),
    ).toBe(1);
    expect(useChecklists.getState().lists[0]).toMatchObject({
      name: 'To Do',
      kind: 'checklist',
    });
  });

  it('adds unnamed items to the default To Do list', () => {
    expect(
      applyVoicePendingToStore([
        { id: 'op-2', title: 'Pack charger', createdAt: updatedAt },
      ]),
    ).toBe(1);
    expect(useChecklists.getState().lists[0]).toMatchObject({
      name: 'To Do',
      kind: 'checklist',
    });
    expect(useChecklists.getState().tasks[0].title).toBe('Pack charger');
  });

  it('does not mint a private Groceries list when the shared one is not editable', () => {
    const groceries = useChecklists.getState().createList('Groceries', 'grocery')!;
    useChecklists.setState((state) => ({
      lists: state.lists.map((list) =>
        list.id === groceries.id
          ? { ...list, mode: 'shared' as const, role: 'member' as const }
          : list,
      ),
    }));

    expect(
      applyVoicePendingToStore([
        {
          id: 'op-shared',
          title: 'Milk',
          listName: 'Groceries',
          kindHint: 'grocery',
          createdAt: updatedAt,
        },
      ]),
    ).toBe(0);
    expect(useChecklists.getState().lists.filter((list) => list.name === 'Groceries')).toHaveLength(
      1,
    );
    expect(useChecklists.getState().tasks).toEqual([]);
  });

  it('creates a grocery list when the voice add is a grocery item', () => {
    expect(
      applyVoicePendingToStore([
        {
          id: 'op-3',
          title: 'Milk',
          kindHint: 'grocery',
          createdAt: updatedAt,
        },
      ]),
    ).toBe(1);
    expect(useChecklists.getState().lists[0]).toMatchObject({
      name: 'Groceries',
      kind: 'grocery',
    });
  });
});
