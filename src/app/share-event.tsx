import {
  clearSharedPayloads,
  getSharedPayloads,
} from 'expo-sharing';
import { useNavigation, useRouter } from 'expo-router';
import type { NavigationAction } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {
  AppText,
  appPrompt,
  Button,
  Card,
  DateField,
  ErrorMessage,
  GlassPlate,
  Input,
  Screen,
  SectionHeader,
  TimeField,
} from '@/components/primitives';
import { CategoryBadge } from '@/components/shared';
import { isCategoryEnabled } from '@/addons/registry';
import { layout, radii, spacing } from '@/design-system';
import { normalizeIncomingShare } from '@/features/calendar-import/incoming-share';
import type { SharedEventDraft } from '@/features/calendar-import/types';
import { useTheme } from '@/hooks/use-theme';
import { useAddons } from '@/store/addons';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useUI } from '@/store/ui';
import { isDateKey } from '@/utils/date';
import { userVisibleError } from '@/utils/operational-error';

function validDraft(draft: SharedEventDraft): boolean {
  return (
    Boolean(draft.title.trim()) &&
    isDateKey(draft.date) &&
    Number.isInteger(draft.startMinutes) &&
    draft.startMinutes !== null &&
    draft.startMinutes >= 0 &&
    draft.startMinutes <= 1439 &&
    Number.isFinite(draft.durationMinutes) &&
    draft.durationMinutes >= 5 &&
    Boolean(draft.categoryId)
  );
}

