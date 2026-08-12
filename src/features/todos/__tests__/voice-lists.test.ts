import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import {
  applyVoicePendingToStore,
  buildVoiceSnapshot,
  inferVoiceKindHint,
  matchVoiceList,
  voiceListNameQuery,
} from '@/features/todos/voice-lists';
import { useTodos } from '@/store/todos';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

const updatedAt = '2026-08-12T12:00:00.000Z';

describe('voice lists', () => {
  beforeEach(() => {
    useTodos.getState().reset();
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

  it('builds a snapshot of open titles and applies pending adds', () => {
    const groceries = useTodos.getState().createList('Groceries', 'grocery');
    useTodos.getState().addTask(groceries!.id, 'Eggs');
    const snapshot = buildVoiceSnapshot(useTodos.getState());
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
      useTodos
        .getState()
        .tasks.filter((task) => !task.completed)
        .map((task) => task.title)
        .sort(),
    ).toEqual(['Eggs', 'Milk']);
  });

  it('creates To Do when no list exists yet', () => {
    useTodos.setState({
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
    expect(useTodos.getState().lists[0]).toMatchObject({
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
    expect(useTodos.getState().lists[0]).toMatchObject({
      name: 'To Do',
      kind: 'checklist',
    });
    expect(useTodos.getState().tasks[0].title).toBe('Pack charger');
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
    expect(useTodos.getState().lists[0]).toMatchObject({
      name: 'Groceries',
      kind: 'grocery',
    });
  });
});
