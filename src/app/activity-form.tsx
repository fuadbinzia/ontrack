import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { activityFormStyles as styles } from './activity-form-styles';

import {
  appPrompt,
  Button,
  ErrorMessage,
  GlassPrimaryAction,
  Screen,
  SheetScaffold,
} from '@/components/primitives';
import { isCategoryEnabled } from '@/addons/registry';
import { mergeDefaultCategories } from '@/constants/categories';
import { glassFieldBackground, glassFieldBorder } from '@/design-system';
import { usePendingImagePickerResult } from '@/hooks/use-pending-image-picker';
import { useTheme } from '@/hooks/use-theme';
import { analyzeMealPhoto, NutritionServiceError, persistMealPhoto } from '@/services/nutrition';
import {
  formatCalendarAttendeeEmails,
  parseCalendarAttendeeEmails,
} from '@/services/calendar/calendar-invitations';
import { asEventBroadcasts, type EventDetails } from '@/services/events';
import { usePreferences } from '@/store/preferences';
import { useAddons } from '@/store/addons';
import { newId, useSchedule } from '@/store/schedule';
import type {
  ActivityStatus,
  FoodItem,
  WorkoutExercise,
  WorkoutSet,
  WorkTask,
} from '@/types/models';
import {
  cloneMeal,
  cloneMovie,
  cloneWorkSession,
  cloneWorkout,
} from '@/app/activity-form-editors';
import {
  ActivityFormPhotoCard,
  ActivityFormScheduleCard,
} from '@/app/activity-form-sections';
import { pickLibraryImage } from '@/utils/pick-image';
import { AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { isAllDayActivity } from '@/utils/activity-time';
import { isDateKey, nowMinutes, todayKey } from '@/utils/date';
import { durationPartsToMinutes, splitDurationMinutes } from '@/utils/duration';
import { goBackOrReplace } from '@/utils/navigation';

import { ActivityFormAssistantSection } from '@/app/activity-form-assistant';
import { hasUnsavedActivityChanges } from '@/utils/activity-form-dirty';
import { ActivityFormMissingScreen } from '@/app/activity-form-missing';
import { ActivityFormDetailEditors } from '@/app/activity-form-detail-editors';

export default function ActivityFormScreen() {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; id?: string; category?: string }>();
  const editId = typeof params.id === 'string' ? params.id : undefined;
  const aiEnabled = usePreferences((state) => state.aiEnabled);
  const enabledAddons = useAddons((state) => state.enabled);

  const storedCategories = useSchedule((state) => state.categories);
  const categories = mergeDefaultCategories(storedCategories);
  const existing = useSchedule((state) => state.activities.find((activity) => activity.id === editId));
  const storedMeal = useSchedule((state) => state.meals.find((meal) => meal.activityId === editId));
  const storedWorkout = useSchedule((state) => state.workouts.find((workout) => workout.activityId === editId));
  const storedWorkSession = useSchedule((state) =>
    state.workSessions.find((session) => session.activityId === editId),
  );
  const storedMovie = useSchedule((state) => state.movies.find((movie) => movie.activityId === editId));
  const storedEventDetails = useSchedule((state) => state.eventDetails.find((event) => event.activityId === editId));
  const saveEvent = useSchedule((state) => state.saveEvent);
  const deleteActivity = useSchedule((state) => state.deleteActivity);

  const initialId = editId ?? 'draft';
  const initialDate = existing?.date ?? (typeof params.date === 'string' ? params.date : todayKey());
  const initialStartMinutes = existing?.startMinutes ?? nowMinutes();
  const [allDay, setAllDay] = useState(existing ? isAllDayActivity(existing) : false);
  const [title, setTitle] = useState(existing?.title ?? '');
  const requestedCategory = typeof params.category === 'string' ? params.category : '';
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? requestedCategory);
  const [date, setDate] = useState(initialDate);
  const [startMinutes, setStartMinutes] = useState(initialStartMinutes);
  const initialDuration = splitDurationMinutes(existing?.durationMinutes ?? 60);
  const [durationHours, setDurationHours] = useState(String(initialDuration.hours));
  const [durationMinutes, setDurationMinutes] = useState(String(initialDuration.minutes));
  const status: ActivityStatus = existing?.status ?? 'upcoming';
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [attendeeEmails, setAttendeeEmails] = useState(
    formatCalendarAttendeeEmails(existing?.attendeeEmails),
  );
  const [photo, setPhoto] = useState<string | number | undefined>(existing?.photo);
  const [meal, setMeal] = useState(() => cloneMeal(storedMeal, initialId, existing?.title ?? ''));
  const [workout, setWorkout] = useState(() => cloneWorkout(storedWorkout, initialId, existing?.title ?? ''));
  const [workSession, setWorkSession] = useState(() => cloneWorkSession(storedWorkSession, initialId));
  const [movie, setMovie] = useState(() => cloneMovie(storedMovie, initialId));
  const [eventDetails, setEventDetails] = useState<EventDetails | undefined>(() =>
    storedEventDetails ? { ...storedEventDetails, activityId: initialId } : undefined,
  );
  const [error, setError] = useState<string>();
  const [analysisError, setAnalysisError] = useState<string>();
  const [analyzing, setAnalyzing] = useState(false);
  const analysisRequestRef = useRef(0);

  const category = categories.find((item) => item.id === categoryId) ?? (editId ? categories[0] : undefined);
  const availableCategories = categories.filter((item) =>
    isCategoryEnabled(item.id, enabledAddons),
  );
  const isEditing = Boolean(editId && existing);
  const isRecurringSeries = Boolean(
    existing?.googleCalendar?.recurringEventId || existing?.recurrence?.seriesId,
  );
  const missingActivity = Boolean(editId && !existing);
  const allowLeave = useRef(false);
  const formSnapshot = {
    title,
    categoryId,
    date,
    startMinutes,
    allDay,
    durationHours,
    durationMinutes,
    notes,
    attendeeEmails,
    photo,
    meal,
    workout,
    workSession,
    movie,
    eventDetails,
  };
  const [initialFormSnapshot] = useState(formSnapshot);
  const dirty = hasUnsavedActivityChanges(
    initialFormSnapshot,
    formSnapshot,
    isEditing,
  );

  const leave = () => {
    allowLeave.current = true;
    goBackOrReplace(router, '/');
  };
  const leaveAfterSave = (reviewInvitation: boolean, reviewActivityId?: string) => {
    allowLeave.current = true;
    if (reviewInvitation) {
      // Close the root transparent-modal route first. A single pop-to aimed at
      // Tabs can reveal an underlying event-detail modal without completing
      // the nested Profile navigation when this editor was opened from detail.
      if (router.canDismiss()) router.dismiss();
      requestAnimationFrame(() => {
        router.navigate({
          pathname: '/(tabs)/profile/calendar-sync',
          params: reviewActivityId ? { reviewActivityId } : undefined,
        });
      });
      return;
    }
    goBackOrReplace(router, '/');
  };
  const confirmDiscard = (onDiscard: () => void) => {
    appPrompt.alert('Discard Changes?', 'Your unsaved changes will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onDiscard },
    ]);
  };
  const close = () => {
    if (allowLeave.current || !dirty) {
      leave();
      return true;
    }
    confirmDiscard(leave);
    return false;
  };

  const selectMealPhoto = async (uri: string) => {
    try {
      const durableUri = await persistMealPhoto(uri, `${initialId}-original`);
      setPhoto(durableUri);
      setMeal((current) => ({
        ...current,
        photo: durableUri,
        originalPhoto: undefined,
        photoProcessingVersion: undefined,
        aiAnalysis: undefined,
      }));
      return durableUri;
    } catch {
      setAnalysisError('The selected photo could not be saved. Please choose it again.');
      return undefined;
    }
  };

  // Android may destroy this screen while the system picker is open;
  // recover the selection when the screen is recreated.
  usePendingImagePickerResult((uri) => {
    void selectMealPhoto(uri);
  });

  const pickPhoto = async (analyzeAfterPick = false) => {
    setError(undefined);
    setAnalysisError(undefined);
    const selectedUri = await pickLibraryImage({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
      onDenied: () =>
        setAnalysisError('Photo library access is required to upload a meal image.'),
    });
    if (!selectedUri) return;
    const durableUri = await selectMealPhoto(selectedUri);
    if (analyzeAfterPick && durableUri) await analyzePhoto(durableUri);
  };

  const analyzePhoto = async (selectedPhoto?: string) => {
    const photoUri = selectedPhoto ?? (typeof photo === 'string' ? photo : undefined);
    if (!photoUri) return;
    const requestId = ++analysisRequestRef.current;
    setAnalyzing(true);
    setAnalysisError(undefined);
    try {
      const { analysis, processedPhotoUri, photoProcessingVersion } = await analyzeMealPhoto(photoUri, title);
      if (requestId !== analysisRequestRef.current) return;
      const displayPhoto = processedPhotoUri ?? photoUri;
      setPhoto(displayPhoto);
      setMeal((current) => ({
        ...current,
        name: current.name || title,
        photo: displayPhoto,
        originalPhoto: processedPhotoUri ? photoUri : undefined,
        photoProcessingVersion,
        aiAnalysis: analysis,
        items: analysis.items,
      }));
    } catch (caught) {
      if (requestId !== analysisRequestRef.current) return;
      setAnalysisError(caught instanceof NutritionServiceError ? caught.message : 'Meal analysis failed. You can try again or enter the foods manually.');
    } finally {
      if (requestId === analysisRequestRef.current) setAnalyzing(false);
    }
  };

  const addFoodItem = () =>
    setMeal((current) => ({
      ...current,
      items: [
        ...current.items,
        { id: newId('food'), name: '', portion: '', calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      ],
    }));

  const updateFoodItem = (id: string, patch: Partial<FoodItem>) =>
    setMeal((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));

  const addExercise = () =>
    setWorkout((current) => ({
      ...current,
      exercises: [
        ...current.exercises,
        { id: newId('exercise'), name: '', icon: 'exercise-strength', sets: [], restSeconds: 60 },
      ],
    }));

  const updateExercise = (id: string, patch: Partial<WorkoutExercise>) =>
    setWorkout((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === id ? { ...exercise, ...patch } : exercise,
      ),
    }));

  const addSet = (exerciseId: string) => {
    const set: WorkoutSet = { id: newId('set'), reps: 10, weightKg: 0, done: false };
    setWorkout((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, sets: [...exercise.sets, set] } : exercise,
      ),
    }));
  };

  const updateSet = (exerciseId: string, setId: string, patch: Partial<WorkoutSet>) =>
    setWorkout((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)) }
          : exercise,
      ),
    }));

  const removeSet = (exerciseId: string, setId: string) =>
    setWorkout((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
          : exercise,
      ),
    }));

  const addTask = () =>
    setWorkSession((current) => ({
      ...current,
      tasks: [...current.tasks, { id: newId('task'), title: '', done: false, priority: 'medium' }],
    }));

  const updateTask = (id: string, patch: Partial<WorkTask>) =>
    setWorkSession((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    }));

  const setDuration = (totalMinutes: string | number) => {
    const next = splitDurationMinutes(Number(totalMinutes));
    setDurationHours(String(next.hours));
    setDurationMinutes(String(next.minutes));
  };

  const save = () => {
    setError(undefined);
    if (!title.trim()) return setError('Title is required.');
    if (!isDateKey(date)) return setError('Choose a valid date.');
    const dateKey = date;
    if (!category) return setError('Choose an event type.');
    const totalDurationMinutes = durationPartsToMinutes(durationHours, durationMinutes);
    if (!Number.isFinite(totalDurationMinutes)) {
      return setError('Enter hours and mins; mins must be between 0 and 59.');
    }
    if (totalDurationMinutes < 5) {
      return setError('Duration must be at least 5 minutes.');
    }
    if (category.detailKind === 'food' && meal.items.some((item) => !item.name.trim())) {
      return setError('Every food item needs a name.');
    }
    if (category.detailKind === 'gym' && workout.exercises.some((item) => !item.name.trim())) {
      return setError('Every exercise needs a name.');
    }
    if (category.detailKind === 'work' && workSession.tasks.some((item) => !item.title.trim())) {
      return setError('Every task needs a title.');
    }
    if (category.detailKind === 'movie' && !movie) return setError('Search for and select a movie.');
    const parsedAttendees = parseCalendarAttendeeEmails(attendeeEmails);
    if (parsedAttendees.invalid.length) {
      return setError(`Check these guest emails: ${parsedAttendees.invalid.join(', ')}`);
    }

    const totalCalories = meal.items.reduce((sum, item) => sum + item.calories, 0);
    const summary =
      category.detailKind === 'food'
        ? `${totalCalories} kcal · ${meal.items.length} item${meal.items.length === 1 ? '' : 's'}`
        : category.detailKind === 'gym'
          ? `${title.trim()} · ${workout.exercises.length} exercise${workout.exercises.length === 1 ? '' : 's'}`
          : category.detailKind === 'work'
            ? `${workSession.tasks.length} task${workSession.tasks.length === 1 ? '' : 's'}`
            : category.detailKind === 'movie' && movie
              ? [movie.mediaType === 'tv' ? 'TV' : 'Movie', movie.releaseDate?.slice(0, 4), movie.runtimeMinutes ? `${movie.runtimeMinutes} min` : undefined]
                  .filter(Boolean)
                  .join(' · ')
            : category.detailKind === 'event' && eventDetails
              ? [
                  eventDetails.venue?.name,
                  asEventBroadcasts(eventDetails.broadcasts).map((item) => item.name).join(', ') || undefined,
                ].filter(Boolean).join(' · ')
            : existing?.summary;

    const payload = {
      id: editId,
      detailKind: category.detailKind,
      activity: {
        date: dateKey,
        allDay: allDay || undefined,
        title: title.trim(),
        categoryId,
        startMinutes,
        durationMinutes: totalDurationMinutes,
        status,
        notes: notes.trim() || undefined,
        attendeeEmails: parsedAttendees.emails,
        photo: category.supportsPhotos ? photo : undefined,
        photoProcessingVersion: category.detailKind === 'food' ? meal.photoProcessingVersion : undefined,
        summary,
      },
      meal:
        category.detailKind === 'food'
          ? { ...meal, activityId: editId ?? savedDraftId, name: title.trim(), photo }
          : undefined,
      workout:
        category.detailKind === 'gym'
          ? { ...workout, activityId: editId ?? savedDraftId, name: title.trim() }
          : undefined,
      workSession:
        category.detailKind === 'work' ? { ...workSession, activityId: editId ?? savedDraftId } : undefined,
      movie:
        category.detailKind === 'movie' && movie
          ? { ...movie, activityId: editId ?? savedDraftId }
          : undefined,
      event:
        category.detailKind === 'event' && eventDetails
          ? { ...eventDetails, activityId: editId ?? savedDraftId }
          : undefined,
    } as const;

    const commitSave = (editScope: 'single' | 'series') => {
      const savedActivity = saveEvent({ ...payload, editScope });
      leaveAfterSave(parsedAttendees.emails.length > 0, savedActivity.id);
    };

    if (isRecurringSeries) {
      appPrompt.alert(
        'Update Recurring Event?',
        'Apply these changes to only this event or every event in the series?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'This Event',
            style: 'secondary',
            testID: AgentUiIds.activityForm.saveThisOccurrence,
            onPress: () => commitSave('single'),
          },
          {
            text: 'All Events',
            style: 'primary',
            testID: AgentUiIds.activityForm.saveSeries,
            onPress: () => commitSave('series'),
          },
        ],
      );
      return;
    }

    commitSave('single');
  };

  const savedDraftId = initialId;

  const editorTitle =
    category?.detailKind === 'food'
      ? 'Edit Meal'
      : category?.detailKind === 'gym'
        ? 'Edit Workout'
        : category?.detailKind === 'work'
          ? 'Edit Work Session'
          : category?.detailKind === 'movie'
            ? 'Edit Movie'
          : 'Edit Event';

  const confirmDelete = () => {
    if (!editId || !existing) return;
    confirmDestructiveAction({
      title: 'Delete Event',
      message: `Remove “${existing.title}” from your schedule?`,
      onConfirm: () => {
        deleteActivity(editId);
        allowLeave.current = true;
        close();
      },
    });
  };

  const fieldFill = glassFieldBackground(theme.name);
  const fieldBorder = glassFieldBorder(theme.name);

  if (missingActivity) {
    return (
      <ActivityFormMissingScreen
        atmosphereFloor={theme.backgroundPrimary}
        onLeave={leave}
      />
    );
  }

  return (
    <SheetScaffold
      visible
      host="route"
      title={isEditing ? editorTitle : 'Add Event'}
      onClose={close}
      closeAccessibilityLabel="Dismiss event form"
      closeTestID={AgentUiIds.activityForm.grabber}
      backdropTestID={AgentUiIds.activityForm.backdrop}
      bodyScrollMode="external"
      maxHeight={Math.round(windowHeight * 0.9)}
      surface="glass">
      <Screen
        atmosphere={false}
        bottomInset={false}
        padded={false}
        style={styles.sheetScreen}
        contentStyle={styles.screen}
        refresh={false}>
        <ActivityFormAssistantSection
          isEditing={isEditing}
          availableCategories={availableCategories}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          setTitle={setTitle}
          setMovie={setMovie}
          setEventDetails={setEventDetails}
          setError={setError}
          category={category}
          title={title}
          movie={movie as any}
          editId={editId}
          savedDraftId={savedDraftId}
          setDuration={setDuration}
          setDate={setDate}
          setStartMinutes={setStartMinutes}
          setAllDay={setAllDay}
          setNotes={setNotes}
          eventDetails={eventDetails}
          theme={theme}
          fieldFill={fieldFill}
          fieldBorder={fieldBorder}
        />

        {category ? (
        <>
        <ActivityFormScheduleCard
          date={date}
          onDateChange={setDate}
          allDay={allDay}
          durationHours={durationHours}
          onDurationHoursChange={setDurationHours}
          durationMinutes={durationMinutes}
          onDurationMinutesChange={setDurationMinutes}
          startMinutes={startMinutes}
          onStartMinutesChange={setStartMinutes}
          notes={notes}
          onNotesChange={setNotes}
          attendeeEmails={attendeeEmails}
          onAttendeeEmailsChange={setAttendeeEmails}
        />

        {category.supportsPhotos ? (
          <ActivityFormPhotoCard
            kind={category.detailKind === 'food' ? 'food' : 'generic'}
            photo={photo}
            meal={meal}
            analyzing={analyzing}
            aiEnabled={aiEnabled}
            analysisError={analysisError}
            onPickPhoto={(analyzeAfterPick) => void pickPhoto(analyzeAfterPick)}
            onAnalyze={() => void analyzePhoto()}
            onRemovePhoto={() => {
              setPhoto(undefined);
              setAnalysisError(undefined);
              setMeal((current) => ({
                ...current,
                photo: undefined,
                originalPhoto: undefined,
                photoProcessingVersion: undefined,
                aiAnalysis: undefined,
              }));
            }}
          />
        ) : null}

        <ActivityFormDetailEditors
          categoryDetailKind={category?.detailKind}
          isEditing={isEditing}
          meal={meal}
          setMeal={setMeal}
          updateFoodItem={updateFoodItem}
          addFoodItem={addFoodItem}
          workout={workout}
          setWorkout={setWorkout}
          updateExercise={updateExercise}
          addExercise={addExercise}
          addSet={addSet}
          updateSet={updateSet}
          removeSet={removeSet}
          workSession={workSession}
          setWorkSession={setWorkSession}
          updateTask={updateTask}
          addTask={addTask}
          movie={movie as any}
          setMovie={setMovie}
          setTitle={setTitle}
          setDuration={setDuration}
          editId={editId}
          savedDraftId={savedDraftId}
        />
        {error ? <ErrorMessage message={error} /> : null}
        <View style={styles.actions}>
          <GlassPrimaryAction
            label={attendeeEmails.trim() ? 'Save & Review Invite' : 'Save'}
            onPress={save}
            disabled={!title.trim()}
            testID={AgentUiIds.activityForm.save}
          />
          <Button
            variant="ghost"
            onPress={close}
            accessibilityLabel="Cancel"
            testID={AgentUiIds.activityForm.cancel}>
            Cancel
          </Button>
          {isEditing ? (
            <Button
              variant="danger"
              onPress={confirmDelete}
              accessibilityLabel="Delete event"
              testID={AgentUiIds.activityForm.delete}>
              Delete Event
            </Button>
          ) : null}
        </View>
        </>
        ) : null}
      </Screen>
    </SheetScaffold>
  );
}