export default function ShareEventScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const dateLocale = usePreferences((state) => state.dateLocale);
  const enabledAddons = useAddons((state) => state.enabled);
  const categories = useSchedule((state) => state.categories);
  const importEvents = useSchedule((state) => state.importEvents);
  const setSelectedDate = useUI((state) => state.setSelectedDate);
  const [drafts, setDrafts] = useState<SharedEventDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [retryKey, setRetryKey] = useState(0);
  const allowLeave = useRef(false);

  const availableCategories = categories.filter(
    (category) =>
      category.detailKind !== 'movie' &&
      category.detailKind !== 'plant' &&
      isCategoryEnabled(category.id, enabledAddons),
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => getSharedPayloads())
      .then((payloads) =>
        normalizeIncomingShare(payloads, {
          locale: dateLocale,
          referenceDate: new Date(),
          defaultCategoryId: 'appointment',
        }),
      )
      .then((nextDrafts) => {
        if (active) setDrafts(nextDrafts);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'The shared event could not be read.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dateLocale, retryKey]);

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
        'Discard Shared Events?',
        'Nothing from this share will be added to your calendar.',
        [
          { text: 'Keep Reviewing', style: 'cancel' },
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

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (allowLeave.current) return;
      event.preventDefault();
      confirmDiscard(event.data.action);
    });
  }, [confirmDiscard, navigation]);

  const updateDraft = (id: string, patch: Partial<SharedEventDraft>) => {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== id) return draft;
        const warnings = draft.warnings.filter((warning) => {
          if ('date' in patch && patch.date && warning.startsWith('Choose a date')) return false;
          if (
            'startMinutes' in patch &&
            patch.startMinutes !== null &&
            warning.startsWith('Choose a time')
          ) {
            return false;
          }
          return true;
        });
        return { ...draft, ...patch, warnings };
      }),
    );
  };

  const save = () => {
    if (!drafts.length || !drafts.every(validDraft)) return;
    setSaving(true);
    setError(undefined);
    try {
      const imported = importEvents(
        drafts.map((draft) => {
          if (draft.startMinutes === null) {
            throw new Error('Every imported event needs a time.');
          }
          return {
            title: draft.title,
            date: draft.date,
            startMinutes: draft.startMinutes,
            durationMinutes: draft.durationMinutes,
            notes: draft.notes,
            categoryId: draft.categoryId,
          };
        }),
      );
      clearSharedPayloads();
      const earliestDate = imported.map((activity) => activity.date).sort()[0];
      if (earliestDate) setSelectedDate(earliestDate);
      allowLeave.current = true;
      router.replace('/(tabs)/calendar');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The events could not be saved.');
      setSaving(false);
    }
  };

  const allValid = drafts.length > 0 && drafts.every(validDraft);

  return (
    <Screen contentStyle={styles.screen} refresh={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="title">Review Shared Events</AppText>
          <AppText variant="body" color="secondary">
            Everything stays on this device until you save it.
          </AppText>
        </View>
        <Button variant="ghost" onPress={() => confirmDiscard()}>
          Cancel
        </Button>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accentPrimary} />
          <AppText variant="callout" color="secondary">
            Reading shared content…
          </AppText>
        </View>
      ) : null}

      {userVisibleError(error) ? (
        <View style={styles.errorBlock}>
          <ErrorMessage message={error} />
          <Button
            variant="secondary"
            onPress={() => {
              setLoading(true);
              setError(undefined);
              setDrafts([]);
              setRetryKey((value) => value + 1);
            }}>
            Try Again
          </Button>
        </View>
      ) : null}

      {!loading && !userVisibleError(error) ? (
        <>
          <SectionHeader
            title={`${drafts.length} ${drafts.length === 1 ? 'event' : 'events'} found`}
          />
          {drafts.map((draft, index) => (
            <Card
              key={draft.id}
              airy
              padded={false}
              style={[styles.eventCard, { borderColor: theme.separator }]}>
              <View style={styles.cardHeader}>
                <AppText variant="subheading">Event {index + 1}</AppText>
                <Button
                  variant="ghost"
                  onPress={() =>
                    setDrafts((current) => current.filter((item) => item.id !== draft.id))
                  }>
                  Remove
                </Button>
              </View>

              <Input
                label="Title"
                value={draft.title}
                onChangeText={(title) => updateDraft(draft.id, { title })}
                placeholder="Event title"
              />

              <View style={styles.twoColumns}>
                <View style={styles.flex}>
                  <DateField
                    label="Date"
                    value={draft.date}
                    onChange={(date) => updateDraft(draft.id, { date })}
                    accessibilityLabel={`Date for ${draft.title || `event ${index + 1}`}`}
                  />
                </View>
                <View style={styles.flex}>
                  <TimeField
                    label="Start Time"
                    value={draft.startMinutes}
                    onChange={(startMinutes) => updateDraft(draft.id, { startMinutes })}
                    accessibilityLabel={`Start Time for ${draft.title || `event ${index + 1}`}`}
                  />
                </View>
              </View>

              <Input
                label="Duration (min)"
                value={String(draft.durationMinutes)}
                onChangeText={(value) =>
                  updateDraft(draft.id, { durationMinutes: Number(value) })
                }
                keyboardType="number-pad"
              />

              <AppText variant="overline" color="tertiary">
                Category
              </AppText>
              <View style={styles.categoryWrap}>
                {availableCategories.map((category) => (
                  <Pressable
                    key={category.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: draft.categoryId === category.id }}
                    onPress={() => updateDraft(draft.id, { categoryId: category.id })}
                    style={[
                      styles.categoryChoice,
                      {
                        borderColor:
                          draft.categoryId === category.id
                            ? theme.accentPrimary
                            : theme.separator,
                      },
                    ]}>
                    <GlassPlate airy style={styles.categoryChoicePlate}>
                      <CategoryBadge category={category} />
                    </GlassPlate>
                  </Pressable>
                ))}
              </View>

              <Input
                label="Notes"
                value={draft.notes}
                onChangeText={(notes) => updateDraft(draft.id, { notes })}
                placeholder="Shared context"
                multiline
                style={styles.notes}
              />

              {draft.warnings.map((warning) => (
                <AppText key={warning} variant="caption" color="secondary">
                  {warning}
                </AppText>
              ))}
              {!draft.title.trim() ? (
                <AppText variant="caption" color="secondary">
                  Add a title before saving.
                </AppText>
              ) : null}
            </Card>
          ))}

          {drafts.length === 0 ? (
            <ErrorMessage message="Keep at least one event in the import." />
          ) : !allValid ? (
            <ErrorMessage message="Choose a title, date, time, duration, and category for every event." />
          ) : null}

          <Button
            size="lg"
            disabled={!allValid || saving}
            onPress={save}
            accessibilityLabel={`Save ${drafts.length} shared ${drafts.length === 1 ? 'event' : 'events'}`}>
            {saving
              ? 'Saving…'
              : `Save ${drafts.length} ${drafts.length === 1 ? 'event' : 'events'}`}
          </Button>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  centered: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorBlock: {
    gap: spacing.md,
  },
  eventCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  twoColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChoice: {
    borderWidth: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  categoryChoicePlate: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  notes: {
    minHeight: 96,
  },
});
