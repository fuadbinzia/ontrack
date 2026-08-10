import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  appPrompt,
  Button,
  ErrorMessage,
  GlassPlate,
  GlassPrimaryAction,
  HeaderBackButton,
  Input,
  Screen,
  ScreenAtmosphere,
  screenAtmosphereBottomColor,
} from '@/components/primitives';
import { CategoryBadge } from '@/components/shared';
import { isCategoryEnabled } from '@/addons/registry';
import {
  glassFieldBackground,
  glassFieldBorder,
  radii,
  spacing,
} from '@/design-system';
import { usePendingImagePickerResult } from '@/hooks/use-pending-image-picker';
import { useTheme } from '@/hooks/use-theme';
import { analyzeMealPhoto, NutritionServiceError, persistMealPhoto } from '@/services/nutrition';
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
  FoodEditor,
  MovieEditor,
  WorkEditor,
  WorkoutEditor,
  cloneMeal,
  cloneMovie,
  cloneWorkSession,
  cloneWorkout,
} from '@/app/activity-form-editors';
import {
  ActivityFormPhotoCard,
  ActivityFormScheduleCard,
  activityFormGlassCardStyle,
} from '@/app/activity-form-sections';
import { pickLibraryImage } from '@/utils/pick-image';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { isDateKey, nowMinutes, todayKey } from '@/utils/date';
import { goBackOrReplace } from '@/utils/navigation';

const ASSISTANT_COPY: Record<string, { question: string; label: string; placeholder: string }> = {
  food: { question: 'What are we eating? Give me the delicious details. 🍴', label: 'Meal', placeholder: 'Breakfast, sushi night…' },
  gym: { question: 'What are we training today? Let’s get it on the books. 💪', label: 'Workout', placeholder: 'Leg day, morning run…' },
  work: { question: 'What are we getting done? Future you says thanks. ✨', label: 'Focus', placeholder: 'Deep work, team planning…' },
  sleep: { question: 'When are we heading to dreamland? 🌙', label: 'Sleep Plan', placeholder: 'Early night, power nap…' },
  water: { question: 'How are we staying hydrated? 💧', label: 'Hydration', placeholder: 'Morning water, refill bottle…' },
  personal: { question: 'What are we making time for?', label: 'Plan', placeholder: 'Call Mom, creative time…' },
  mindfulness: { question: 'How are we finding a little calm? 🌿', label: 'Practice', placeholder: 'Meditation, breathing break…' },
  learning: { question: 'What are we curious about today? 📚', label: 'Learning', placeholder: 'Spanish lesson, read chapter 3…' },
  appointment: { question: 'Who are we meeting, and what for?', label: 'Appointment', placeholder: 'Dentist, coffee with Alex…' },
  habit: { question: 'Which tiny win are we keeping alive? 🌟', label: 'Habit', placeholder: 'Stretch, journal…' },
};

