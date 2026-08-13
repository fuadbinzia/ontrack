import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { todoListSettingsStyles as styles } from './todo-list-settings-styles';

import {
  AppText,
  appPrompt,
  Button,
  Card,
  ErrorMessage,
  GlassPlate,
  IconButton,
  Input,
  SectionHeader,
  SheetScaffold,
  Symbol,
} from '@/components/primitives';
import { glassMaterials } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { useAuthSession } from '@/features/auth/auth-provider';
import { shareTodoInvite } from '@/features/todos/share';
import { TodoListSettingsSharing } from '@/features/todos/todo-list-settings-sharing';
import { performTodoListRemoval } from '@/features/todos/todo-list-remove';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { FriendProfile } from '@/services/friends';
import {
  addTodoFriendEditors,
  createTodoShareLink,
  leaveTodoList,
  publishTodoList,
  removeTodoMember,
  setTodoMemberRole,
  transferTodoListOwnership,
} from '@/services/todos/collaboration';
import { useFriends } from '@/store/friends';
import { useTodos, type TodoMember } from '@/store/todos';
import { AgentUiIds, AgentTestId } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { haptics } from '@/utils/haptics';

export function TodoListSettingsSheet({
  listId,
  visible,
  onClose,
}: {
  listId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const theme = useTheme();
  const dark = theme.name === 'dark';
  const plateBorder = dark
    ? glassMaterials.border.dark
    : glassMaterials.border.light;
  const { spacing, s } = useResponsive();
  const { user } = useAuthSession();
  const list = useTodos((state) => state.lists.find((item) => item.id === listId));
  const allMembers = useTodos((state) => state.members);
  const members = useMemo(
    () =>
      allMembers
        .filter((member) => member.listId === listId)
        .slice()
        .sort((left, right) => {
          if (left.role === 'owner' && right.role !== 'owner') return -1;
          if (right.role === 'owner' && left.role !== 'owner') return 1;
          return left.joinedAt.localeCompare(right.joinedAt);
        }),
    [allMembers, listId],
  );
  const otherMembers = useMemo(
    () => members.filter((member) => member.role !== 'owner'),
    [members],
  );
  const memberExcludeIds = useMemo(
    () => members.map((member) => member.userId),
    [members],
  );
  const friends = useFriends((state) => state.friends);
  const renameList = useTodos((state) => state.renameList);
  const setListKind = useTodos((state) => state.setListKind);
  const recipeCount = useTodos(
    (state) =>
      state.recipes.filter((recipe) => recipe.listId === listId).length,
  );
  const [name, setName] = useState(list?.name ?? '');
  const [working, setWorking] = useState<string>();
  const [error, setError] = useState<string>();
  const hydrateFriends = useFriends((state) => state.hydrate);

  useEffect(() => {
    if (!visible) return;
    setName(list?.name ?? '');
    setError(undefined);
  }, [visible, list?.name]);

  useEffect(() => {
    if (!visible || !user || list?.role !== 'owner') return;
    void hydrateFriends().catch(() => undefined);
  }, [visible, list?.role, listId, user, hydrateFriends]);

  const dismiss = () => {
    Keyboard.dismiss();
    onClose();
  };

  // Hosted from the list screen (list already resolved). Missing list → render
  // nothing rather than an "Unavailable" Modal flash over the live checklist.
  if (!list) return null;

  const owner = list.role === 'owner';
  const cleanName = name.trim();
  const canSaveName = Boolean(cleanName) && cleanName !== list.name;
  const run = async (key: string, action: () => Promise<void>) => {
    setWorking(key);
    setError(undefined);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setWorking(undefined);
    }
  };

  const saveName = () => {
    if (!canSaveName) return;
    Keyboard.dismiss();
    renameList(list.id, cleanName);
    setName(cleanName);
    haptics.success();
  };

  const addFriendEditors = (friends: FriendProfile[]) => {
    if (!friends.length) return;
    void run('friends', async () => {
      if (list.mode === 'private') await publishTodoList(list.id);
      await addTodoFriendEditors(
        list.id,
        friends.map((friend) => friend.userId),
      );
      appPrompt.alert(
        'Editors Added',
        friends.length === 1
          ? `${friends[0].displayName} can now edit this list.`
          : `${friends.length} friends can now edit this list.`,
      );
    });
  };

  const roleLabel = (role: TodoMember['role']) => {
    if (role === 'owner') return 'Owner';
    if (role === 'editor') return 'Editor';
    return 'Member';
  };

  const requireSignIn = () => {
    router.push({
      pathname: '/account',
      params: { returnTo: `/todos/${list.id}/settings` },
    } as never);
  };

  const beginSharing = () => {
    if (!user) return requireSignIn();
    void run('publish', async () => {
      await publishTodoList(list.id);
      const code = await createTodoShareLink(list.id);
      await shareTodoInvite(list.name, code);
    });
  };

  const shareLink = () => {
    if (!user) return requireSignIn();
    void run('link', async () => {
      const code = list.shareCode ?? await createTodoShareLink(list.id);
      await shareTodoInvite(list.name, code);
    });
  };

  const leaveList = () => {
    confirmDestructiveAction({
      title: 'Leave This List?',
      message: 'It will disappear from your account.',
      actionLabel: 'Leave',
      onConfirm: () =>
        void run('leave', async () => {
          await leaveTodoList(list.id);
          onClose();
          router.replace('/(tabs)/to-do' as never);
        }),
    });
  };

  const transferOwnership = (member: TodoMember, leaveAfter: boolean) => {
    void run(`transfer-${member.userId}`, async () => {
      await transferTodoListOwnership(list.id, member.userId);
      if (leaveAfter) {
        await leaveTodoList(list.id);
        onClose();
        router.replace('/(tabs)/to-do' as never);
        return;
      }
      appPrompt.alert(
        'Ownership Transferred',
        `${member.displayName} is now the owner. You can leave whenever you’re ready.`,
      );
    });
  };

  const promptTransfer = (member: TodoMember) => {
    appPrompt.alert(
      'Transfer Ownership?',
      `${member.displayName} will become the owner and manage this list. You become a member, or you can leave now.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: () => transferOwnership(member, false),
        },
        {
          text: 'Transfer & Leave',
          style: 'destructive',
          onPress: () => transferOwnership(member, true),
        },
      ],
    );
  };

  const removeList = () => {
    const sharedWithOthers =
      list.mode === 'shared' && otherMembers.length > 0;
    confirmDestructiveAction({
      title: 'Delete This List?',
      message: sharedWithOthers
        ? 'This permanently deletes the list for you and every collaborator. It only stays available if you make someone else the owner first.'
        : 'The list and every item in it will be permanently deleted.',
      onConfirm: () => {
        void run('delete', async () => {
          await performTodoListRemoval(list, false);
          onClose();
          router.replace('/(tabs)/to-do' as never);
        });
      },
    });
  };

  return (
    <>
      <SheetScaffold
        visible={visible}
        eyebrow={list.mode === 'shared' ? 'Collaborative List' : 'Private List'}
        title={list.name}
        closeAccessibilityLabel="Close list settings"
        closeTestID={AgentUiIds.listSettings.close}
        onClose={dismiss}>
        {owner ? (
          <Card style={{ gap: spacing.md }}>
            <Input
              label="List name"
              testID={AgentUiIds.listSettings.name}
              value={name}
              onChangeText={setName}
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={saveName}
              trailing={
                <IconButton
                  accessibilityLabel="Save list name"
                  color={theme.accentPrimary}
                  disabled={!canSaveName}
                  icon="check"
                  testID={AgentUiIds.listSettings.saveName}
                  onPress={saveName}
                />
              }
            />
            <AppText variant="overline" color="tertiary">
              List type
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: list.kind === 'checklist' }}
                disabled={list.kind === 'grocery' && recipeCount > 0}
                onPress={() => setListKind(list.id, 'checklist')}
                style={({ pressed }) => [
                  styles.kindChoiceWrap,
                  {
                    opacity:
                      list.kind === 'grocery' && recipeCount > 0
                        ? 0.45
                        : pressed
                          ? 0.72
                          : 1,
                  },
                ]}>
                <GlassPlate
                  airy={list.kind !== 'checklist'}
                  style={[
                    styles.kindChoice,
                    {
                      minHeight: Math.max(44, s(48)),
                      gap: spacing.sm,
                      borderColor:
                        list.kind === 'checklist'
                          ? theme.accentPrimary
                          : plateBorder,
                      borderWidth:
                        list.kind === 'checklist'
                          ? 1
                          : StyleSheet.hairlineWidth,
                    },
                  ]}>
                  <Symbol name="tasks" size={18} color={theme.textSecondary} />
                  <AppText variant="caption" fit>
                    Checklist
                  </AppText>
                </GlassPlate>
              </Pressable>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: list.kind === 'grocery' }}
                onPress={() => setListKind(list.id, 'grocery')}
                style={({ pressed }) => [
                  styles.kindChoiceWrap,
                  { opacity: pressed ? 0.72 : 1 },
                ]}>
                <GlassPlate
                  airy={list.kind !== 'grocery'}
                  style={[
                    styles.kindChoice,
                    {
                      minHeight: Math.max(44, s(48)),
                      gap: spacing.sm,
                      borderColor:
                        list.kind === 'grocery'
                          ? theme.accentPrimary
                          : plateBorder,
                      borderWidth:
                        list.kind === 'grocery' ? 1 : StyleSheet.hairlineWidth,
                    },
                  ]}>
                  <Symbol name="groceries" size={18} color={theme.textSecondary} />
                  <AppText variant="caption" fit>
                    Grocery
                  </AppText>
                </GlassPlate>
              </Pressable>
            </View>
            {list.kind === 'grocery' && recipeCount > 0 ? (
              <AppText variant="caption" color="secondary">
                Delete the {recipeCount === 1 ? 'recipe' : `${recipeCount} recipes`}{' '}
                before converting this list back to a checklist.
              </AppText>
            ) : null}
          </Card>
        ) : (
          <Card variant="sunken" style={{ gap: spacing.md }}>
            <AppText variant="heading">Shared with You</AppText>
            <AppText variant="body" color="secondary">
              {list.role === 'editor'
                ? 'You can add, edit, assign, and complete items. The owner manages membership and list settings.'
                : `${list.ownerName ?? 'The owner'} manages items, assignments, and membership. You can complete items assigned to you or Anyone.`}
            </AppText>
          </Card>
        )}

        {list.mode === 'shared' ? (
          <View style={{ gap: spacing.xs }}>
            <SectionHeader
              flush
              title="Members"
              detail={`${members.length}`}
            />
            <Card variant="sunken" style={{ gap: spacing.sm }}>
              {members.map((member) => (
                <View
                  key={member.userId}
                  style={[
                    styles.memberRow,
                    { minHeight: Math.max(58, s(56)), gap: spacing.md },
                  ]}>
                  <ProfileAvatar
                    displayName={member.displayName}
                    userId={member.userId}
                    isSelf={member.userId === user?.id}
                    size={Math.max(42, s(42))}
                  />
                  <View style={styles.memberCopy}>
                    <AppText variant="subheading" fit>
                      {member.displayName}
                    </AppText>
                    <AppText variant="caption" color="secondary" fit>
                      {roleLabel(member.role)}
                    </AppText>
                  </View>
                  {owner && member.role !== 'owner' ? (
                    <View style={[styles.memberActions, { gap: spacing.sm }]}>
                      {member.role === 'member' ? (
                        <AgentTestId
                          testID={AgentUiIds.listSettings.makeEditor(member.userId)}
                          label={`Make ${member.displayName} an editor`}
                          onPress={() =>
                            void run(`role-${member.userId}`, () =>
                              setTodoMemberRole(list.id, member.userId, 'editor'),
                            )
                          }>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Make ${member.displayName} an editor`}
                            disabled={Boolean(working)}
                            hitSlop={8}
                            onPress={() =>
                              void run(`role-${member.userId}`, () =>
                                setTodoMemberRole(list.id, member.userId, 'editor'),
                              )
                            }>
                            <AppText variant="caption" color="accent" fit>
                              Make editor
                            </AppText>
                          </Pressable>
                        </AgentTestId>
                      ) : (
                        <AgentTestId
                          testID={AgentUiIds.listSettings.makeMember(member.userId)}
                          label={`Make ${member.displayName} a member`}
                          onPress={() =>
                            void run(`role-${member.userId}`, () =>
                              setTodoMemberRole(list.id, member.userId, 'member'),
                            )
                          }>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Make ${member.displayName} a member`}
                            disabled={Boolean(working)}
                            hitSlop={8}
                            onPress={() =>
                              void run(`role-${member.userId}`, () =>
                                setTodoMemberRole(list.id, member.userId, 'member'),
                              )
                            }>
                            <AppText variant="caption" color="accent" fit>
                              Make member
                            </AppText>
                          </Pressable>
                        </AgentTestId>
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Make ${member.displayName} the owner`}
                        disabled={Boolean(working)}
                        hitSlop={8}
                        onPress={() => promptTransfer(member)}>
                        <AppText variant="caption" color="accent" fit>
                          Make owner
                        </AppText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${member.displayName}`}
                        disabled={Boolean(working)}
                        hitSlop={8}
                        onPress={() =>
                          appPrompt.alert(
                            'Remove Member?',
                            `${member.displayName} will lose access. Their assigned items become available to anyone.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Remove',
                                style: 'destructive',
                                onPress: () =>
                                  void run(`member-${member.userId}`, () =>
                                    removeTodoMember(list.id, member.userId),
                                  ),
                              },
                            ],
                          )
                        }>
                        <AppText variant="caption" color="danger" fit>
                          Remove
                        </AppText>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {owner ? (
          <TodoListSettingsSharing
            list={list}
            working={working}
            spacing={spacing}
            beginSharing={beginSharing}
            shareLink={shareLink}
            run={run}
            friends={friends}
            excludeEditorIds={memberExcludeIds}
            onAddEditors={addFriendEditors}
            requireSignIn={requireSignIn}
            user={user}
          />
        ) : null}

        {error ? <ErrorMessage message={error} selectable /> : null}

        {list.kind === 'grocery' ? (
          <View style={{ gap: spacing.xs }}>
            <SectionHeader flush title="List Access" />
            {owner ? (
              <>
                {list.mode === 'shared' && otherMembers.length > 0 ? (
                  <AppText variant="caption" color="secondary">
                    Delete removes this list for everyone. Make someone the owner
                    first only if they should keep it.
                  </AppText>
                ) : null}
                <Button
                  variant="danger"
                  disabled={Boolean(working)}
                  onPress={removeList}>
                  Delete list
                </Button>
              </>
            ) : (
              <Button
                variant="danger"
                disabled={Boolean(working)}
                onPress={leaveList}>
                Leave list
              </Button>
            )}
          </View>
        ) : null}
      </SheetScaffold>
    </>
  );
}
