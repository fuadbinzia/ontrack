import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
// StyleSheet via styles module

import { todoListSettingsStyles as styles } from './todo-list-settings-styles';

import {
  AppText,
  appPrompt,
  Button,
  Card,
  ErrorMessage,
  GlassPlate,
  Input,
  Screen,
  SectionHeader,
  Symbol,
} from '@/components/primitives';
import { glassMaterials, radii } from '@/design-system';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { useAuthSession } from '@/features/auth/auth-provider';
import { PeoplePicker } from '@/features/social/people-picker';
import { shareTodoInvite } from '@/features/todos/share';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { FriendProfile } from '@/services/friends';
import {
  addTodoFriendEditors,
  createTodoEmailInvite,
  createTodoShareLink,
  deleteSharedTodoList,
  leaveTodoList,
  loadTodoListPendingInvites,
  publishTodoList,
  removeTodoMember,
  revokeTodoEmailInvite,
  revokeTodoShareLink,
  setTodoMemberRole,
  transferTodoListOwnership,
  type PendingTodoEmailInvite,
} from '@/services/todos/collaboration';
import { deletePersistedRecipeImage } from '@/services/recipes';
import { useFriends } from '@/store/friends';
import { useTodos, type TodoMember } from '@/store/todos';
import { AgentUiIds, AgentTestId } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { TodoListSettingsSharing } from '@/features/todos/todo-list-settings-sharing';

export function TodoListSettingsScreen({ listId }: { listId: string }) {
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
    () => allMembers.filter((member) => member.listId === listId),
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
  const renameList = useTodos((state) => state.renameList);
  const setListKind = useTodos((state) => state.setListKind);
  const recipeCount = useTodos(
    (state) =>
      state.recipes.filter((recipe) => recipe.listId === listId).length,
  );
  const deletePrivateList = useTodos((state) => state.deleteList);
  const [name, setName] = useState(list?.name ?? '');
  const [email, setEmail] = useState('');
  const [working, setWorking] = useState<string>();
  const [error, setError] = useState<string>();
  const [pendingInvites, setPendingInvites] = useState<PendingTodoEmailInvite[]>([]);
  const [pickingFriends, setPickingFriends] = useState(false);
  const hydrateFriends = useFriends((state) => state.hydrate);

  const refreshPending = () =>
    loadTodoListPendingInvites(listId).then(setPendingInvites);

  useEffect(() => {
    if (!user || list?.role !== 'owner') return;
    void hydrateFriends().catch(() => undefined);
    if (list.mode === 'shared') {
      void refreshPending().catch(() => undefined);
    }
  }, [list?.mode, list?.role, listId, user, hydrateFriends]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!list) {
    return (
      <Screen contentStyle={{ ...styles.center, gap: spacing.lg }}>
        <Symbol name="tasks" size={40} color={theme.textTertiary} />
        <AppText variant="heading">List Unavailable</AppText>
        <Button onPress={() => router.replace('/(tabs)/to-do' as never)}>
          Back to Lists
        </Button>
      </Screen>
    );
  }

  const owner = list.role === 'owner';
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
          router.replace('/(tabs)/to-do' as never);
        }),
    });
  };

  const transferOwnership = (member: TodoMember, leaveAfter: boolean) => {
    void run(`transfer-${member.userId}`, async () => {
      await transferTodoListOwnership(list.id, member.userId);
      if (leaveAfter) {
        await leaveTodoList(list.id);
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
    confirmDestructiveAction({
      title: 'Delete This List?',
      message: 'The list and every item in it will be permanently deleted.',
      onConfirm: () => {
        void run('delete', async () => {
          if (list.mode === 'private') {
            useTodos
              .getState()
              .recipes.filter((recipe) => recipe.listId === list.id)
              .forEach((recipe) =>
                deletePersistedRecipeImage(recipe.sourceImageUri),
              );
          }
          if (list.mode === 'shared') await deleteSharedTodoList(list.id);
          else deletePrivateList(list.id);
          router.replace('/(tabs)/to-do' as never);
        });
      },
    });
  };

  return (
    <>
    <Screen
      contentStyle={{
        ...styles.container,
        gap: spacing.md,
        paddingBottom: spacing.xxxl,
      }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="overline" color="accent">
          {list.mode === 'shared' ? 'Collaborative List' : 'Private List'}
        </AppText>
        <AppText variant="display">{list.name}</AppText>
      </View>

      {owner ? (
        <Card style={{ gap: spacing.md }}>
          <AppText variant="heading">List Details</AppText>
          <Input
            label="List Name"
            testID={AgentUiIds.listSettings.name}
            value={name}
            onChangeText={setName}
            maxLength={80}
          />
          <Button
            testID={AgentUiIds.listSettings.saveName}
            disabled={!name.trim() || name.trim() === list.name}
            onPress={() => renameList(list.id, name)}>
            Save name
          </Button>
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

      {owner ? (
        <TodoListSettingsSharing
          list={list}
          email={email}
          setEmail={setEmail}
          working={working}
          pendingInvites={pendingInvites}
          spacing={spacing}
          s={s}
          beginSharing={beginSharing}
          shareLink={shareLink}
          run={run as any}
          refreshPending={refreshPending}
          setPickingFriends={setPickingFriends}
          requireSignIn={requireSignIn}
          user={user}
        />
      ) : null}

      {list.mode === 'shared' ? (
        <>
          <SectionHeader title="Members" detail={`${members.length}`} />
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
        </>
      ) : null}

      {error ? <ErrorMessage message={error} selectable /> : null}

      <SectionHeader title="List Access" />
      {owner ? (
        <>
          {list.mode === 'shared' && otherMembers.length > 0 ? (
            <AppText variant="caption" color="secondary">
              To leave without deleting, transfer ownership to another member first.
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
    </Screen>
    <PeoplePicker
      visible={pickingFriends}
      title="Add Editors"
      confirmLabel="Add Editors"
      excludeIds={memberExcludeIds}
      onClose={() => setPickingFriends(false)}
      onConfirm={addFriendEditors}
    />
    </>
  );
}
