import type { SymbolViewProps } from 'expo-symbols';

export type BodyView = 'front' | 'back' | 'side';

export type AnatomySex = 'male' | 'female';

export type MuscleKey =
  | 'shoulders'
  | 'chest'
  | 'biceps'
  | 'core'
  | 'quadriceps'
  | 'upper-back'
  | 'lats'
  | 'triceps'
  | 'lower-back'
  | 'glutes'
  | 'hamstrings'
  | 'calves';

export interface ExerciseTemplate {
  id: string;
  name: string;
  icon: Extract<SymbolViewProps['name'], string>;
  equipment: string;
  sets: number;
  reps: number;
  restSeconds: number;
}

export interface MuscleGroup {
  key: MuscleKey;
  label: string;
  view: BodyView;
  muscles: string[];
  cue: string;
  exercises: ExerciseTemplate[];
}

export interface MuscleTarget {
  id: string;
  label: string;
  description: string;
  cue: string;
  /** SVG path `d` values in the anatomy art viewBox (100 × 174.21). */
  highlightPaths: string[];
  exercises: ExerciseTemplate[];
}
