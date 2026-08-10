import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { activityFormStyles as styles } from './activity-form-styles';

import {
  AppText,
  appPrompt,
  Button,
  ErrorMessage,
  GlassPlate,
  GlassPrimaryAction,
  Input,
  Screen,
  ScreenAtmosphere,
  screenAtmosphereBottomColor,
  SheetGrabber,
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

import { ASSISTANT_COPY } from '@/app/activity-form-copy';
import { ActivityFormAssistantSection } from '@/app/activity-form-assistant';
import { ActivityFormMissingScreen } from '@/app/activity-form-missing';
import { ActivityFormDetailEditors } from '@/app/activity-form-detail-editors';

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
      <ActivityFormMissingScreen
        atmosphereFloor={atmosphereFloor}
        onLeave={leave}
      />
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
          <SheetGrabber
            testID={AgentUiIds.activityForm.grabber}
            onPress={close}
            accessibilityLabel="Dismiss"
          />
          <AppText variant="title" style={styles.headerTitle} fit>
            {isEditing ? editorTitle : 'Add Event'}
          </AppText>
        </View>

        <ActivityFormAssistantSection
          isEditing={isEditing}
          availableCategories={availableCategories}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          setTitle={setTitle}
          setMovie={setMovie}
          setError={setError}
          category={category}
          title={title}
          movie={movie as any}
          editId={editId}
          savedDraftId={savedDraftId}
          setDuration={setDuration}
          theme={theme}
          fieldFill={fieldFill}
          fieldBorder={fieldBorder}
        />

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
