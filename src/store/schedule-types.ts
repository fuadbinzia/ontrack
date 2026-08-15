import type { GoogleCalendarDeletion } from '@/services/calendar/google-types';
import type {
  EventDetails,
  EventFollow,
  EventFollowMode,
  EventFollowSyncResponse,
  EventFollowTarget,
  EventSuggestion,
} from '@/services/events';
import type {
  Activity,
  ActivityCategory,
  ActivityStatus,
  Meal,
  Movie,
  Workout,
  WorkSession,
} from '@/types/models';

export interface ActivityDraft {
  date: string;
  allDay?: boolean;
  title: string;
  categoryId: string;
  startMinutes: number;
  durationMinutes: number;
  notes?: string;
  attendeeEmails?: string[];
  travelPlanId?: string;
  travelItemId?: string;
}

export interface EventSavePayload {
  id?: string;
  /** Defaults to one occurrence. Series updates require a stable series identity. */
  editScope?: 'single' | 'series';
  activity: ActivityDraft & {
    status: ActivityStatus;
    photo?: string | number;
    photoProcessingVersion?: number;
    summary?: string;
    plantId?: string;
    careKind?: Activity['careKind'];
  };
  detailKind: ActivityCategory['detailKind'];
  meal?: Meal;
  workout?: Workout;
  workSession?: WorkSession;
  movie?: Movie;
  event?: EventDetails;
}

export interface ImportedEventDraft {
  title: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  notes?: string;
  categoryId: string;
}

export interface ScheduleState {
  seeded: boolean;
  activities: Activity[];
  meals: Meal[];
  workouts: Workout[];
  workSessions: WorkSession[];
  movies: Movie[];
  eventDetails: EventDetails[];
  eventFollows: EventFollow[];
  eventSuggestions: EventSuggestion[];
  suppressedExternalEvents: string[];
  categories: ActivityCategory[];
  googleCalendarDeletions: GoogleCalendarDeletion[];

  seedIfNeeded: () => void;
  addActivity: (draft: ActivityDraft) => Activity;
  replaceTravelActivities: (travelPlanId: string, drafts: ActivityDraft[]) => Activity[];
  removeTravelActivities: (travelPlanIds: readonly string[]) => void;
  replaceGoogleCalendarActivities: (activities: Activity[]) => void;
  clearGoogleCalendarDeletions: (activityIds?: string[]) => void;
  removeGoogleCalendarImports: () => void;
  importEvents: (drafts: ImportedEventDraft[]) => Activity[];
  saveEvent: (payload: EventSavePayload) => Activity;
  updateActivity: (id: string, patch: Partial<Omit<Activity, 'id' | 'createdAt'>>) => void;
  deleteActivity: (id: string) => void;
  setStatus: (id: string, status: ActivityStatus) => void;
  duplicateActivity: (id: string) => void;
  moveActivityToDate: (id: string, date: string) => void;
  upsertMeal: (meal: Meal) => void;
  setProcessedMealPhoto: (activityId: string, photo: string, originalPhoto: string, version: number) => void;
  upsertWorkout: (workout: Workout) => void;
  upsertWorkSession: (session: WorkSession) => void;
  addCategory: (category: ActivityCategory) => void;
  addEventFollow: (target: EventFollowTarget, mode: EventFollowMode) => EventFollow;
  removeEventFollow: (id: string, removeFuture: boolean) => void;
  applyEventFollowSync: (response: EventFollowSyncResponse) => void;
  markEventFollowSyncError: (followIds: readonly string[], message: string) => void;
  acceptEventSuggestion: (id: string) => Activity | undefined;
  dismissEventSuggestion: (id: string) => void;
  resetAll: () => void;
}
