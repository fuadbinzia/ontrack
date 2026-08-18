import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

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
import { createInstalledChecklistCollaboratorJoinUrl } from '@/features/todos/share';
import {
  acceptChecklistCollaboratorLink,
  resolveChecklistCollaboratorLink,
} from '@/services/todos/collaboration';

const APP_STORE_URL = 'https://apps.apple.com/app/id6789723522';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.imtihoss.ontracknow';

interface ResolvedInvite {
  inviterName: string;
  listNames: string[];
}

export function ChecklistCollaboratorJoinScreen({ code }: { code: string }) {
  const router = useRouter();
  const { user, continueWithProvider, workingProvider } = useAuthSession();
  const validCode = /^[a-f0-9]{36}$/.test(code);
  const [resolved, setResolved] = useState<ResolvedInvite>();
  const [error, setError] = useState<string>();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!user || !validCode) return;
    let active = true;
    void resolveChecklistCollaboratorLink(code)
      .then((result) => {
        if (!active) return;
        if (result) setResolved(result);
        else setError('This collaborator link is no longer open. Ask the owner for a fresh invite.');
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'This collaborator link could not be opened.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [code, user, validCode]);

  if (!validCode) {
    return (
      <Screen contentStyle={styles.center}>
        <ErrorMessage
          message="This collaborator link looks incomplete. Ask the owner for a fresh invite."
          variant="heading"
          align="center"
        />
        <Button onPress={() => router.replace('/' as never)}>Go to onTrack</Button>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen contentStyle={styles.center}>
        <Symbol name="invite" size={48} />
        <AppText variant="display" align="center">You’re invited 📝</AppText>
        <AppText variant="body" color="secondary" align="center">
          Open onTrack and sign in to get access to the checklists shared with you.
        </AppText>
        {Platform.OS === 'web' ? (
          <>
            <Button
              size="lg"
              onPress={() =>
                void Linking.openURL(createInstalledChecklistCollaboratorJoinUrl(code))
              }>
              Open onTrack
            </Button>
            <View style={styles.storeButtons}>
              <Button
                variant="secondary"
                icon="download"
                onPress={() => void Linking.openURL(APP_STORE_URL)}>
                Download for iPhone
              </Button>
              <Button
                variant="secondary"
                icon="download"
                onPress={() => void Linking.openURL(PLAY_STORE_URL)}>
                Download for Android
              </Button>
            </View>
          </>
        ) : null}
        <AppText variant="caption" color="tertiary" align="center">
          Already in the app? Sign in below and this invitation will stay with you.
        </AppText>
        <Button
          variant={Platform.OS === 'web' ? 'secondary' : 'primary'}
          disabled={Boolean(workingProvider)}
          onPress={() => void continueWithProvider('apple', `/c/${code}`)}>
          {workingProvider === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}
        </Button>
        <Button
          variant="secondary"
          disabled={Boolean(workingProvider)}
          onPress={() => void continueWithProvider('google', `/c/${code}`)}>
          {workingProvider === 'google' ? 'Opening Google…' : 'Continue with Google'}
        </Button>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.brand}>
        <AppText variant="overline" color="accent">onTrack To Do</AppText>
        <AppText variant="display">Join Checklists</AppText>
      </View>
      <Card style={styles.card}>
        {resolved ? (
          <>
            <AppText variant="heading">
              {resolved.listNames.length === 1
                ? resolved.listNames[0]
                : `${resolved.listNames.length} checklists`}
            </AppText>
            <AppText variant="body" color="secondary">
              {resolved.inviterName} is giving you collaborative access to:
            </AppText>
            <View style={styles.names}>
              {resolved.listNames.map((name) => (
                <View key={name} style={styles.nameRow}>
                  <Symbol name="check" size={16} />
                  <AppText variant="body">{name}</AppText>
                </View>
              ))}
            </View>
          </>
        ) : error ? (
          <ErrorMessage message={error} />
        ) : (
          <AppText variant="body" color="secondary">Loading invitation…</AppText>
        )}
      </Card>
      {resolved ? (
        <Button
          size="lg"
          disabled={joining}
          onPress={() => {
            setJoining(true);
            setError(undefined);
            void acceptChecklistCollaboratorLink(code)
              .then((listIds) => {
                const destination =
                  listIds.length === 1 ? `/(tabs)/to-do/${listIds[0]}` : '/(tabs)/to-do';
                router.replace(destination as never);
              })
              .catch((caught: unknown) => {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : 'The checklists could not be joined.',
                );
              })
              .finally(() => setJoining(false));
          }}>
          {joining ? 'Joining…' : 'Join Checklists'}
        </Button>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  page: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    gap: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  brand: { gap: spacing.sm },
  card: { gap: spacing.md },
  storeButtons: {
    width: '100%',
    gap: spacing.sm,
  },
  names: { gap: spacing.sm },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