export default function ActivityFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ date?: string; id?: string; category?: string }>();
  const editId = typeof params.id === 'string' ? params.id : undefined;
  const aiEnabled = usePreferences((state) => state.aiEnabled);
  const enabledAddons = useAddons((state) => state.enabled);

  const categories = useSchedule((state) => state.categories);
  const existing = useSchedule((state) => state.activities.find((activity) => activity.id === editId));
  const storedMeal = useSchedule((state) => state.meals.find((meal) => meal.activityId === editId));
  const storedWorkout = useSchedule((state) => state.workouts.find((workout) => workout.activityId === editId));
  const storedWorkSession = useSchedule((state) =>
    state.workSessions.find((session) => session.activityId === editId),
  );
  const storedMovie = useSchedule((state) => state.movies.find((movie) => movie.activityId === editId));
  const saveEvent = useSchedule((state) => state.saveEvent);
  const deleteActivity = useSchedule((state) => state.deleteActivity);

  const initialId = editId ?? 'draft';
  const initialDate = existing?.date ?? (typeof params.date === 'string' ? params.date : todayKey());
  const initialStartMinutes = existing?.startMinutes ?? nowMinutes();
  const [title, setTitle] = useState(existing?.title ?? '');
  const requestedCategory = typeof params.category === 'string' ? params.category : '';
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? requestedCategory);
  const [date, setDate] = useState(initialDate);
  const [startMinutes, setStartMinutes] = useState(initialStartMinutes);
  const [duration, setDuration] = useState(String(existing?.durationMinutes ?? 60));
  const status: ActivityStatus = existing?.status ?? 'upcoming';
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [photo, setPhoto] = useState<string | number | undefined>(existing?.photo);
  const [meal, setMeal] = useState(() => cloneMeal(storedMeal, initialId, existing?.title ?? ''));
  const [workout, setWorkout] = useState(() => cloneWorkout(storedWorkout, initialId, existing?.title ?? ''));
  const [workSession, setWorkSession] = useState(() => cloneWorkSession(storedWorkSession, initialId));
  const [movie, setMovie] = useState(() => cloneMovie(storedMovie, initialId));
  const [error, setError] = useState<string>();
  const [analysisError, setAnalysisError] = useState<string>();
  const [analyzing, setAnalyzing] = useState(false);
  const analysisRequestRef = useRef(0);

  const category = categories.find((item) => item.id === categoryId) ?? (editId ? categories[0] : undefined);
  const availableCategories = categories.filter((item) => isCategoryEnabled(item.id, enabledAddons));
  const isEditing = Boolean(editId && existing);
  const missingActivity = Boolean(editId && !existing);
  const allowLeave = useRef(false);
  const signature = JSON.stringify({
    title,
    categoryId,
    date,
    startMinutes,
    duration,
    notes,
    photo,
    meal,
    workout,
    workSession,
    movie,
  });
  const [initialSignature] = useState(signature);
  const dirty = signature !== initialSignature;

  const leave = () => {
    allowLeave.current = true;
    goBackOrReplace(router, '/(tabs)/calendar');
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
      return;
    }
    confirmDiscard(leave);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeave.current || !dirty) return;
      event.preventDefault();
      confirmDiscard(() => {
        allowLeave.current = true;
        navigation.dispatch(event.data.action);
      });
    });
    return unsubscribe;
  }, [dirty, navigation]);

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

  const save = () => {
    setError(undefined);
    if (!title.trim()) return setError('Title is required.');
    if (!isDateKey(date)) return setError('Choose a valid date.');
    const dateKey = date;
    if (!category) return setError('Choose an event type.');
    if (Number(duration) < 5 || !Number.isFinite(Number(duration))) {
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
            : existing?.summary;

    saveEvent({
      id: editId,
      detailKind: category.detailKind,
      activity: {
        date: dateKey,
        title: title.trim(),
        categoryId,
        startMinutes,
        durationMinutes: Number(duration),
        status,
        notes: notes.trim() || undefined,
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
    });
    allowLeave.current = true;
    close();
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

  // Opaque atmosphere floor so BlurView frost can't see through the
  // transparent modal card into the Today tab underneath (ghosting).
  const atmosphereFloor = screenAtmosphereBottomColor(theme.name);

  if (missingActivity) {
    return (
      <View style={[styles.root, { backgroundColor: atmosphereFloor }]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ScreenAtmosphere />
        </View>
        <Screen refresh={false}>
          <View style={styles.header}>
            <HeaderBackButton
              accessibilityLabel="Close"
              fallback="/(tabs)/calendar"
              onPress={leave}
              testID={AgentUiIds.activityForm.back}
            />
            <AppText variant="title" style={styles.headerTitle} fit>
              Event Not Found
            </AppText>
          </View>
          <AppText variant="body" color="secondary">This event may have been deleted.</AppText>
        </Screen>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: atmosphereFloor }]}>
      {/*
        Modal cards sit above AppSafeArea chrome — paint atmosphere locally so
        frosted plates/fields have chroma to blur (same idea as SheetScaffold).
      */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <ScreenAtmosphere />
      </View>
      <Screen contentStyle={styles.screen} refresh={false}>
        <View style={styles.header}>
          <HeaderBackButton
            accessibilityLabel="Close"
            fallback="/(tabs)/calendar"
            onPress={close}
            testID={AgentUiIds.activityForm.back}
          />
          <AppText variant="title" style={styles.headerTitle} fit>
            {isEditing ? editorTitle : 'Add Event'}
          </AppText>
        </View>

        {!isEditing ? (
          <View style={styles.assistant}>
            <View style={styles.assistantHeading}>
              <View style={[styles.assistantDot, { backgroundColor: theme.accentPrimary }]} />
              <AppText variant="overline" color="accent">onTrack assistant</AppText>
            </View>
            <AppText variant="title">
              What are we getting into?
            </AppText>
            <AppText variant="body" color="secondary">
              Pick a vibe and I’ll help with the rest.
            </AppText>
            <View style={styles.wrap}>
              {availableCategories.map((item) => {
                const selectCategory = () => {
                  setCategoryId(item.id);
                  setTitle('');
                  setMovie(undefined);
                  setError(undefined);
                };
                const selected = item.id === categoryId;
                return (
                  <AgentTestId
                    key={item.id}
                    testID={AgentUiIds.activityForm.category(item.id)}
                    label={item.name}
                    onPress={selectCategory}>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={selectCategory}>
                      <CategoryBadge category={item} selected={selected} size="large" />
                    </Pressable>
                  </AgentTestId>
                );
              })}
            </View>
            {category ? (
              <View style={[styles.followUp, { borderTopColor: theme.separator }]}>
                <AppText variant="bodyMedium">
                  {category.detailKind === 'movie'
                    ? 'Ooh, screen time. What are we watching? 🍿'
                    : ASSISTANT_COPY[category.id]?.question ?? 'What should we call it?'}
                </AppText>
                {category.detailKind === 'movie' ? (
                  <MovieEditor
                    movie={movie}
                    guided
                    onSelect={(selected) => {
                      setMovie({ ...selected, activityId: editId ?? savedDraftId });
                      setTitle(selected.title);
                      if (selected.runtimeMinutes) setDuration(String(selected.runtimeMinutes));
                    }}
                  />
                ) : (
                  <Input
                    key={category.id}
                    label={ASSISTANT_COPY[category.id]?.label ?? 'Event'}
                    value={title}
                    onChangeText={setTitle}
                    placeholder={ASSISTANT_COPY[category.id]?.placeholder ?? 'What’s happening?'}
                    autoFocus
                    returnKeyType="next"
                    fieldBackground={fieldFill}
                    fieldBorderColor={fieldBorder}
                    testID={AgentUiIds.activityForm.guidedTitle}
                  />
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {isEditing && category ? (
          <GlassPlate airy style={activityFormGlassCardStyle}>
            <CategoryBadge category={category} />
            <Input
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Event title"
              fieldBackground={fieldFill}
              fieldBorderColor={fieldBorder}
              testID={AgentUiIds.activityForm.title}
            />
          </GlassPlate>
        ) : null}

        {category ? (
        <>
        <ActivityFormScheduleCard
          date={date}
          onDateChange={setDate}
          duration={duration}
          onDurationChange={setDuration}
          startMinutes={startMinutes}
          onStartMinutesChange={setStartMinutes}
          notes={notes}
          onNotesChange={setNotes}
          fieldFill={fieldFill}
          fieldBorder={fieldBorder}
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

        {category?.detailKind === 'food' ? (
          <FoodEditor
            meal={meal}
            setMeal={setMeal}
            updateItem={updateFoodItem}
            addItem={addFoodItem}
            removeItem={(id) => setMeal((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }))}
          />
        ) : null}
        {category?.detailKind === 'gym' ? (
          <WorkoutEditor
            workout={workout}
            setWorkout={setWorkout}
            updateExercise={updateExercise}
            addExercise={addExercise}
            addSet={addSet}
            updateSet={updateSet}
            removeSet={removeSet}
          />
        ) : null}
        {category?.detailKind === 'work' ? (
          <WorkEditor session={workSession} setSession={setWorkSession} updateTask={updateTask} addTask={addTask} />
        ) : null}
        {isEditing && category?.detailKind === 'movie' ? (
          <MovieEditor
            movie={movie}
            onSelect={(selected) => {
              setMovie({ ...selected, activityId: editId ?? savedDraftId });
              setTitle(selected.title);
              if (selected.runtimeMinutes) setDuration(String(selected.runtimeMinutes));
            }}
          />
        ) : null}

        {error ? <ErrorMessage message={error} /> : null}
        <View style={styles.actions}>
          <GlassPrimaryAction
            label="Save"
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { flex: 1, minWidth: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.sm, paddingTop: spacing.md },
  assistant: { gap: spacing.md },
  assistantHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  assistantDot: { width: 8, height: 8, borderRadius: radii.pill },
  followUp: { gap: spacing.md, borderTopWidth: 1, paddingTop: spacing.lg, marginTop: spacing.xs },
});
