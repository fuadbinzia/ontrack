import type { ExerciseTemplate, MuscleGroup, MuscleKey } from './muscle-types';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  {
    key: 'shoulders',
    label: 'Shoulders',
    view: 'front',
    muscles: ['Anterior deltoid', 'Lateral deltoid'],
    cue: 'Press and raise with control; keep your ribs stacked over your hips.',
    exercises: [
      { id: 'overhead-press', name: 'Overhead Press', icon: 'figure.strengthtraining.traditional', equipment: 'Dumbbells', sets: 3, reps: 8, restSeconds: 90 },
      { id: 'lateral-raise', name: 'Lateral Raise', icon: 'dumbbell.fill', equipment: 'Dumbbells', sets: 3, reps: 12, restSeconds: 60 },
      { id: 'pike-push-up', name: 'Pike Push-Up', icon: 'figure.strengthtraining.functional', equipment: 'Bodyweight', sets: 3, reps: 10, restSeconds: 75 },
    ],
  },
  {
    key: 'chest',
    label: 'Chest',
    view: 'front',
    muscles: ['Pectoralis major', 'Pectoralis minor', 'Serratus anterior'],
    cue: 'Let the shoulder blades move naturally and finish each rep without shrugging.',
    exercises: [
      { id: 'bench-press', name: 'Bench Press', icon: 'dumbbell.fill', equipment: 'Barbell', sets: 3, reps: 8, restSeconds: 120 },
      { id: 'push-up', name: 'Push-Up', icon: 'figure.strengthtraining.functional', equipment: 'Bodyweight', sets: 3, reps: 12, restSeconds: 75 },
      { id: 'cable-fly', name: 'Cable Fly', icon: 'figure.strengthtraining.traditional', equipment: 'Cable', sets: 3, reps: 12, restSeconds: 60 },
    ],
  },
  {
    key: 'biceps',
    label: 'Biceps',
    view: 'front',
    muscles: ['Biceps brachii', 'Brachialis', 'Brachioradialis'],
    cue: 'Keep your upper arm quiet and use the full elbow range you can control.',
    exercises: [
      { id: 'incline-curl', name: 'Incline Curl', icon: 'dumbbell.fill', equipment: 'Dumbbells', sets: 3, reps: 10, restSeconds: 60 },
      { id: 'chin-up', name: 'Chin-Up', icon: 'figure.strengthtraining.functional', equipment: 'Pull-up bar', sets: 3, reps: 6, restSeconds: 120 },
      { id: 'hammer-curl', name: 'Hammer Curl', icon: 'dumbbell.fill', equipment: 'Dumbbells', sets: 3, reps: 10, restSeconds: 60 },
    ],
  },
  {
    key: 'core',
    label: 'Core',
    view: 'front',
    muscles: ['Rectus abdominis', 'Internal and external obliques', 'Transverse abdominis'],
    cue: 'Exhale, brace, and keep your pelvis and rib cage connected through the rep.',
    exercises: [
      { id: 'dead-bug', name: 'Dead Bug', icon: 'figure.core.training', equipment: 'Bodyweight', sets: 3, reps: 10, restSeconds: 45 },
      { id: 'front-plank', name: 'Front Plank', icon: 'figure.core.training', equipment: 'Bodyweight', sets: 3, reps: 30, restSeconds: 45 },
      { id: 'cable-chop', name: 'Cable Chop', icon: 'figure.strengthtraining.functional', equipment: 'Cable', sets: 3, reps: 10, restSeconds: 60 },
    ],
  },
  {
    key: 'quadriceps',
    label: 'Quadriceps',
    view: 'front',
    muscles: ['Rectus femoris', 'Vastus lateralis', 'Vastus medialis'],
    cue: 'Track the knees with the toes and use a depth you can own without pain.',
    exercises: [
      { id: 'goblet-squat', name: 'Goblet Squat', icon: 'figure.strengthtraining.functional', equipment: 'Dumbbell', sets: 3, reps: 10, restSeconds: 90 },
      { id: 'split-squat', name: 'Split Squat', icon: 'figure.strengthtraining.functional', equipment: 'Bodyweight', sets: 3, reps: 8, restSeconds: 75 },
      { id: 'leg-extension', name: 'Leg Extension', icon: 'figure.strengthtraining.traditional', equipment: 'Machine', sets: 3, reps: 12, restSeconds: 60 },
    ],
  },
  {
    key: 'upper-back',
    label: 'Upper Back',
    view: 'back',
    muscles: ['Trapezius', 'Rhomboids', 'Posterior deltoid'],
    cue: 'Lead with the elbows and finish with the shoulder blades, not the neck.',
    exercises: [
      { id: 'chest-supported-row', name: 'Chest-Supported Row', icon: 'dumbbell.fill', equipment: 'Dumbbells', sets: 3, reps: 10, restSeconds: 90 },
      { id: 'face-pull', name: 'Face Pull', icon: 'figure.strengthtraining.traditional', equipment: 'Cable', sets: 3, reps: 12, restSeconds: 60 },
      { id: 'reverse-fly', name: 'Reverse Fly', icon: 'dumbbell.fill', equipment: 'Dumbbells', sets: 3, reps: 12, restSeconds: 60 },
    ],
  },
  {
    key: 'lats',
    label: 'Lats',
    view: 'back',
    muscles: ['Latissimus dorsi', 'Teres major'],
    cue: 'Drive the elbows toward your pockets while keeping the shoulders away from your ears.',
    exercises: [
      { id: 'lat-pulldown', name: 'Lat Pulldown', icon: 'figure.strengthtraining.traditional', equipment: 'Cable', sets: 3, reps: 10, restSeconds: 90 },
      { id: 'pull-up', name: 'Pull-Up', icon: 'figure.strengthtraining.functional', equipment: 'Pull-up bar', sets: 3, reps: 6, restSeconds: 120 },
      { id: 'one-arm-row', name: 'One-Arm Row', icon: 'dumbbell.fill', equipment: 'Dumbbell', sets: 3, reps: 10, restSeconds: 75 },
    ],
  },
  {
    key: 'triceps',
    label: 'Triceps',
    view: 'back',
    muscles: ['Triceps brachii: long, lateral, and medial heads'],
    cue: 'Keep the elbows steady and fully straighten without forcing the joint.',
    exercises: [
      { id: 'cable-pushdown', name: 'Cable Pushdown', icon: 'figure.strengthtraining.traditional', equipment: 'Cable', sets: 3, reps: 12, restSeconds: 60 },
      { id: 'close-grip-push-up', name: 'Close-Grip Push-Up', icon: 'figure.strengthtraining.functional', equipment: 'Bodyweight', sets: 3, reps: 10, restSeconds: 75 },
      { id: 'overhead-extension', name: 'Overhead Extension', icon: 'dumbbell.fill', equipment: 'Dumbbell', sets: 3, reps: 10, restSeconds: 60 },
    ],
  },
  {
    key: 'lower-back',
    label: 'Lower Back',
    view: 'back',
    muscles: ['Erector spinae', 'Multifidus', 'Quadratus lumborum'],
    cue: 'Create tension through the whole trunk and move at the hips instead of overextending.',
    exercises: [
      { id: 'back-extension', name: 'Back Extension', icon: 'figure.strengthtraining.functional', equipment: 'Roman chair', sets: 3, reps: 10, restSeconds: 75 },
      { id: 'bird-dog', name: 'Bird Dog', icon: 'figure.core.training', equipment: 'Bodyweight', sets: 3, reps: 10, restSeconds: 45 },
      { id: 'good-morning', name: 'Good Morning', icon: 'figure.strengthtraining.traditional', equipment: 'Barbell', sets: 3, reps: 8, restSeconds: 90 },
    ],
  },
  {
    key: 'glutes',
    label: 'Glutes',
    view: 'back',
    muscles: ['Gluteus maximus', 'Gluteus medius', 'Gluteus minimus'],
    cue: 'Keep the pelvis level and finish through the hip without arching the low back.',
    exercises: [
      { id: 'hip-thrust', name: 'Hip Thrust', icon: 'figure.strengthtraining.traditional', equipment: 'Barbell', sets: 3, reps: 10, restSeconds: 90 },
      { id: 'step-up', name: 'Step-Up', icon: 'figure.stairs', equipment: 'Bench', sets: 3, reps: 8, restSeconds: 75 },
      { id: 'band-abduction', name: 'Band Abduction', icon: 'figure.strengthtraining.functional', equipment: 'Resistance band', sets: 3, reps: 15, restSeconds: 45 },
    ],
  },
  {
    key: 'hamstrings',
    label: 'Hamstrings',
    view: 'back',
    muscles: ['Biceps femoris', 'Semitendinosus', 'Semimembranosus'],
    cue: 'Hinge from the hips and stop before the low back begins to round.',
    exercises: [
      { id: 'romanian-deadlift', name: 'Romanian Deadlift', icon: 'figure.strengthtraining.traditional', equipment: 'Barbell', sets: 3, reps: 8, restSeconds: 120 },
      { id: 'leg-curl', name: 'Leg Curl', icon: 'figure.strengthtraining.traditional', equipment: 'Machine', sets: 3, reps: 12, restSeconds: 75 },
      { id: 'single-leg-hinge', name: 'Single-Leg Hinge', icon: 'figure.strengthtraining.functional', equipment: 'Dumbbell', sets: 3, reps: 8, restSeconds: 75 },
    ],
  },
  {
    key: 'calves',
    label: 'Calves',
    view: 'back',
    muscles: ['Gastrocnemius', 'Soleus'],
    cue: 'Pause at the top and lower slowly through a comfortable range.',
    exercises: [
      { id: 'standing-calf-raise', name: 'Standing Calf Raise', icon: 'figure.strengthtraining.functional', equipment: 'Bodyweight', sets: 3, reps: 15, restSeconds: 45 },
      { id: 'seated-calf-raise', name: 'Seated Calf Raise', icon: 'figure.strengthtraining.traditional', equipment: 'Machine', sets: 3, reps: 15, restSeconds: 45 },
      { id: 'single-leg-calf-raise', name: 'Single-Leg Calf Raise', icon: 'figure.strengthtraining.functional', equipment: 'Bodyweight', sets: 3, reps: 12, restSeconds: 45 },
    ],
  },
];

export const MUSCLE_GROUPS_BY_KEY = Object.fromEntries(
  MUSCLE_GROUPS.map((group) => [group.key, group]),
) as Record<MuscleKey, MuscleGroup>;

