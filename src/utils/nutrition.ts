import type {
  ActivityLevel,
  NutritionProfile,
  NutritionTargets,
  NutritionTargetVersion,
} from '@/types/models';

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  inactive: 1.2,
  'low-active': 1.375,
  active: 1.55,
  'very-active': 1.725,
};

const PEDIATRIC_PA: Record<ActivityLevel, { female: number; male: number }> = {
  inactive: { female: 1, male: 1 },
  'low-active': { female: 1.16, male: 1.13 },
  active: { female: 1.31, male: 1.26 },
  'very-active': { female: 1.56, male: 1.42 },
};

export class NutritionTargetError extends Error {
  constructor(
    message: string,
    readonly code: 'MISSING_INPUT' | 'CLINICAL_APPROVAL_REQUIRED' | 'GUARDIAN_ACK_REQUIRED',
  ) {
    super(message);
    this.name = 'NutritionTargetError';
  }
}

export function ageInYears(dateOfBirth: string, onDate = new Date()): number {
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > onDate) return Number.NaN;
  let age = onDate.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    onDate.getMonth() < birth.getMonth() ||
    (onDate.getMonth() === birth.getMonth() && onDate.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function pediatricCalories(profile: NutritionProfile, age: number): number {
  const weightKg = profile.weightKg!;
  if (age === 2) return 89 * weightKg - 80;
  const heightM = profile.heightCm! / 100;
  const pa = PEDIATRIC_PA[profile.activityLevel][profile.equationSex];
  if (profile.equationSex === 'male') {
    return 88.5 - 61.9 * age + pa * (26.7 * weightKg + 903 * heightM) + 25;
  }
  return 135.3 - 30.8 * age + pa * (10 * weightKg + 934 * heightM) + 25;
}

function macroTargets(calories: number, weightKg: number, age: number): NutritionTargets {
  const proteinG = Math.round(weightKg * (age < 18 ? 0.95 : 0.8));
  const fatG = Math.round((calories * (age < 18 ? 0.3 : 0.28)) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  return { calories: Math.round(calories), proteinG, carbsG, fatG, nutrients: [] };
}

/**
 * Produces a wellness estimate, never a diagnosis. Under-two profiles are
 * intentionally blocked until a verified clinician supplies and approves targets.
 */
export function calculateNutritionTargets(
  profile: NutritionProfile,
  onDate = new Date(),
): NutritionTargets {
  const age = ageInYears(profile.dateOfBirth, onDate);
  if (!Number.isFinite(age) || !profile.weightKg || profile.weightKg <= 0) {
    throw new NutritionTargetError('A valid birth date and weight are required.', 'MISSING_INPUT');
  }
  if (age < 2) {
    throw new NutritionTargetError(
      'Infant targets must be entered and approved by a verified pediatric clinician.',
      'CLINICAL_APPROVAL_REQUIRED',
    );
  }
  if (age < 18 && !profile.guardianAcknowledgedAt) {
    throw new NutritionTargetError(
      'A parent or guardian needs to confirm this first.',
      'GUARDIAN_ACK_REQUIRED',
    );
  }
  if (!profile.heightCm || profile.heightCm <= 0) {
    throw new NutritionTargetError('Add a height so we can estimate targets.', 'MISSING_INPUT');
  }

  if (age < 18) return macroTargets(pediatricCalories(profile, age), profile.weightKg, age);

  const base =
    10 * profile.weightKg +
    6.25 * profile.heightCm -
    5 * age +
    (profile.equationSex === 'male' ? 5 : -161);
  const maintenance = base * ACTIVITY_MULTIPLIER[profile.activityLevel];
  const adjustment = profile.goal === 'lose' ? -Math.min(500, maintenance * 0.1) :
    profile.goal === 'gain' ? Math.min(500, maintenance * 0.1) : 0;
  return macroTargets(Math.max(1200, maintenance + adjustment), profile.weightKg, age);
}

export function createTargetVersion(
  profile: NutritionProfile,
  calculatedTargets: NutritionTargets,
  overrides: Partial<Omit<NutritionTargets, 'nutrients'>> = {},
  version = 1,
): NutritionTargetVersion {
  const age = ageInYears(profile.dateOfBirth);
  return {
    id: `target-${profile.id}-${version}`,
    profileId: profile.id,
    version,
    status: age < 2 ? 'draft' : 'approved',
    calculatedTargets,
    targets: { ...calculatedTargets, ...overrides },
    authorRole: age < 18 ? 'guardian' : 'user',
    effectiveAt: new Date().toISOString(),
  };
}

export function sumKnownNutrient(
  values: (number | undefined)[],
): { amount?: number; coverage: number } {
  const known = values.filter((value): value is number => typeof value === 'number');
  return {
    amount: known.length ? known.reduce((sum, value) => sum + value, 0) : undefined,
    coverage: values.length ? known.length / values.length : 0,
  };
}
