import type { ExerciseTemplate } from './muscle-types';
import { MUSCLE_GROUPS } from './muscle-groups-data';

function movement(
  id: string,
  name: string,
  equipment: string,
  reps = 12,
  restSeconds = 60,
  icon: ExerciseTemplate['icon'] = 'dumbbell.fill',
): ExerciseTemplate {
  return { id, name, icon, equipment, sets: 3, reps, restSeconds };
}

const TARGET_ONLY_EXERCISES: ExerciseTemplate[] = [
  movement('front-raise', 'Front Raise', 'Dumbbells', 12, 60),
  movement('arnold-press', 'Arnold Press', 'Dumbbells', 10, 75),
  movement('cable-lateral-raise', 'Cable Lateral Raise', 'Cable', 12, 60),
  movement('upright-row', 'Wide-Grip Upright Row', 'Cable', 10, 75),
  movement('assisted-dip', 'Assisted Dip', 'Dip station', 8, 90, 'figure.strengthtraining.functional'),
  movement('dumbbell-pullover', 'Dumbbell Pullover', 'Dumbbell', 10, 75),
  movement('scapular-push-up', 'Scapular Push-Up', 'Bodyweight', 12, 45, 'figure.strengthtraining.functional'),
  movement('push-up-plus', 'Push-Up Plus', 'Bodyweight', 12, 45, 'figure.strengthtraining.functional'),
  movement('wall-slide', 'Serratus Wall Slide', 'Resistance band', 12, 45, 'figure.strengthtraining.functional'),
  movement('landmine-press', 'Single-Arm Landmine Press', 'Landmine', 10, 75, 'figure.strengthtraining.traditional'),
  movement('barbell-curl', 'Barbell Curl', 'Barbell', 10, 75),
  movement('reverse-curl', 'Reverse Curl', 'EZ bar', 12, 60),
  movement('preacher-curl', 'Preacher Curl', 'EZ bar', 10, 60),
  movement('zottman-curl', 'Zottman Curl', 'Dumbbells', 10, 60),
  movement('cable-crunch', 'Cable Crunch', 'Cable', 12, 60, 'figure.core.training'),
  movement('hanging-knee-raise', 'Hanging Knee Raise', 'Pull-up bar', 10, 60, 'figure.core.training'),
  movement('side-plank', 'Side Plank', 'Bodyweight', 30, 45, 'figure.core.training'),
  movement('suitcase-carry', 'Suitcase Carry', 'Dumbbell', 30, 60, 'figure.strengthtraining.functional'),
  movement('hollow-hold', 'Hollow-Body Hold', 'Bodyweight', 30, 45, 'figure.core.training'),
  movement('reverse-nordic', 'Reverse Nordic', 'Bodyweight', 8, 75, 'figure.strengthtraining.functional'),
  movement('narrow-leg-press', 'Narrow-Stance Leg Press', 'Machine', 10, 90, 'figure.strengthtraining.traditional'),
  movement('hack-squat', 'Hack Squat', 'Machine', 10, 90, 'figure.strengthtraining.traditional'),
  movement('step-down', 'Controlled Step-Down', 'Step', 10, 60, 'figure.stairs'),
  movement('heel-elevated-squat', 'Heel-Elevated Squat', 'Dumbbell', 10, 75, 'figure.strengthtraining.functional'),
  movement('terminal-knee-extension', 'Terminal Knee Extension', 'Resistance band', 15, 45, 'figure.strengthtraining.functional'),
  movement('farmer-carry', 'Farmer Carry', 'Dumbbells', 30, 75, 'figure.strengthtraining.functional'),
  movement('dumbbell-shrug', 'Dumbbell Shrug', 'Dumbbells', 12, 60),
  movement('seated-cable-row', 'Seated Cable Row', 'Cable', 10, 75, 'figure.strengthtraining.traditional'),
  movement('band-pull-apart', 'Band Pull-Apart', 'Resistance band', 15, 45, 'figure.strengthtraining.functional'),
  movement('rear-delt-row', 'Rear-Delt Row', 'Dumbbells', 12, 60),
  movement('straight-arm-pulldown', 'Straight-Arm Pulldown', 'Cable', 12, 60, 'figure.strengthtraining.traditional'),
  movement('neutral-pulldown', 'Neutral-Grip Pulldown', 'Cable', 10, 75, 'figure.strengthtraining.traditional'),
  movement('skull-crusher', 'Skull Crusher', 'EZ bar', 10, 75),
  movement('incline-cable-extension', 'Incline Cable Extension', 'Cable', 12, 60, 'figure.strengthtraining.traditional'),
  movement('close-grip-bench', 'Close-Grip Bench Press', 'Barbell', 8, 90),
  movement('reverse-grip-pushdown', 'Reverse-Grip Pushdown', 'Cable', 12, 60, 'figure.strengthtraining.traditional'),
  movement('diamond-push-up', 'Diamond Push-Up', 'Bodyweight', 10, 60, 'figure.strengthtraining.functional'),
  movement('single-arm-pushdown', 'Single-Arm Pushdown', 'Cable', 12, 45, 'figure.strengthtraining.traditional'),
  movement('pallof-press', 'Pallof Press', 'Cable', 10, 60, 'figure.core.training'),
  movement('hip-hike', 'Standing Hip Hike', 'Step', 12, 45, 'figure.stairs'),
  movement('lateral-step-up', 'Lateral Step-Up', 'Step', 10, 60, 'figure.stairs'),
  movement('clamshell', 'Banded Clamshell', 'Resistance band', 15, 45, 'figure.strengthtraining.functional'),
  movement('side-lying-abduction', 'Side-Lying Hip Abduction', 'Bodyweight', 15, 45, 'figure.strengthtraining.functional'),
  movement('balance-reach', 'Single-Leg Balance Reach', 'Bodyweight', 10, 45, 'figure.strengthtraining.functional'),
  movement('monster-walk', 'Monster Walk', 'Resistance band', 12, 45, 'figure.strengthtraining.functional'),
  movement('nordic-curl', 'Nordic Hamstring Curl', 'Bodyweight', 6, 120, 'figure.strengthtraining.functional'),
  movement('seated-leg-curl', 'Seated Leg Curl', 'Machine', 12, 75, 'figure.strengthtraining.traditional'),
  movement('glute-ham-raise', 'Glute-Ham Raise', 'GHD', 8, 90, 'figure.strengthtraining.functional'),
  movement('lying-leg-curl', 'Lying Leg Curl', 'Machine', 12, 75, 'figure.strengthtraining.traditional'),
  movement('slider-curl', 'Hamstring Slider Curl', 'Sliders', 10, 60, 'figure.strengthtraining.functional'),
  movement('jump-rope', 'Jump Rope', 'Jump rope', 30, 45, 'figure.strengthtraining.functional'),
  movement('bent-knee-calf-raise', 'Bent-Knee Calf Raise', 'Dumbbell', 15, 45, 'figure.strengthtraining.functional'),
  movement('sled-push', 'Heavy Sled Push', 'Sled', 20, 75, 'figure.strengthtraining.functional'),
];

const ALL_EXERCISES = [
  ...MUSCLE_GROUPS.flatMap((group) => group.exercises),
  ...TARGET_ONLY_EXERCISES,
];

export const EXERCISES_BY_ID = Object.fromEntries(
  ALL_EXERCISES.map((exercise) => [exercise.id, exercise]),
) as Record<string, ExerciseTemplate>;

