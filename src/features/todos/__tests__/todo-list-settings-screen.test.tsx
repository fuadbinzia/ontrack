import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChecklistSettingsSheet } from '@/features/todos/todo-list-settings-screen';
import type { Checklist, ChecklistMember, ChecklistRecipe } from '@/store/todos';
import { useChecklists } from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({ user: { id: 'owner-1' } }),
}));

jest.mock('@/store/friends', () => ({
  useFriends: (
    selector: (state: {
      friends: [];
      hydrate: () => Promise<void>;
    }) => unknown,
  ) =>
    selector({
      friends: [],
      hydrate: async () => undefined,
    }),
}));

jest.mock('@/components/primitives/sheet-scaffold', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    SheetHeader: () => null,
    SheetScaffold: ({
      visible,
      eyebrow,
      title,
      closeAccessibilityLabel,
      onClose,
      children,
    }: {
      visible: boolean;
      eyebrow?: string;
      title: string;
      closeAccessibilityLabel?: string;
      onClose: () => void;
      children: React.ReactNode;
    }) =>
      visible
        ? React.createElement(
            View,
            null,
            React.createElement(Text, null, eyebrow),
            React.createElement(Text, null, title),
            React.createElement(Pressable, {
              accessibilityLabel: closeAccessibilityLabel,
              onPress: onClose,
            }),
            children,
          )
        : null,
  };
});

jest.mock('@/components/primitives/dropdown', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    Dropdown: (props: {
      renderTrigger: (args: {
        open: boolean;
        label: string;
        selectedLabel: string;
        onPress: () => void;
        fieldRef: { current: null };
      }) => React.ReactNode;
    }) =>
      React.createElement(
        View,
        null,
        props.renderTrigger({
          open: false,
          label: 'Add Editors',
          selectedLabel: '',
          onPress: () => undefined,
          fieldRef: { current: null },
        }),
      ),
  };
});

jest.mock('@/features/account/profile-avatar', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { ProfileAvatar: () => React.createElement(View) };
});

const createdAt = '2026-08-12T00:00:00.000Z';

function seedList(
  overrides: Partial<Checklist> = {},
  extras: {
    members?: ChecklistMember[];
    recipes?: ChecklistRecipe[];
  } = {},
) {
  const list: Checklist = {
    id: 'list-maple',
    name: '7 Maple',
    kind: 'checklist',
    mode: 'private',
    role: 'owner',
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
  useChecklists.setState({
    lists: [list],
    members: extras.members ?? [],
    recipes: extras.recipes ?? [],
  });
  return list;
}

function renderSettings(listId = 'list-maple') {
  return render(
    <ChecklistSettingsSheet listId={listId} visible onClose={jest.fn()} />,
  );
}

function expectNoListTypePicker() {
  expect(screen.queryByText('List type')).toBeNull();
  expect(screen.queryByText('List Type')).toBeNull();
  expect(screen.queryByText('Checklist')).toBeNull();
  expect(screen.queryByText('Grocery')).toBeNull();
  expect(screen.queryByLabelText('Checklist')).toBeNull();
  expect(screen.queryByLabelText('Grocery')).toBeNull();
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  expect(
    screen.queryByText(/converting this list back to a checklist/i),
  ).toBeNull();
}

describe('ChecklistSettingsSheet list type', () => {
  beforeEach(() => {
    useChecklists.getState().reset();
  });

  it('hides List Type on a private list and keeps List Name plus Sharing', () => {
    seedList();
    renderSettings();

    expect(screen.getByText('Private List')).toBeTruthy();
    expect(screen.getByDisplayValue('7 Maple')).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.listSettings.name)).toBeTruthy();
    expect(screen.getByText('Sharing')).toBeTruthy();
    expect(
      screen.getByText(
        'Add friends or share a join link to move this list into its collaborative space. You stay the owner.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.listSettings.addEditors)).toBeTruthy();
    expectNoListTypePicker();
  });

  it('still saves a renamed private list from the name field', () => {
    seedList();
    renderSettings();

    fireEvent.changeText(
      screen.getByTestId(AgentUiIds.listSettings.name),
      'Maple Grove',
    );
    fireEvent.press(screen.getByTestId(AgentUiIds.listSettings.saveName));

    expect(useChecklists.getState().lists[0]?.name).toBe('Maple Grove');
    expectNoListTypePicker();
  });

  it('hides List Type on a private grocery list that still has recipes', () => {
    seedList(
      { kind: 'grocery' },
      {
        recipes: [
          {
            id: 'recipe-1',
            listId: 'list-maple',
            name: 'Pasta',
            sourceKind: 'url',
            sourceUrl: 'https://example.com/pasta',
            targetServings: 4,
            createdAt,
            updatedAt: createdAt,
          },
        ],
      },
    );
    renderSettings();

    expect(screen.getByTestId(AgentUiIds.listSettings.name)).toBeTruthy();
    expect(screen.getByText('Sharing')).toBeTruthy();
    expect(screen.getByText('Delete List')).toBeTruthy();
    expectNoListTypePicker();
  });

  it('hides List Type for a shared owner and a non-owner', () => {
    seedList({ mode: 'shared' }, {
      members: [
        {
          listId: 'list-maple',
          userId: 'owner-1',
          displayName: 'Alex Rivera',
          role: 'owner',
          joinedAt: createdAt,
        },
      ],
    });
    const { unmount } = renderSettings();

    expect(screen.getByText('Collaborative List')).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.listSettings.name)).toBeTruthy();
    expect(screen.getByText('Sharing')).toBeTruthy();
    expect(screen.getByText('Members')).toBeTruthy();
    expectNoListTypePicker();
    unmount();

    seedList({ mode: 'shared', role: 'member', ownerName: 'Alex Rivera' });
    renderSettings();

    expect(screen.getByText('Shared with You')).toBeTruthy();
    expect(screen.queryByTestId(AgentUiIds.listSettings.name)).toBeNull();
    expect(screen.queryByText('Sharing')).toBeNull();
    expectNoListTypePicker();
  });
});
