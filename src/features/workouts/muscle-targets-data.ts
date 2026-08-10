import { highlightPathsForMuscle } from './muscle-highlight-map';
import type { ExerciseTemplate, MuscleKey, MuscleTarget } from './muscle-types';
import { EXERCISES_BY_ID } from './muscle-exercises';

function exercises(...ids: string[]): ExerciseTemplate[] {
  return ids.map((id) => {
    const exercise = EXERCISES_BY_ID[id];
    if (!exercise) throw new Error(`Unknown exercise: ${id}`);
    return exercise;
  });
}

export const MUSCLE_TARGETS_BY_GROUP: Record<MuscleKey, MuscleTarget[]> = {
  shoulders: [
    {
      id: 'anterior-deltoid',
      label: 'Anterior deltoid',
      description: 'The front shoulder fibers that flex and internally rotate the upper arm.',
      cue: 'Keep the ribs down and finish the raise at shoulder height without shrugging.',
      highlightPaths: [
        'M27 33 C24 35 24 40 26 44 C28 47 32 46 34 43 C35 39 34 34 31 32 C29 31 28 32 27 33 Z',
        'M73 33 C76 35 76 40 74 44 C72 47 68 46 66 43 C65 39 66 34 69 32 C71 31 72 32 73 33 Z',
      ],
      exercises: exercises('overhead-press', 'front-raise', 'arnold-press'),
    },
    {
      id: 'lateral-deltoid',
      label: 'Lateral deltoid',
      description: 'The middle shoulder fibers responsible for raising the arm out to the side.',
      cue: 'Lead with the elbows and stop before the upper traps take over.',
      highlightPaths: [
        'M21 34 C18 36 17 42 19 47 C21 50 25 49 27 45 C28 40 27 35 24 33 C22 32 22 33 21 34 Z',
        'M79 34 C82 36 83 42 81 47 C79 50 75 49 73 45 C72 40 73 35 76 33 C78 32 78 33 79 34 Z',
      ],
      exercises: exercises('lateral-raise', 'cable-lateral-raise', 'upright-row'),
    },
  ],
  chest: [
    {
      id: 'pectoralis-major',
      label: 'Pectoralis major',
      description: 'The large superficial chest muscle that brings the upper arm across the body.',
      cue: 'Keep the shoulder blades supported and bring the upper arms toward the midline.',
      highlightPaths: [
        // Fan from sternum to axilla — stays clear of the deltoid cap.
        'M32.4 36.1 C38.0 33.4 44.2 33.2 48.6 35.9 C48.9 40.8 48.8 47.2 48.2 52.8 C44.8 55.6 40.2 55.4 35.6 52.9 C32.2 50.6 30.0 47.0 29.5 43.0 C29.2 39.8 30.2 37.4 32.0 36.3 C32.1 36.2 32.3 36.1 32.4 36.1 Z',
        'M67.6 36.1 C62.0 33.4 55.8 33.2 51.4 35.9 C51.1 40.8 51.2 47.2 51.8 52.8 C55.2 55.6 59.8 55.4 64.4 52.9 C67.8 50.6 70.0 47.0 70.5 43.0 C70.8 39.8 69.8 37.4 68.0 36.3 C67.9 36.2 67.7 36.1 67.6 36.1 Z',
      ],
      exercises: exercises('bench-press', 'cable-fly', 'push-up'),
    },
    {
      id: 'pectoralis-minor',
      label: 'Pectoralis minor',
      description: 'A smaller, deeper chest muscle that helps control the shoulder blade.',
      cue: 'Reach fully at the top while keeping the neck long and the ribs quiet.',
      highlightPaths: [
        'M39 44 C41 42 46 42 47.5 45 L47 53 C44 54 40 52 38.5 48 Z',
        'M61 44 C59 42 54 42 52.5 45 L53 53 C56 54 60 52 61.5 48 Z',
      ],
      exercises: exercises('assisted-dip', 'dumbbell-pullover', 'scapular-push-up'),
    },
    {
      id: 'serratus-anterior',
      label: 'Serratus anterior',
      description: 'The rib-side muscle that protracts and upwardly rotates the shoulder blade.',
      cue: 'Finish each rep by reaching the shoulder blades around the rib cage.',
      highlightPaths: [
        'M31 50 C29 53 29 60 31 65 C33 67 36 65 36 61 C36 55 35 51 33 49 Z',
        'M69 50 C71 53 71 60 69 65 C67 67 64 65 64 61 C64 55 65 51 67 49 Z',
      ],
      exercises: exercises('push-up-plus', 'wall-slide', 'landmine-press'),
    },
  ],
  biceps: [
    {
      id: 'biceps-brachii',
      label: 'Biceps brachii',
      description: 'The two-headed upper-arm muscle that bends the elbow and turns the palm up.',
      cue: 'Keep the upper arm still and fully supinate the palm as you curl.',
      highlightPaths: [
        // Stay inside the arm silhouette (art arms begin ~x 26 / 74 — older paths spilled into empty space).
        'M29.0 47.5 C27.5 49.0 26.5 52.0 26.5 55.5 C26.5 59.0 25.5 62.5 25.8 64.5 C26.8 65.5 28.5 65.0 29.5 63.5 C30.5 60.5 31.5 56.0 31.5 52.0 C31.5 49.0 30.5 47.5 29.0 47.5 Z',
        'M71.0 47.5 C72.5 49.0 73.5 52.0 73.5 55.5 C73.5 59.0 74.5 62.5 74.2 64.5 C73.2 65.5 71.5 65.0 70.5 63.5 C69.5 60.5 68.5 56.0 68.5 52.0 C68.5 49.0 69.5 47.5 71.0 47.5 Z',
      ],
      exercises: exercises('incline-curl', 'chin-up', 'barbell-curl'),
    },
    {
      id: 'brachialis',
      label: 'Brachialis',
      description: 'A deep elbow flexor beneath the biceps that adds upper-arm thickness.',
      cue: 'Use a neutral or pronated grip and avoid letting the elbows drift forward.',
      highlightPaths: [
        'M27.6 56.0 C26.0 58.0 25.0 62.0 25.2 66.0 C26.2 68.0 28.0 67.5 28.8 65.0 C29.2 62.0 29.0 58.0 27.6 56.0 Z',
        'M72.4 56.0 C74.0 58.0 75.0 62.0 74.8 66.0 C73.8 68.0 72.0 67.5 71.2 65.0 C70.8 62.0 71.0 58.0 72.4 56.0 Z',
      ],
      exercises: exercises('hammer-curl', 'reverse-curl', 'preacher-curl'),
    },
    {
      id: 'brachioradialis',
      label: 'Brachioradialis',
      description: 'The prominent forearm-side elbow flexor strongest with a neutral grip.',
      cue: 'Keep the wrist neutral and drive the thumb toward the shoulder.',
      highlightPaths: [
        'M22.5 67.0 C21.0 70.0 19.5 75.0 18.5 80.0 C18.0 83.0 19.2 85.0 20.5 84.5 C21.0 82.0 22.0 76.0 23.2 71.0 C23.6 69.0 23.4 67.4 22.5 67.0 Z',
        'M77.5 67.0 C79.0 70.0 80.5 75.0 81.5 80.0 C82.0 83.0 80.8 85.0 79.5 84.5 C79.0 82.0 78.0 76.0 76.8 71.0 C76.4 69.0 76.6 67.4 77.5 67.0 Z',
      ],
      exercises: exercises('hammer-curl', 'reverse-curl', 'zottman-curl'),
    },
  ],
  core: [
    {
      id: 'rectus-abdominis',
      label: 'Rectus abdominis',
      description: 'The front abdominal wall that flexes the trunk and resists extension.',
      cue: 'Exhale, bring the ribs toward the pelvis, and avoid pulling on the neck.',
      highlightPaths: [
        'M42 55 C45 53 48 54 49 58 L48.5 84 C46 87 43 85 41.5 81 Z',
        'M58 55 C55 53 52 54 51 58 L51.5 84 C54 87 57 85 58.5 81 Z',
      ],
      exercises: exercises('front-plank', 'cable-crunch', 'hanging-knee-raise'),
    },
    {
      id: 'obliques',
      label: 'Internal & external obliques',
      description: 'The side abdominal layers that rotate, side-bend, and resist unwanted motion.',
      cue: 'Keep the hips square and rotate through the rib cage under control.',
      highlightPaths: [
        'M34 56 C37 54 41 56 42 61 L40 85 C37 88 33 85 32 80 Z',
        'M66 56 C63 54 59 56 58 61 L60 85 C63 88 67 85 68 80 Z',
      ],
      exercises: exercises('cable-chop', 'side-plank', 'suitcase-carry'),
    },
    {
      id: 'transverse-abdominis',
      label: 'Transverse abdominis',
      description: 'The deepest abdominal layer that braces the trunk like a corset.',
      cue: 'Breathe out gently, brace 360 degrees, and keep the low back quiet.',
      highlightPaths: ['M38 77 C44 74 56 74 62 77 L61 86 C55 89 45 89 39 86 Z'],
      exercises: exercises('dead-bug', 'bird-dog', 'hollow-hold'),
    },
  ],
  quadriceps: [
    {
      id: 'rectus-femoris',
      label: 'Rectus femoris',
      description: 'The central quadriceps muscle that extends the knee and assists hip flexion.',
      cue: 'Keep the pelvis stacked and control both the lifting and lowering phases.',
      highlightPaths: [
        'M40 95 C43 92 47 95 48 101 L47 129 C44 133 40 130 39 124 Z',
        'M60 95 C57 92 53 95 52 101 L53 129 C56 133 60 130 61 124 Z',
      ],
      exercises: exercises('leg-extension', 'reverse-nordic', 'split-squat'),
    },
    {
      id: 'vastus-lateralis',
      label: 'Vastus lateralis',
      description: 'The outer quadriceps muscle that provides powerful knee extension.',
      cue: 'Track the knees over the toes and maintain even pressure through the feet.',
      highlightPaths: [
        'M30 96 C33 93 37 97 38 104 L36 132 C33 136 29 132 28 125 Z',
        'M70 96 C67 93 63 97 62 104 L64 132 C67 136 71 132 72 125 Z',
      ],
      exercises: exercises('goblet-squat', 'narrow-leg-press', 'hack-squat'),
    },
    {
      id: 'vastus-medialis',
      label: 'Vastus medialis',
      description: 'The teardrop-shaped inner quadriceps muscle that supports knee control.',
      cue: 'Own the final degrees of knee extension without snapping the joint locked.',
      highlightPaths: [
        'M41 123 C43 121 47 122 48 127 L47 137 C44 139 41 137 40 133 Z',
        'M59 123 C57 121 53 122 52 127 L53 137 C56 139 59 137 60 133 Z',
      ],
      exercises: exercises('step-down', 'heel-elevated-squat', 'terminal-knee-extension'),
    },
  ],
  'upper-back': [
    {
      id: 'trapezius',
      label: 'Trapezius',
      description: 'A broad upper-back muscle that elevates, retracts, and rotates the shoulder blades.',
      cue: 'Move the shoulder blades deliberately without jutting the head forward.',
      highlightPaths: ['M38 28 L50 22 L62 28 L58 52 L50 58 L42 52 Z'],
      exercises: exercises('face-pull', 'farmer-carry', 'dumbbell-shrug'),
    },
    {
      id: 'rhomboids',
      label: 'Rhomboids',
      description: 'Deep muscles between the shoulder blades that draw them toward the spine.',
      cue: 'Pause with the shoulder blades gently together while keeping the neck relaxed.',
      highlightPaths: [
        'M43 42 C45 40 48 42 48.5 47 L47.5 55 C45 57 43 54 42.5 50 Z',
        'M57 42 C55 40 52 42 51.5 47 L52.5 55 C55 57 57 54 57.5 50 Z',
      ],
      exercises: exercises('chest-supported-row', 'seated-cable-row', 'band-pull-apart'),
    },
    {
      id: 'posterior-deltoid',
      label: 'Posterior deltoid',
      description: 'The rear shoulder fibers that pull the upper arm backward and outward.',
      cue: 'Lead with the elbows and keep the shoulder blades from over-squeezing.',
      highlightPaths: [
        'M23 35 C20 37 20 43 23 47 C26 49 30 47 31 43 C31 38 29 34 26 33 C24 33 23 34 23 35 Z',
        'M77 35 C80 37 80 43 77 47 C74 49 70 47 69 43 C69 38 71 34 74 33 C76 33 77 34 77 35 Z',
      ],
      exercises: exercises('reverse-fly', 'face-pull', 'rear-delt-row'),
    },
  ],
  lats: [
    {
      id: 'latissimus-dorsi',
      label: 'Latissimus dorsi',
      description: 'The broad back muscle that pulls the upper arm down and toward the torso.',
      cue: 'Drive the elbows toward your pockets without arching the low back.',
      highlightPaths: [
        'M34 48 C39 53 43 58 48 62 L47 82 C40 80 34 72 30 60 Z',
        'M66 48 C61 53 57 58 52 62 L53 82 C60 80 66 72 70 60 Z',
      ],
      exercises: exercises('lat-pulldown', 'pull-up', 'one-arm-row'),
    },
    {
      id: 'teres-major',
      label: 'Teres major',
      description: 'A smaller upper-back muscle that assists shoulder extension and inward rotation.',
      cue: 'Keep the shoulder down and sweep the upper arm toward the side of the ribs.',
      highlightPaths: [
        'M30 45 C32 43 37 44 38 48 L36 54 C33 55 30 52 29 49 Z',
        'M70 45 C68 43 63 44 62 48 L64 54 C67 55 70 52 71 49 Z',
      ],
      exercises: exercises('straight-arm-pulldown', 'neutral-pulldown', 'dumbbell-pullover'),
    },
  ],
  triceps: [
    {
      id: 'triceps-long-head',
      label: 'Triceps long head',
      description: 'The largest triceps head, crossing both the shoulder and elbow joints.',
      cue: 'Keep the upper arms long and stable while reaching a full overhead stretch.',
      highlightPaths: [
        'M26 46 C24 49 23.5 56 25 63 C26.5 67 29 66 29.5 62 C30 54 29.5 48 28 45.5 Z',
        'M74 46 C76 49 76.5 56 75 63 C73.5 67 71 66 70.5 62 C70 54 70.5 48 72 45.5 Z',
      ],
      exercises: exercises('overhead-extension', 'skull-crusher', 'incline-cable-extension'),
    },
    {
      id: 'triceps-lateral-head',
      label: 'Triceps lateral head',
      description: 'The outer triceps head that contributes strongly to elbow lockout.',
      cue: 'Pin the elbows near the ribs and finish each rep without rolling the shoulders.',
      highlightPaths: [
        'M21 50 C19 53 18.5 59 20 65 C21.5 68 24 67 25 63 C25.5 57 24.5 51 23 49 Z',
        'M79 50 C81 53 81.5 59 80 65 C78.5 68 76 67 75 63 C74.5 57 75.5 51 77 49 Z',
      ],
      exercises: exercises('cable-pushdown', 'close-grip-push-up', 'close-grip-bench'),
    },
    {
      id: 'triceps-medial-head',
      label: 'Triceps medial head',
      description: 'A deep triceps head active through all forms of elbow extension.',
      cue: 'Use a controlled squeeze at lockout and keep the wrist stacked.',
      highlightPaths: [
        'M27 61 C25.5 63 25 67 26.5 71 C28 73 30.5 72 31 69 C31 65 30 62 28.5 60.5 Z',
        'M73 61 C74.5 63 75 67 73.5 71 C72 73 69.5 72 69 69 C69 65 70 62 71.5 60.5 Z',
      ],
      exercises: exercises('reverse-grip-pushdown', 'diamond-push-up', 'single-arm-pushdown'),
    },
  ],
  'lower-back': [
    {
      id: 'erector-spinae',
      label: 'Erector spinae',
      description: 'Long columns beside the spine that extend and stabilize the trunk.',
      cue: 'Brace first, hinge at the hips, and finish tall without leaning backward.',
      highlightPaths: [
        'M44 70 C46 68 48 70 48.5 75 L48 94 C46 96 44 94 43.5 90 Z',
        'M56 70 C54 68 52 70 51.5 75 L52 94 C54 96 56 94 56.5 90 Z',
      ],
      exercises: exercises('back-extension', 'good-morning', 'romanian-deadlift'),
    },
    {
      id: 'multifidus',
      label: 'Multifidus',
      description: 'Small deep spinal muscles that provide segment-by-segment stability.',
      cue: 'Move slowly while keeping the pelvis level and the spine quiet.',
      highlightPaths: [
        'M46.5 75 C47.5 74 49 75 49 79 L48.5 93 C47.5 94 46.5 93 46.5 90 Z',
        'M53.5 75 C52.5 74 51 75 51 79 L51.5 93 C52.5 94 53.5 93 53.5 90 Z',
      ],
      exercises: exercises('bird-dog', 'dead-bug', 'pallof-press'),
    },
    {
      id: 'quadratus-lumborum',
      label: 'Quadratus lumborum',
      description: 'A deep side-wall back muscle that stabilizes the pelvis and side-bends the trunk.',
      cue: 'Stay tall and resist letting one side of the pelvis hike or collapse.',
      highlightPaths: [
        'M36 77 C39 75 43 77 43.5 82 L42 90 C39 92 36 90 35.5 86 Z',
        'M64 77 C61 75 57 77 56.5 82 L58 90 C61 92 64 90 64.5 86 Z',
      ],
      exercises: exercises('suitcase-carry', 'side-plank', 'hip-hike'),
    },
  ],
  glutes: [
    {
      id: 'gluteus-maximus',
      label: 'Gluteus maximus',
      description: 'The largest gluteal muscle and primary driver of powerful hip extension.',
      cue: 'Finish through the hips while keeping the ribs down and pelvis neutral.',
      highlightPaths: [
        'M33 90 C37 86 45 88 48 96 L46 110 C41 114 33 110 31 102 Z',
        'M67 90 C63 86 55 88 52 96 L54 110 C59 114 67 110 69 102 Z',
      ],
      exercises: exercises('hip-thrust', 'step-up', 'romanian-deadlift'),
    },
    {
      id: 'gluteus-medius',
      label: 'Gluteus medius',
      description: 'The upper-side glute that abducts the hip and keeps the pelvis level.',
      cue: 'Keep the pelvis stacked and move the thigh without rolling backward.',
      highlightPaths: [
        'M32 86 C35 83 41 84 43 89 L41 96 C37 98 32 96 31 92 Z',
        'M68 86 C65 83 59 84 57 89 L59 96 C63 98 68 96 69 92 Z',
      ],
      exercises: exercises('band-abduction', 'lateral-step-up', 'clamshell'),
    },
    {
      id: 'gluteus-minimus',
      label: 'Gluteus minimus',
      description: 'The deepest gluteal muscle, assisting hip abduction and joint stability.',
      cue: 'Use a small controlled range and keep the standing hip centered.',
      highlightPaths: [
        'M36 91 C38 89 42 90 43 93 L42 98 C39 99 36 98 35.5 95 Z',
        'M64 91 C62 89 58 90 57 93 L58 98 C61 99 64 98 64.5 95 Z',
      ],
      exercises: exercises('side-lying-abduction', 'balance-reach', 'monster-walk'),
    },
  ],
  hamstrings: [
    {
      id: 'biceps-femoris',
      label: 'Biceps femoris',
      description: 'The outer hamstring that bends the knee and extends the hip.',
      cue: 'Keep the hips square and feel tension along the outer back of the thigh.',
      highlightPaths: [
        'M31 108 C34 104 39 108 40 115 L38 138 C35 142 30 138 29 131 Z',
        'M69 108 C66 104 61 108 60 115 L62 138 C65 142 70 138 71 131 Z',
      ],
      exercises: exercises('leg-curl', 'romanian-deadlift', 'nordic-curl'),
    },
    {
      id: 'semitendinosus',
      label: 'Semitendinosus',
      description: 'A medial superficial hamstring important for knee flexion and hip extension.',
      cue: 'Keep the knee tracking straight and control the final portion of the curl.',
      highlightPaths: [
        'M40 108 C43 105 47 109 48 116 L46 138 C43 142 39 138 39 131 Z',
        'M60 108 C57 105 53 109 52 116 L54 138 C57 142 61 138 61 131 Z',
      ],
      exercises: exercises('seated-leg-curl', 'single-leg-hinge', 'glute-ham-raise'),
    },
    {
      id: 'semimembranosus',
      label: 'Semimembranosus',
      description: 'A deeper medial hamstring that supports hip extension and knee stability.',
      cue: 'Use a smooth tempo and avoid twisting the foot or pelvis to finish the rep.',
      highlightPaths: [
        'M45 110 C47 108 50 111 50.5 117 L50 137 C48 140 45 137 44.5 132 Z',
        'M55 110 C53 108 50 111 49.5 117 L50 137 C52 140 55 137 55.5 132 Z',
      ],
      exercises: exercises('lying-leg-curl', 'good-morning', 'slider-curl'),
    },
  ],
  calves: [
    {
      id: 'gastrocnemius',
      label: 'Gastrocnemius',
      description: 'The visible two-headed calf muscle, strongest when the knee is straight.',
      cue: 'Rise through the big toe, pause at the top, and lower through full control.',
      highlightPaths: [
        'M32 134 C36 129 42 133 43 141 L41 157 C37 161 32 158 31 151 Z',
        'M68 134 C64 129 58 133 57 141 L59 157 C63 161 68 158 69 151 Z',
      ],
      exercises: exercises('standing-calf-raise', 'single-leg-calf-raise', 'jump-rope'),
    },
    {
      id: 'soleus',
      label: 'Soleus',
      description: 'The deeper calf muscle emphasized when the knee remains bent.',
      cue: 'Keep the knee softly bent and pause without bouncing out of the bottom.',
      highlightPaths: [
        'M35 148 C38 145 43 148 44 154 L42 164 C39 167 35 164 34 159 Z',
        'M65 148 C62 145 57 148 56 154 L58 164 C61 167 65 164 66 159 Z',
      ],
      exercises: exercises('seated-calf-raise', 'bent-knee-calf-raise', 'sled-push'),
    },
  ],
};

for (const key of Object.keys(MUSCLE_TARGETS_BY_GROUP) as MuscleKey[]) {
  MUSCLE_TARGETS_BY_GROUP[key] = MUSCLE_TARGETS_BY_GROUP[key].map((target) => {
    const mapped = highlightPathsForMuscle(target.id);
    return mapped.length > 0 ? { ...target, highlightPaths: mapped } : target;
  });
}
