import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  ErrorMessage,
  Screen,
  Symbol,
} from '@/components/primitives';
import { spacing } from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import {
  acceptChecklistEmailInvite,
  loadChecklistInvites,
} from '@/services/todos/collaboration';
import { useChecklists } from '@/store/todos';

export function ChecklistInvitesScreen() {
  const router = useRouter();
  const { user } = useAuthSession();
  const invites = useChecklists((state) => state.invites);
  const [working, setWorking] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!user) return;
    void loadChecklistInvites().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Invitations could not be loaded.');
    });
  }, [user]);

  if (!user) {
    return (
      <Screen contentStyle={styles.center}>
        <Symbol name="invite" size={44} />
        <AppText variant="display" align="center">Your Invitation Inbox</AppText>
        <AppText variant="body" color="secondary" align="center">
          Sign in with the email address that was invited.
        </AppText>
        <Button
          onPress={() =>
            router.push({
              pathname: '/account',
              params: { returnTo: '/todo-invites' },
            } as never)
          }>
          Sign in
        </Button>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.heading}>
        <AppText variant="overline" color="accent">To Do</AppText>
        <AppText variant="display">Invitations</AppText>
        <AppText variant="body" color="secondary">
          Lists shared directly with your account appear here.
        </AppText>
      </View>

      {error ? <ErrorMessage message={error} selectable /> : null}

      {invites.length === 0 ? (
        <View style={styles.center}>
          <Symbol name="status-completed" size={40} />
          <AppText variant="heading">You’re all caught up</AppText>
          <AppText variant="body" color="secondary" align="center">
            New list invitations will appear here.
          </AppText>
        </View>
      ) : (
        invites.map((invite) => (
          <Card key={invite.id} style={styles.card}>
            <AppText variant="overline" color="accent">Shared by {invite.inviterName}</AppText>
            <AppText variant="heading">{invite.listName}</AppText>
            <AppText variant="body" color="secondary">
              Join to see live updates and complete items assigned to you or Anyone.
            </AppText>
            <Button
              disabled={Boolean(working)}
              onPress={() => {
                setWorking(invite.id);
                setError(undefined);
                void acceptChecklistEmailInvite(invite.id)
                  .then((listId) => router.replace(`/(tabs)/to-do/${listId}` as never))
                  .catch((caught: unknown) => {
                    setError(caught instanceof Error ? caught.message : 'The invitation could not be accepted.');
                  })
                  .finally(() => setWorking(undefined));
              }}>
              {working === invite.id ? 'Joining…' : 'Join List'}
            </Button>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  heading: { gap: spacing.xs },
  card: { gap: spacing.md },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});
