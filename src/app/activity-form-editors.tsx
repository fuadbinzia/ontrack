import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, ErrorMessage, GlassPlate, IconButton, Input, LoadingBlock, SectionHeader, SegmentedControl } from '@/components/primitives';
import { userVisibleError } from '@/utils/operational-error';
import { radii, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import {
  deviceWorkoutWeightUnit,
  workoutWeightInputValue,
  workoutWeightLabel,
  workoutWeightToKilograms,
} from '@/features/workouts/weight-unit';
import { getMovieDetails, searchMovies, type MovieSearchResult } from '@/services/movies';
import type {
  FoodItem,
  Meal,
  MealType,
  Movie,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutType,
  WorkSession,
  WorkTask,
} from '@/types/models';
import { AgentUiIds } from '@/utils/agent-ui';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'pre-workout', 'post-workout'];
const WORKOUT_TYPES: WorkoutType[] = ['strength', 'cardio', 'mobility', 'custom'];
const PRIORITIES: WorkTask['priority'][] = ['low', 'medium', 'high'];

export function numberValue(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function cloneMeal(meal: Meal | undefined, activityId: string, title: string): Meal {
  return meal
    ? { ...meal, items: meal.items.map((item) => ({ ...item })) }
    : { activityId, mealType: 'lunch', name: title, items: [] };
}

export function cloneWorkout(workout: Workout | undefined, activityId: string, title: string): Workout {
  return workout
    ? {
        ...workout,
        exercises: workout.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) => ({ ...set })),
        })),
      }
    : { activityId, type: 'custom', name: title, exercises: [] };
}

export function cloneWorkSession(session: WorkSession | undefined, activityId: string): WorkSession {
  return session
    ? { ...session, tasks: session.tasks.map((task) => ({ ...task })) }
    : { activityId, tasks: [], focusMinutes: 0 };
}

export function cloneMovie(movie: Movie | undefined, activityId: string): Movie | undefined {
  return movie ? { ...movie, activityId, genres: [...movie.genres] } : undefined;
}

export function ChoiceRow<T extends string>({ label, options, value, onChange }: { label: string; options: T[]; value: T; onChange: (value: T) => void }) {
  const group = label.toLowerCase().replaceAll(' ', '-');
  return (
    <SegmentedControl
      label={label}
      value={value}
      options={options.map((option) => ({
        value: option,
        label: option.replace('-', ' '),
        testID: AgentUiIds.activityForm.choice(group, option),
      }))}
      onChange={onChange}
      wrap
    />
  );
}

export function FoodEditor({ meal, setMeal, updateItem, addItem, removeItem }: { meal: Meal; setMeal: React.Dispatch<React.SetStateAction<Meal>>; updateItem: (id: string, patch: Partial<FoodItem>) => void; addItem: () => void; removeItem: (id: string) => void }) {
  return (
    <View>
      <SectionHeader title="Meal Details" />
      <ChoiceRow label="Meal Type" options={MEAL_TYPES} value={meal.mealType} onChange={(mealType) => setMeal((current) => ({ ...current, mealType }))} />
      <View style={styles.twoColumns}>
        <View style={styles.flex}><Input label="Hunger Before (1–5)" value={meal.hungerBefore === undefined ? '' : String(meal.hungerBefore)} onChangeText={(value) => setMeal((current) => ({ ...current, hungerBefore: value ? Math.min(5, numberValue(value)) : undefined }))} keyboardType="number-pad" /></View>
        <View style={styles.flex}><Input label="Fullness After (1–5)" value={meal.fullnessAfter === undefined ? '' : String(meal.fullnessAfter)} onChangeText={(value) => setMeal((current) => ({ ...current, fullnessAfter: value ? Math.min(5, numberValue(value)) : undefined }))} keyboardType="number-pad" /></View>
      </View>
      <SectionHeader title="Food Items" actionLabel="Add Item" onAction={addItem} />
      {meal.items.map((item) => (
        <View key={item.id} style={styles.nestedCard}>
          <Input label="Item" value={item.name} onChangeText={(name) => updateItem(item.id, { name })} placeholder="Food item" />
          <Input label="Portion" value={item.portion} onChangeText={(portion) => updateItem(item.id, { portion })} placeholder="1 cup" />
          <View style={styles.metricGrid}>
            {(['calories', 'proteinG', 'carbsG', 'fatG'] as const).map((field) => (
              <View key={field} style={styles.metricInput}><Input label={field === 'calories' ? 'Calories' : field.replace('G', ' (g)')} value={String(item[field])} onChangeText={(value) => updateItem(item.id, { [field]: numberValue(value) })} keyboardType="decimal-pad" /></View>
            ))}
          </View>
          <Button variant="ghost" onPress={() => removeItem(item.id)} accessibilityLabel={`Remove ${item.name || 'food item'}`}>Remove Item</Button>
        </View>
      ))}
    </View>
  );
}

