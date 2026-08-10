import {
  FoodEditor,
  MovieEditor,
  WorkEditor,
  WorkoutEditor,
} from '@/app/activity-form-editors';
import type { Meal, Movie, WorkSession, Workout } from '@/types/models';

type Props = {
  categoryDetailKind: string | undefined;
  isEditing: boolean;
  meal: Meal;
  setMeal: (v: Meal | ((c: Meal) => Meal)) => void;
  updateFoodItem: (...args: any[]) => void;
  addFoodItem: (...args: any[]) => void;
  workout: Workout;
  setWorkout: (v: Workout | ((c: Workout) => Workout)) => void;
  updateExercise: (...args: any[]) => void;
  addExercise: (...args: any[]) => void;
  addSet: (...args: any[]) => void;
  updateSet: (...args: any[]) => void;
  removeSet: (...args: any[]) => void;
  workSession: WorkSession;
  setWorkSession: (v: WorkSession | ((c: WorkSession) => WorkSession)) => void;
  updateTask: (...args: any[]) => void;
  addTask: (...args: any[]) => void;
  movie: Movie;
  setMovie: (v: Movie) => void;
  setTitle: (v: string) => void;
  setDuration: (v: string) => void;
  editId?: string;
  savedDraftId: string;
};

export function ActivityFormDetailEditors({
  categoryDetailKind: detailKind,
  isEditing,
  meal,
  setMeal,
  updateFoodItem,
  addFoodItem,
  workout,
  setWorkout,
  updateExercise,
  addExercise,
  addSet,
  updateSet,
  removeSet,
  workSession,
  setWorkSession,
  updateTask,
  addTask,
  movie,
  setMovie,
  setTitle,
  setDuration,
  editId,
  savedDraftId,
}: Props) {
  return (
    <>
      {detailKind === 'food' ? (
        <FoodEditor
          meal={meal}
          setMeal={setMeal}
          updateItem={updateFoodItem}
          addItem={addFoodItem}
          removeItem={(id) =>
            setMeal((current) => ({
              ...current,
              items: current.items.filter((item) => item.id !== id),
            }))
          }
        />
      ) : null}
      {detailKind === 'gym' ? (
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
      {detailKind === 'work' ? (
        <WorkEditor
          session={workSession}
          setSession={setWorkSession}
          updateTask={updateTask}
          addTask={addTask}
        />
      ) : null}
      {isEditing && detailKind === 'movie' ? (
        <MovieEditor
          movie={movie}
          onSelect={(selected) => {
            setMovie({ ...selected, activityId: editId ?? savedDraftId });
            setTitle(selected.title);
            if (selected.runtimeMinutes) setDuration(String(selected.runtimeMinutes));
          }}
        />
      ) : null}
    </>
  );
}
