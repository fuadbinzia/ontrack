import { Pressable, View } from 'react-native';

import {
  AppText,
  appPrompt,
  Button,
  Card,
  Input,
  SectionHeader,
} from '@/components/primitives';
import {
  createTodoEmailInvite,
  revokeTodoEmailInvite,
  revokeTodoShareLink,
  type PendingTodoEmailInvite,
} from '@/services/todos/collaboration';
import type { TodoList } from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';
import { todoListSettingsStyles as styles } from './todo-list-settings-styles';

export type TodoListSettingsSharingProps = {
  list: TodoList;
  email: string;
  setEmail: (v: string) => void;
  working: string | undefined;
  pendingInvites: PendingTodoEmailInvite[];
  spacing: { md: number; sm: number; xs: number };
  s: (n: number) => number;
  beginSharing: () => void;
  shareLink: () => void;
  run: (
    key: string,
    work: () => Promise<unknown> | unknown,
  ) => Promise<void> | void;
  refreshPending: () => Promise<void>;
  setPickingFriends: (v: boolean) => void;
  requireSignIn: () => void;
  user: { id: string } | null | undefined;
};

export function TodoListSettingsSharing({
  list,
  email,
  setEmail,
  working,
  pendingInvites,
  spacing,
  s,
  beginSharing,
  shareLink,
  run,
  refreshPending,
  setPickingFriends,
  requireSignIn,
  user,
}: TodoListSettingsSharingProps) {
  return (
    <>

          <SectionHeader title="Sharing" />
          <Card style={{ gap: spacing.md }}>
            <AppText variant="subheading">Editors</AppText>
            <AppText variant="body" color="secondary">
              Friends you add can edit items live. You stay the owner.
              {list.mode === 'private'
                ? ' Adding an editor moves this list into its collaborative space.'
                : ''}
            </AppText>
            <Button
              testID={AgentUiIds.listSettings.addEditors}
              icon="people"
              disabled={Boolean(working)}
              onPress={() => {
                if (!user) return requireSignIn();
                setPickingFriends(true);
              }}>
              {working === 'friends' ? 'Adding…' : 'Add Editors from Friends'}
            </Button>
          </Card>
          {list.mode === 'private' ? (
            <Card style={{ gap: spacing.md }}>
              <AppText variant="subheading">Work Together Live</AppText>
              <AppText variant="body" color="secondary">
                Sharing moves this list to its protected collaborative space. You remain the owner.
              </AppText>
              <Button
                icon="people"
                disabled={Boolean(working)}
                onPress={beginSharing}>
                {working === 'publish' ? 'Preparing…' : 'Share Join Link'}
              </Button>
            </Card>
          ) : (
            <>
              <Card style={{ gap: spacing.md }}>
                <AppText variant="subheading">Secure Join Link</AppText>
                <AppText variant="body" color="secondary">
                  Any signed-in onTrack user with the link can join as a member until you revoke it.
                </AppText>
                <Button disabled={Boolean(working)} onPress={shareLink} icon="send">
                  {working === 'link' ? 'Preparing…' : 'Share Join Link'}
                </Button>
                {list.shareCode ? (
                  <Button
                    variant="ghost"
                    disabled={Boolean(working)}
                    onPress={() =>
                      void run('revoke', () => revokeTodoShareLink(list.id))
                    }>
                    Revoke link
                  </Button>
                ) : null}
              </Card>

              <Card style={{ gap: spacing.md }}>
                <AppText variant="subheading">Invite an Account</AppText>
                <AppText variant="body" color="secondary">
                  Email invites join as members. Promote them to editor after they accept.
                </AppText>
                <Input
                  label="onTrack account email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="friend@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button
                  icon="invite"
                  disabled={!email.trim() || Boolean(working)}
                  onPress={() =>
                    void run('email', async () => {
                      await createTodoEmailInvite(list.id, email);
                      await refreshPending();
                      setEmail('');
                      appPrompt.alert('Invitation Ready', 'It now appears in their onTrack invitation inbox.');
                    })
                  }>
                  {working === 'email' ? 'Inviting…' : 'Send In-App Invite'}
                </Button>
                {pendingInvites.length > 0 ? (
                  <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
                    <AppText variant="overline" color="secondary" fit>
                      Pending
                    </AppText>
                    {pendingInvites.map((invite) => (
                      <View
                        key={invite.id}
                        style={[
                          styles.pendingRow,
                          { minHeight: Math.max(38, s(40)), gap: spacing.md },
                        ]}>
                        <AppText
                          variant="caption"
                          color="secondary"
                          style={styles.memberCopy}
                          fit>
                          {invite.email}
                        </AppText>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Revoke invitation for ${invite.email}`}
                          disabled={Boolean(working)}
                          onPress={() =>
                            void run(`invite-${invite.id}`, async () => {
                              await revokeTodoEmailInvite(invite.id);
                              await refreshPending();
                            })
                          }>
                          <AppText variant="caption" color="danger" fit>
                            Revoke
                          </AppText>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            </>
          )}
        
    </>
  );
}