export function WorkoutEditor({ workout, setWorkout, updateExercise, addExercise, addSet, updateSet, removeSet }: { workout: Workout; setWorkout: React.Dispatch<React.SetStateAction<Workout>>; updateExercise: (id: string, patch: Partial<WorkoutExercise>) => void; addExercise: () => void; addSet: (id: string) => void; updateSet: (exerciseId: string, setId: string, patch: Partial<WorkoutSet>) => void; removeSet: (exerciseId: string, setId: string) => void }) {
  const weightUnit = deviceWorkoutWeightUnit();
  const weightLabel = workoutWeightLabel(weightUnit);
  return (
    <View>
      <SectionHeader title="Workout Details" />
      <ChoiceRow label="Workout Type" options={WORKOUT_TYPES} value={workout.type} onChange={(type) => setWorkout((current) => ({ ...current, type }))} />
      <SectionHeader title="Exercises" actionLabel="Add Exercise" onAction={addExercise} />
      {workout.exercises.map((exercise) => (
        <View key={exercise.id} style={styles.nestedCard}>
          <Input label="Exercise" value={exercise.name} onChangeText={(name) => updateExercise(exercise.id, { name })} placeholder="Exercise name" />
          <Input label="Rest (seconds)" value={String(exercise.restSeconds)} onChangeText={(value) => updateExercise(exercise.id, { restSeconds: numberValue(value) })} keyboardType="number-pad" />
          <Input label="Exercise Notes" value={exercise.note ?? ''} onChangeText={(note) => updateExercise(exercise.id, { note })} />
          {exercise.sets.map((set, index) => (
            <View key={set.id} style={styles.setRow}>
              <AppText variant="caption">Set {index + 1}</AppText>
              <View style={styles.setInput}><Input label="Reps" value={String(set.reps)} onChangeText={(value) => updateSet(exercise.id, set.id, { reps: numberValue(value) })} keyboardType="number-pad" /></View>
              <View style={styles.setInput}><Input label={weightLabel} value={workoutWeightInputValue(set.weightKg, weightUnit)} onChangeText={(value) => updateSet(exercise.id, set.id, { weightKg: workoutWeightToKilograms(numberValue(value), weightUnit) })} keyboardType="decimal-pad" /></View>
              <IconButton icon="delete" accessibilityLabel={`Remove set ${index + 1}`} onPress={() => removeSet(exercise.id, set.id)} />
            </View>
          ))}
          <Button variant="secondary" onPress={() => addSet(exercise.id)} accessibilityLabel={`Add Set to ${exercise.name || 'exercise'}`}>Add Set</Button>
          <Button variant="ghost" onPress={() => setWorkout((current) => ({ ...current, exercises: current.exercises.filter((item) => item.id !== exercise.id) }))} accessibilityLabel={`Remove ${exercise.name || 'exercise'}`}>Remove Exercise</Button>
        </View>
      ))}
    </View>
  );
}

export function WorkEditor({ session, setSession, updateTask, addTask }: { session: WorkSession; setSession: React.Dispatch<React.SetStateAction<WorkSession>>; updateTask: (id: string, patch: Partial<WorkTask>) => void; addTask: () => void }) {
  return (
    <View>
      <SectionHeader title="Work Session" />
      <Input label="Focus Minutes" value={String(session.focusMinutes)} onChangeText={(value) => setSession((current) => ({ ...current, focusMinutes: numberValue(value) }))} keyboardType="number-pad" />
      <SectionHeader title="Tasks" actionLabel="Add Task" onAction={addTask} />
      {session.tasks.map((task) => (
        <View key={task.id} style={styles.nestedCard}>
          <Input label="Task" value={task.title} onChangeText={(title) => updateTask(task.id, { title })} placeholder="Task title" />
          <ChoiceRow label="Priority" options={PRIORITIES} value={task.priority} onChange={(priority) => updateTask(task.id, { priority })} />
          <Input label="Estimate (minutes)" value={task.estimateMinutes === undefined ? '' : String(task.estimateMinutes)} onChangeText={(value) => updateTask(task.id, { estimateMinutes: value ? numberValue(value) : undefined })} keyboardType="number-pad" />
          <Button variant={task.done ? 'secondary' : 'ghost'} onPress={() => updateTask(task.id, { done: !task.done })} accessibilityLabel={`${task.done ? 'Mark incomplete' : 'Mark complete'} ${task.title || 'task'}`}>{task.done ? 'Completed' : 'Mark Complete'}</Button>
          <Button variant="ghost" onPress={() => setSession((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== task.id) }))} accessibilityLabel={`Remove ${task.title || 'task'}`}>Remove Task</Button>
        </View>
      ))}
    </View>
  );
}

