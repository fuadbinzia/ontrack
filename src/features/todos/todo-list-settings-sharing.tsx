import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Dropdown,
  GlassPrimaryAction,
  SectionHeader,
} from '@/components/primitives';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import type { FriendProfile } from '@/services/friends';
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
    work: () => Promise<void>,
  ) => Promise<void>;
  friends: FriendProfile[];
  excludeEditorIds: string[];
  onAddEditors: (friends: FriendProfile[]) => void;
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
  friends,
  excludeEditorIds,
  onAddEditors,
  requireSignIn,
  user,
}: TodoListSettingsSharingProps) {
  const shared = list.mode === 'shared';
  const busy = Boolean(working);
  const [editorDropdownOpen, setEditorDropdownOpen] = useState(false);
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>([]);
  const previousWorking = useRef(working);
  const eligibleFriends = useMemo(() => {
    const excluded = new Set(excludeEditorIds);
    return friends.filter((friend) => !excluded.has(friend.userId));
  }, [excludeEditorIds, friends]);
  const editorOptions = useMemo(
    () =>
      eligibleFriends.map((friend) => ({
        value: friend.userId,
        label: friend.displayName,
        testID: AgentUiIds.listSettings.editor(friend.userId),
        leading: (
          <ProfileAvatar
            displayName={friend.displayName}
            userId={friend.userId}
            avatar={friend.avatar}
            size={28}
          />
        ),
      })),
    [eligibleFriends],
  );

  useEffect(() => {
    const eligibleIds = new Set(eligibleFriends.map((friend) => friend.userId));
    setSelectedEditorIds((current) =>
      current.filter((id) => eligibleIds.has(id)),
    );
  }, [eligibleFriends]);

  useEffect(() => {
    if (previousWorking.current === 'friends' && working !== 'friends') {
      setSelectedEditorIds([]);
    }
    previousWorking.current = working;
  }, [working]);

  const setEditorsOpen = (open: boolean) => {
    if (open && !user) return requireSignIn();
    if (open && busy) return;
    setEditorDropdownOpen(open);
  };

  const confirmEditors = () => {
    const selected = eligibleFriends.filter((friend) =>
      selectedEditorIds.includes(friend.userId),
    );
    if (!selected.length || busy) return;
    setEditorDropdownOpen(false);
    onAddEditors(selected);
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

        <Dropdown
          label="Add Editors"
          multiple
          open={editorDropdownOpen}
          onOpenChange={setEditorsOpen}
          value={selectedEditorIds}
          options={editorOptions}
          onChange={setSelectedEditorIds}
          menuFooter={
            eligibleFriends.length ? (
              <GlassPrimaryAction
                label={working === 'friends'
                  ? 'Adding…'
                  : selectedEditorIds.length
                    ? `Add ${selectedEditorIds.length} ${selectedEditorIds.length === 1 ? 'Editor' : 'Editors'}`
                    : 'Choose Editors'}
                disabled={!selectedEditorIds.length || busy}
                onPress={confirmEditors}
                testID={AgentUiIds.listSettings.confirmEditors}
              />
            ) : (
              <AppText variant="caption" color="secondary" align="center">
                Add friends on the Social tab first.
              </AppText>
            )
          }
          menuFooterHeight={60}
          renderTrigger={({ open, onPress, fieldRef }) => (
            <View ref={fieldRef} collapsable={false}>
              <Button
                testID={AgentUiIds.listSettings.addEditors}
                icon="people"
                disabled={busy}
                onPress={onPress}>
                {working === 'friends'
                  ? 'Adding…'
                  : selectedEditorIds.length
                    ? `${selectedEditorIds.length} ${selectedEditorIds.length === 1 ? 'Editor' : 'Editors'} Selected`
                    : open
                      ? 'Choose Editors'
                      : 'Add Editors'}
              </Button>
            </View>
          )}
        />

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
