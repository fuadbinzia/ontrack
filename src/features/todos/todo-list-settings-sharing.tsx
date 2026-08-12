import { Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  SectionHeader,
} from '@/components/primitives';
import { revokeTodoShareLink } from '@/services/todos/collaboration';
import type { TodoList } from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';

export type TodoListSettingsSharingProps = {
  list: TodoList;
  working: string | undefined;
  spacing: { md: number; sm: number; xs: number };
  beginSharing: () => void;
  shareLink: () => void;
  run: (
    key: string,
    work: () => Promise<unknown> | unknown,
  ) => Promise<void> | void;
  setPickingFriends: (v: boolean) => void;
  requireSignIn: () => void;
  user: { id: string } | null | undefined;
};

export function TodoListSettingsSharing({
  list,
  working,
  spacing,
  beginSharing,
  shareLink,
  run,
  setPickingFriends,
  requireSignIn,
  user,
}: TodoListSettingsSharingProps) {
  const shared = list.mode === 'shared';
  const busy = Boolean(working);

  const openEditors = () => {
    if (!user) return requireSignIn();
    setPickingFriends(true);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <SectionHeader flush title="Sharing" />
      <Card style={{ gap: spacing.md }}>
        <AppText variant="caption" color="secondary">
          {shared
            ? 'Add editors or share a join link. You stay the owner.'
            : 'Add friends or share a join link to move this list into its collaborative space. You stay the owner.'}
        </AppText>

        <Button
          testID={AgentUiIds.listSettings.addEditors}
          icon="people"
          disabled={busy}
          onPress={openEditors}>
          {working === 'friends' ? 'Adding…' : 'Add Editors'}
        </Button>

        <Button
          icon="send"
          disabled={busy}
          onPress={shared ? shareLink : beginSharing}>
          {working === 'link' || working === 'publish'
            ? 'Preparing…'
            : 'Share Join Link'}
        </Button>

        {shared && list.shareCode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Revoke join link"
            disabled={busy}
            hitSlop={8}
            onPress={() =>
              void run('revoke', () => revokeTodoShareLink(list.id))
            }
            style={({ pressed }) => ({
              alignSelf: 'center',
              opacity: pressed || busy ? 0.55 : 1,
              minHeight: 44,
              justifyContent: 'center',
            })}>
            <AppText variant="caption" color="danger" fit>
              {working === 'revoke' ? 'Revoking…' : 'Revoke join link'}
            </AppText>
          </Pressable>
        ) : null}
      </Card>
    </View>
  );
}