export function MovieEditor({ movie, onSelect, guided = false }: { movie?: Movie; onSelect: (movie: Omit<Movie, 'activityId'>) => void; guided?: boolean }) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectingId, setSelectingId] = useState<string>();
  const [searchError, setSearchError] = useState<string>();
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(undefined);
      try {
        const response = await searchMovies(normalized, controller.signal);
        setResults(response.results);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setResults([]);
        setSearchError(error instanceof Error ? error.message : 'Movie search failed.');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, retryKey]);

  const selectMovie = async (result: MovieSearchResult) => {
    const controller = new AbortController();
    const resultKey = `${result.mediaType}-${result.tmdbId}`;
    setSelectingId(resultKey);
    setSearchError(undefined);
    try {
      const details = await getMovieDetails(result.tmdbId, result.mediaType, controller.signal);
      onSelect(details);
      setQuery('');
      setResults([]);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Unable to load movie details.');
    } finally {
      setSelectingId(undefined);
    }
  };

  const visibleSearchError = userVisibleError(searchError);

  return (
    <View>
      {!guided ? <SectionHeader title="Movie Details" /> : null}
      {movie ? (
        <GlassPlate style={styles.movieSelected}>
          {movie.posterUrl ? <Image source={movie.posterUrl} style={styles.moviePoster} contentFit="cover" /> : null}
          <View style={[styles.flex, { zIndex: 1 }]}>
            <AppText variant="bodyMedium">{movie.title}</AppText>
            <AppText variant="caption" color="secondary">
              {[movie.mediaType === 'tv' ? 'TV show' : 'Movie', movie.releaseDate?.slice(0, 4), movie.runtimeMinutes ? `${movie.runtimeMinutes} min` : undefined, movie.genres.join(', ') || undefined].filter(Boolean).join(' · ')}
            </AppText>
            {movie.overview ? <AppText variant="caption" color="secondary" numberOfLines={3}>{movie.overview}</AppText> : null}
          </View>
        </GlassPlate>
      ) : null}
      <Input
        label={movie ? 'Find Something Else' : guided ? 'Movie or TV Show' : 'Search Movies & TV'}
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          if (value.trim().length < 2) {
            setResults([]);
            setSearchError(undefined);
            setSearching(false);
          }
        }}
        placeholder="Try Dune, The Bear, Severance…"
        autoCapitalize="words"
        autoFocus={guided}
        returnKeyType="search"
      />
      {searching ? <LoadingBlock compact /> : null}
      {visibleSearchError ? (
        <View style={styles.searchMessage}>
          <ErrorMessage message={visibleSearchError} />
          <Button variant="secondary" onPress={() => setRetryKey((value) => value + 1)}>Try Again</Button>
        </View>
      ) : null}
      {!searching && !searchError && query.trim().length >= 2 && results.length === 0 ? (
        <AppText variant="callout" color="secondary">No movies or shows found.</AppText>
      ) : null}
      {results.map((result) => (
        <Pressable
          key={`${result.mediaType}-${result.tmdbId}`}
          accessibilityRole="button"
          accessibilityLabel={`Select ${result.title}`}
          disabled={selectingId !== undefined}
          onPress={() => selectMovie(result)}
          style={[styles.movieResult, { borderColor: theme.separator }]}>
          {result.posterUrl ? <Image source={result.posterUrl} style={styles.resultPoster} contentFit="cover" /> : <View style={[styles.resultPoster, { backgroundColor: theme.backgroundSunken }]} />}
          <View style={styles.flex}>
            <AppText variant="bodyMedium">{result.title}</AppText>
            <AppText variant="caption" color="secondary">
              {result.mediaType === 'tv' ? 'TV show' : 'Movie'}{result.releaseDate ? ` · ${result.releaseDate.slice(0, 4)}` : ''}
            </AppText>
            {result.overview ? <AppText variant="caption" color="secondary" numberOfLines={2}>{result.overview}</AppText> : null}
          </View>
          {selectingId === `${result.mediaType}-${result.tmdbId}` ? <ActivityIndicator /> : null}
        </Pressable>
      ))}
    </View>
  );
}


const styles = StyleSheet.create({
  flex: { flex: 1 },
  twoColumns: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nestedCard: { gap: spacing.md, padding: spacing.md, borderRadius: radii.lg },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricInput: { width: '47%' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setInput: { flex: 1 },
  loader: { padding: spacing.md },
  movieSelected: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  moviePoster: { width: 88, height: 132, borderRadius: radii.md },
  movieResult: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1 },
  resultPoster: { width: 50, height: 75, borderRadius: radii.sm },
  searchMessage: { gap: spacing.sm },
});
