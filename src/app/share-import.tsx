import { useNavigation, useRouter } from 'expo-router';
import type { NavigationAction } from 'expo-router/react-navigation';
import {
    clearSharedPayloads,
    getSharedPayloads,
    type SharePayload,
} from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
    appPrompt,
    AppText,
    Button,
    Card,
    GlassIconWell,
    Input,
    Screen,
    Symbol,
} from '@/components/primitives';
import { layout, radii, spacing } from '@/design-system';
import { ezPassAssetsFromSharedPayloads } from '@/features/finance/ezpass-shared-statement';
import {
  hasIncomingSharePayloads,
  shouldConfirmShareDiscard,
} from '@/features/share-import/share-session';
import { useTheme } from '@/hooks/use-theme';
import { useChecklists } from '@/store/todos';

function isCalendarPayload(payload: SharePayload) {
  return (
    payload.mimeType?.toLocaleLowerCase() === 'text/calendar' ||
    /\.ics(?:$|[?#])/i.test(payload.value)
  );
}

function payloadDescription(payload: SharePayload) {
  if (payload.shareType === 'image') return 'Shared image';
  if (payload.shareType === 'url') return payload.value;
  if (payload.shareType === 'text') {
    return payload.value.replace(/\s+/g, ' ').slice(0, 180);
  }
  return payload.mimeType || 'Shared file';
}

export default function ShareImportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const lists = useChecklists((state) =>
    state.lists.filter(
      (list) => list.kind === 'grocery' && list.role === 'owner',
    ),
  );
  const createList = useChecklists((state) => state.createList);
  const [payloads] = useState(() => getSharedPayloads());
  const [mode, setMode] = useState<'destination' | 'recipe'>();
  const [newListName, setNewListName] = useState('Groceries');
  const allowLeave = useRef(!hasIncomingSharePayloads(payloads));
  const calendarOnly =
    payloads.length > 0 && payloads.every(isCalendarPayload);
  const ezPassOnly = ezPassAssetsFromSharedPayloads(payloads).length > 0;

  useEffect(() => {
    if (!hasIncomingSharePayloads(payloads)) {
      clearSharedPayloads();
      allowLeave.current = true;
      if (navigation.isFocused()) {
        appPrompt.dismiss();
        router.replace('/');
      }
      return;
    }
    if (!calendarOnly && !ezPassOnly) return;
    allowLeave.current = true;
    router.replace(
      ezPassOnly
        ? {
            pathname: '/(tabs)/finance/ezpass-import',
            params: { source: 'share' },
          } as never
        : '/share-event',
    );
  }, [calendarOnly, ezPassOnly, navigation, payloads, router]);

  const discard = useCallback(
    (action?: NavigationAction) => {
      clearSharedPayloads();
      allowLeave.current = true;
      if (action) navigation.dispatch(action);
      else router.replace('/(tabs)/calendar');
    },
    [navigation, router],
  );

  const confirmDiscard = useCallback(
    (action?: NavigationAction) => {
      appPrompt.alert(
        'Discard Shared Content?',
        'Nothing from this share will be saved.',
        [
          { text: 'Keep Choosing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => discard(action),
          },
        ],
      );
    },
    [discard],
  );

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!shouldConfirmShareDiscard(payloads, allowLeave.current)) return;
        event.preventDefault();
        confirmDiscard(event.data.action);
      }),
    [confirmDiscard, navigation, payloads],
  );

  const preview = useMemo(
    () => payloads.map(payloadDescription).join('\n').slice(0, 500),
    [payloads],
  );

  const openRecipe = (listId: string) => {
    allowLeave.current = true;
    router.push({
      pathname: '/(tabs)/to-do/[id]/recipe-import',
      params: { id: listId, source: 'share' },
    } as never);
  };

  if (!hasIncomingSharePayloads(payloads)) {
    return (
      <Screen contentStyle={styles.center} refresh={false}>
        <AppText variant="subheading">Closing Empty Share…</AppText>
      </Screen>
    );
  }

  if (calendarOnly || ezPassOnly) {
    return (
      <Screen contentStyle={styles.center} refresh={false}>
        <Symbol
          name={ezPassOnly ? 'finance' : 'calendar'}
          size={36}
          color={theme.accentPrimary}
        />
        <AppText variant="subheading">
          {ezPassOnly ? 'Opening E-ZPass Import…' : 'Opening Calendar…'}
        </AppText>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.screen} refresh={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="overline" color="accent">
            Incoming Share
          </AppText>
          <AppText variant="display">
            {mode === 'recipe' ? 'Choose a Grocery List' : 'What Are You Adding?'}
          </AppText>
          <AppText variant="body" color="secondary">
            The shared payload stays available until you save it or confirm
            discard.
          </AppText>
        </View>
        <Button variant="ghost" onPress={() => confirmDiscard()}>
          Discard
        </Button>
      </View>

      {preview ? (
        <Card variant="sunken" style={styles.preview}>
          <AppText variant="overline" color="tertiary">
            Shared Content
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={5}>
            {preview}
          </AppText>
        </Card>
      ) : null}

      {mode !== 'recipe' ? (
        <View style={styles.choices}>
          <Card
            onPress={() => setMode('recipe')}
            accessibilityLabel="Add shared content as a recipe"
            style={styles.choice}>
            <GlassIconWell size={48} borderRadius={radii.md}>
              <Symbol name="groceries" size={28} color={theme.accentPrimary} />
            </GlassIconWell>
            <View style={styles.flex}>
              <AppText variant="heading">Add Recipe</AppText>
              <AppText variant="body" color="secondary">
                Extract a meal and review its grocery ingredients.
              </AppText>
            </View>
            <Symbol name="chevron-right" size={20} color={theme.textTertiary} />
          </Card>
          <Card
            onPress={() => {
              allowLeave.current = true;
              router.push('/share-event');
            }}
            accessibilityLabel="Add shared content as a calendar event"
            style={styles.choice}>
            <GlassIconWell size={48} borderRadius={radii.md} variant="airy">
              <Symbol name="calendar-add" size={28} color={theme.textSecondary} />
            </GlassIconWell>
            <View style={styles.flex}>
              <AppText variant="heading">Add Calendar Event</AppText>
              <AppText variant="body" color="secondary">
                Read dates and times, then review calendar fields.
              </AppText>
            </View>
            <Symbol name="chevron-right" size={20} color={theme.textTertiary} />
          </Card>
        </View>
      ) : (
        <View style={styles.destinations}>
          {lists.map((list) => (
            <Card
              key={list.id}
              airy
              padded={false}
              onPress={() => openRecipe(list.id)}
              accessibilityLabel={list.name}
              style={[styles.listChoice, { borderColor: theme.separator }]}>
              <GlassIconWell size={40} borderRadius={radii.md}>
                <Symbol name="groceries" size={22} color={theme.accentPrimary} />
              </GlassIconWell>
              <AppText variant="subheading" style={styles.flex}>
                {list.name}
              </AppText>
              <Symbol name="chevron-right" size={19} color={theme.textTertiary} />
            </Card>
          ))}
          <Card style={styles.newList}>
            <AppText variant="subheading">Create a Grocery List</AppText>
            <Input
              label="List Name"
              value={newListName}
              maxLength={80}
              onChangeText={setNewListName}
            />
            <Button
              disabled={!newListName.trim()}
              onPress={() => {
                const list = createList(newListName, 'grocery');
                if (list) openRecipe(list.id);
              }}>
              Create and Continue
            </Button>
          </Card>
          <Button variant="ghost" onPress={() => setMode(undefined)}>
            Back
          </Button>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  preview: { gap: spacing.sm },
  choices: { gap: spacing.md },
  choice: {
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  choiceIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  destinations: { gap: spacing.md },
  listChoice: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
  },
  newList: { gap: spacing.md },
});
