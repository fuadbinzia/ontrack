import type { CategoryColorKey } from '@/design-system';

export type ActivityStatus = 'upcoming' | 'completed' | 'partial' | 'skipped';

export interface ActivityCategory {
  id: string;
  name: string;
  /** Semantic app icon name (see `design-system/icons`). Legacy records may hold raw SF Symbol names. */
  icon: string;
  colorKey: CategoryColorKey;
  supportsPhotos: boolean;
  supportsTimer: boolean;
  /** Which detail experience opens when tapped */
  detailKind: 'food' | 'gym' | 'work' | 'movie' | 'sleep' | 'plant' | 'event' | 'generic';
  isCustom?: boolean;
}

export type RecurrenceFrequency = 'none' | 'daily' | 'weekdays' | 'weekly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** Stable identity shared by materialized occurrences in the same series. */
  seriesId?: string;
  /** 0 = Sunday … 6 = Saturday. Used when frequency is 'weekly'. */
  weekday?: number;
}

export interface Activity {
  id: string;
  /** Date key in YYYY-MM-DD */
  date: string;
  /** Calendar-style event without a clock time. */
  allDay?: boolean;
  title: string;
  categoryId: string;
  /** Minutes from midnight */
  startMinutes: number;
  durationMinutes: number;
  status: ActivityStatus;
  notes?: string;
  /** External guests invited through Google Calendar sync. */
  attendeeEmails?: string[];
  /** Short human summary shown on the card, e.g. "620 kcal · balanced" */
  summary?: string;
  photo?: string | number;
  /** Version of the foreground-isolation treatment applied to food photos. */
  photoProcessingVersion?: number;
  recurrence?: RecurrenceRule;
  /** Links generated plant-care activities back to their plant profile. */
  plantId?: string;
  careKind?: 'watering' | 'pruning';
  /** Links calendar entries generated from a travel plan back to that plan. */
  travelPlanId?: string;
  travelItemId?: string;
  /** Stable ownership/link metadata for two-way Google Calendar sync. */
  googleCalendar?: {
    calendarId: string;
    eventId: string;
    /** Google's stable parent id for one occurrence of a recurring event. */
    recurringEventId?: string;
    origin: 'google' | 'ontrack';
    lastSyncedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ── Food ────────────────────────────────────────────────────────────────

export type MealType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'pre-workout'
  | 'post-workout';

export interface FoodItem {
  id: string;
  name: string;
  portion: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  /** All available source nutrients, including vitamins and minerals. */
  nutrients?: NutrientValue[];
  sourceRefs?: string[];
  /** 0–1 detection confidence from AI, undefined for manual entries */
  confidence?: number;
}

export type NutritionSourceKind =
  | 'official-restaurant'
  | 'verified-menu'
  | 'usda'
  | 'ai-estimate'
  | 'manual';

export interface NutritionSource {
  id: string;
  kind: NutritionSourceKind;
  title: string;
  url?: string;
  accessedAt?: string;
}

export interface NutrientValue {
  id: string;
  name: string;
  amount?: number;
  unit: string;
  confidence?: number;
  estimated: boolean;
  sourceRef?: string;
}

export interface MealRecommendation {
  id: string;
  title: string;
  body: string;
  kind: 'balance' | 'target' | 'variety' | 'clinician';
}

export interface MealAnalysis {
  items: FoodItem[];
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  nutrients: NutrientValue[];
  sources: NutritionSource[];
  recommendations: MealRecommendation[];
  overallConfidence?: number;
  reviewRequired: boolean;
  /** Supportive, non-judgmental observations */
  observations: string[];
  disclaimer: string;
}

export interface Meal {
  activityId: string;
  mealType: MealType;
  name: string;
  photo?: string | number;
  /** Original user-selected photo retained for future processing improvements. */
  originalPhoto?: string;
  /** Version of the foreground-isolation treatment applied to `photo`. */
  photoProcessingVersion?: number;
  sourceKind?: 'photo' | 'link' | 'manual';
  sourceUrl?: string;
  /** Original AI output, never mutated after analysis */
  aiAnalysis?: MealAnalysis;
  /** User-corrected items; source of truth for display */
  items: FoodItem[];
  hungerBefore?: number;
  fullnessAfter?: number;
  notes?: string;
}

export type EquationSex = 'female' | 'male';
export type ActivityLevel = 'inactive' | 'low-active' | 'active' | 'very-active';
export type NutritionGoal = 'maintain' | 'lose' | 'gain';
export type UnitSystem = 'imperial' | 'metric';

export interface NutritionProfile {
  id: string;
  displayName: string;
  dateOfBirth: string;
  equationSex: EquationSex;
  heightCm?: number;
  weightKg?: number;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
  unitSystem: UnitSystem;
  dietaryPreferences: string[];
  allergies: string[];
  guardianAcknowledgedAt?: string;
  gestationalAgeWeeks?: number;
  feedingPattern?: 'breast-milk' | 'formula' | 'mixed' | 'solids';
  clinicianNotes?: string;
}

export interface NutritionTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  nutrients: NutrientValue[];
}

export interface NutritionTargetVersion {
  id: string;
  profileId: string;
  version: number;
  status: 'draft' | 'approved' | 'superseded';
  targets: NutritionTargets;
  calculatedTargets: NutritionTargets;
  authorRole: 'user' | 'guardian' | 'clinician';
  effectiveAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

// ── Workouts ────────────────────────────────────────────────────────────

export interface WorkoutSet {
  id: string;
  reps: number;
  weightKg: number;
  done: boolean;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  /** Semantic app icon name (see `design-system/icons`). Legacy records may hold raw SF Symbol names. */
  icon: string;
  sets: WorkoutSet[];
  restSeconds: number;
  note?: string;
  /** Best set from previous sessions, e.g. "60 kg × 8" */
  previousBest?: string;
}

export type WorkoutType = 'strength' | 'cardio' | 'mobility' | 'custom';

export interface Workout {
  activityId: string;
  type: WorkoutType;
  name: string;
  exercises: WorkoutExercise[];
  perceivedDifficulty?: number;
  notes?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface WorkoutRecommendation {
  name: string;
  reason: string;
  exercises: { name: string; icon: string; sets: number; reps: number; weightKg: number; restSeconds: number }[];
  disclaimer: string;
}

// ── Work ────────────────────────────────────────────────────────────────

export interface WorkTask {
  id: string;
  title: string;
  done: boolean;
  priority: 'low' | 'medium' | 'high';
  estimateMinutes?: number;
}

export interface WorkSession {
  activityId: string;
  tasks: WorkTask[];
  focusMinutes: number;
  notes?: string;
}

// ── Movies ────────────────────────────────────────────────────

export interface Movie {
  activityId: string;
  tmdbId: number;
  /** Missing on movie records saved before TV search was introduced. */
  mediaType?: 'movie' | 'tv';
  title: string;
  releaseDate?: string;
  posterUrl?: string;
  overview: string;
  runtimeMinutes?: number;
  genres: string[];
}

// ── AI summaries ────────────────────────────────────────────────────────

export interface DailySummary {
  headline: string;
  body: string;
  suggestion: string;
}

// ── Plants ─────────────────────────────────────────────────────────────

export type PlantHealthStatus = 'healthy' | 'watch' | 'urgent';
export type PruningUrgency = 'not-needed' | 'soon' | 'now';

export interface PlantIdentity {
  commonName: string;
  scientificName: string;
  confidence: number;
  /** AI suggestions must be explicitly confirmed or corrected before care planning. */
  identificationSource?: 'ai' | 'user-confirmed' | 'user-corrected';
}

export interface PlantHealthAssessment {
  status: PlantHealthStatus;
  summary: string;
  /** Features visible in the submitted image. */
  visibleSigns: string[];
  /** Possibilities only; never presented as a diagnosis. */
  possibleCauses: string[];
  actions: string[];
  confidence: number;
  assessedAt: string;
}

export interface PlantCareSource {
  title: string;
  url: string;
}

export interface WateringRecommendation {
  minMl: number;
  maxMl: number;
  intervalDays: number;
  soilCheck: string;
  notes: string;
}

export interface PruningRecommendation {
  urgency: PruningUrgency;
  reason: string;
  steps: string[];
}

export interface PlacementRecommendation {
  light: string;
  location: string;
  windowDistance: string;
  avoid: string[];
}

export interface SoilRecommendation {
  /** Named mix style, e.g. "Chunky aroid mix". */
  soilType: string;
  phMin: number;
  phMax: number;
  mixNotes: string;
  drainageNotes: string;
  amendments: string[];
}

export interface PlantCarePlan {
  watering: WateringRecommendation;
  pruning: PruningRecommendation;
  placement: PlacementRecommendation;
  /** Preferred potting mix, pH range, and drainage guidance for this species. */
  soil: SoilRecommendation;
  sources: PlantCareSource[];
  disclaimer: string;
  generatedAt: string;
}

export type WindowDirection = 'north' | 'east' | 'south' | 'west' | 'unknown';

export interface RoomProfile {
  potDiameterCm: number;
  drainage: 'yes' | 'no' | 'unknown';
  windowDirection: WindowDirection;
  windowDistanceM: number;
  directSunHours: number;
}

export interface WateringLog {
  id: string;
  wateredAt: string;
  amountMl?: number;
  activityId?: string;
  priorNextWateringAt: string;
}

export interface PlantCheckIn {
  id: string;
  photoUri: string;
  createdAt: string;
  assessment: PlantHealthAssessment;
  proposedCarePlan?: PlantCarePlan;
  carePlanAcceptedAt?: string;
}

export interface Plant {
  id: string;
  nickname: string;
  photoUri: string;
  identity: PlantIdentity;
  health: PlantHealthAssessment;
  carePlan: PlantCarePlan;
  room: RoomProfile;
  lastWateredAt?: string;
  nextWateringAt: string;
  /** Minutes from midnight in the device's local time. */
  reminderMinutes: number;
  notificationId?: string;
  wateringActivityId?: string;
  wateringLogs: WateringLog[];
  checkIns: PlantCheckIn[];
  createdAt: string;
  updatedAt: string;
}
