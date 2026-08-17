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
import { createInstalledChecklistJoinUrl } from '@/features/todos/share';
import {
  acceptChecklistShareLink,
  resolveChecklistShareLink,
} from '@/services/todos/collaboration';

interface ResolvedList {
  listId: string;
  listName: string;
  ownerName: string;
}

const APP_STORE_URL = 'https://apps.apple.com/app/id6789723522';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.imtihoss.ontracknow';

export function ChecklistJoinScreen({ code }: { code: string }) {
  const router = useRouter();
  const { user, continueWithProvider, workingProvider } = useAuthSession();
  const validCode = /^[a-f0-9]{36}$/.test(code);
  const [resolved, setResolved] = useState<ResolvedList>();
  const [error, setError] = useState<string>();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!user || !validCode) return;
    let active = true;
    void resolveChecklistShareLink(code)
      .then((result) => {
        if (!active) return;
        if (result) setResolved(result);
        else setError('This list link is invalid or has been revoked.');
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'This list link could not be opened.');
        }
      });
    return () => {
      active = false;
    };
  }, [code, user, validCode]);

  if (!validCode) {
    return (
      <Screen contentStyle={styles.center}>
        <ErrorMessage message="This list link is invalid or incomplete." variant="heading" align="center" />
        <Button onPress={() => router.replace('/' as never)}>Go to onTrack</Button>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen contentStyle={styles.center}>
        <Symbol name="tasks" size={48} />
        <AppText variant="display" align="center">You’re invited 📝</AppText>
        <AppText variant="body" color="secondary" align="center">
          Sign in to onTrack to join this collaborative list. Your invitation will be waiting when you return.
        </AppText>
        <Button
          disabled={Boolean(workingProvider)}
          onPress={() => void continueWithProvider('apple', `/l/${code}`)}>
          {workingProvider === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}
        </Button>
        <Button
          variant="secondary"
          disabled={Boolean(workingProvider)}
          onPress={() => void continueWithProvider('google', `/l/${code}`)}>
          {workingProvider === 'google' ? 'Opening Google…' : 'Continue with Google'}
        </Button>
        {Platform.OS === 'web' ? (
          <>
            <Button
              size="lg"
              onPress={() => void Linking.openURL(createInstalledChecklistJoinUrl(code))}>
              Open onTrack
            </Button>
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
          </>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.brand}>
        <AppText variant="overline" color="accent">onTrack To Do</AppText>
        <AppText variant="display">Join the List</AppText>
      </View>
      <Card style={styles.card}>
        {resolved ? (
          <>
            <AppText variant="heading">{resolved.listName}</AppText>
            <AppText variant="body" color="secondary">
              Shared by {resolved.ownerName}. You’ll be able to complete items assigned to you or Anyone.
            </AppText>
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
            void acceptChecklistShareLink(code)
              .then((listId) => router.replace(`/(tabs)/to-do/${listId}` as never))
              .catch((caught: unknown) => {
                setError(caught instanceof Error ? caught.message : 'The list could not be joined.');
              })
              .finally(() => setJoining(false));
          }}>
          {joining ? 'Joining…' : 'Join List'}
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
});
