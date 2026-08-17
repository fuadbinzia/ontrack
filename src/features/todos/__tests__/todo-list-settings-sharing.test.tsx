import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChecklistSettingsSharing } from '../todo-list-settings-sharing';
import type { FriendProfile } from '@/services/friends';
import type { Checklist } from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';

jest.mock('@/components/primitives/dropdown', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    Dropdown: (props: {
      label: string;
      value: string[];
      options: { value: string; label: string; testID?: string }[];
      onChange: (value: string[]) => void;
      onOpenChange?: (open: boolean) => void;
      menuFooter?: React.ReactNode;
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
          label: props.label,
          selectedLabel: '',
          onPress: () => props.onOpenChange?.(true),
          fieldRef: { current: null },
        }),
        ...props.options.map((option) =>
          React.createElement(
            Pressable,
            {
              key: option.value,
              testID: option.testID,
              onPress: () => props.onChange([...props.value, option.value]),
            },
            React.createElement(Text, null, option.label),
          ),
        ),
        props.menuFooter,
      ),
  };
});

jest.mock('@/features/account/profile-avatar', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { ProfileAvatar: () => React.createElement(View) };
});

const list: Checklist = {
  id: 'list-1',
  name: 'Iceland Packing List',
  kind: 'checklist',
  mode: 'shared',
  role: 'owner',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

const friend: FriendProfile = {
  userId: 'friend-1',
  displayName: 'Alex Example',
  avatar: { kind: 'initials' },
};

function renderSharing(
  user: { id: string } | null,
  working?: string,
  excludeEditorIds: string[] = [],
) {
  const onAddEditors = jest.fn();
  const requireSignIn = jest.fn();
  render(
    <ChecklistSettingsSharing
      list={list}
      working={working}
      spacing={{ md: 16, sm: 12, xs: 8 }}
      beginSharing={jest.fn()}
      shareLink={jest.fn()}
      run={jest.fn()}
      friends={[friend]}
      excludeEditorIds={excludeEditorIds}
      onAddEditors={onAddEditors}
      requireSignIn={requireSignIn}
      user={user}
    />,
  );
  return { onAddEditors, requireSignIn };
}

describe('ChecklistSettingsSharing', () => {
  it('opens Add Editors as a dropdown and confirms selected friends', () => {
    const handlers = renderSharing({ id: 'owner-1' });

    fireEvent.press(screen.getByTestId(AgentUiIds.listSettings.addEditors));
    fireEvent.press(
      screen.getByTestId(AgentUiIds.listSettings.editor(friend.userId)),
    );
    fireEvent.press(
      screen.getByTestId(AgentUiIds.listSettings.confirmEditors),
    );

    expect(handlers.onAddEditors).toHaveBeenCalledWith([friend]);
    expect(handlers.requireSignIn).not.toHaveBeenCalled();
  });

  it('routes signed-out users to sign in instead of opening the picker', () => {
    const handlers = renderSharing(null);

    fireEvent.press(screen.getByTestId(AgentUiIds.listSettings.addEditors));

    expect(handlers.requireSignIn).toHaveBeenCalledTimes(1);
    expect(handlers.onAddEditors).not.toHaveBeenCalled();
  });

  it('excludes people who are already members of the list', () => {
    renderSharing({ id: 'owner-1' }, undefined, [friend.userId]);

    expect(
      screen.queryByTestId(AgentUiIds.listSettings.editor(friend.userId)),
    ).toBeNull();
  });

  it('keeps Add Editors disabled while another sharing action is running', () => {
    const handlers = renderSharing({ id: 'owner-1' }, 'link');

    fireEvent.press(screen.getByTestId(AgentUiIds.listSettings.addEditors));

    expect(handlers.onAddEditors).not.toHaveBeenCalled();
    expect(handlers.requireSignIn).not.toHaveBeenCalled();
  });
});
