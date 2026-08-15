import { persist } from 'zustand/middleware';
import { createWithEqualityFn as create } from 'zustand/traditional';

import { DEFAULT_CATEGORIES, mergeDefaultCategories } from '@/constants/categories';
import { buildSeedData } from '@/constants/seed';
import type { GoogleCalendarDeletion } from '@/services/calendar/google-types';
import type {
    EventDetails,
    EventFollow,
    EventFollowMode,
    EventFollowSyncResponse,
    EventFollowTarget,
    EventSuggestion,
} from '@/services/events';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import type {
    Activity,
    ActivityCategory,
    ActivityStatus,
    Meal,
    Movie,
    Workout,
    WorkSession,
} from '@/types/models';
import { isAllDayActivity } from '@/utils/activity-time';
import { addDays, DAY_MS, fromDateKey, isDateKey } from '@/utils/date';
import { newId } from '@/utils/id';
import { createScheduleEventActions, eventSyncStateAfterSave } from './schedule-events';

export { newId } from '@/utils/id';

function calendarDeletion(activity: Activity): GoogleCalendarDeletion | undefined {
  const metadata = activity.googleCalendar;
  return metadata ? {
    activityId: activity.id,
    calendarId: metadata.calendarId,
    eventId: metadata.eventId,
    origin: metadata.origin,
  } : undefined;
}

function appendCalendarDeletions(
  current: GoogleCalendarDeletion[],
  removed: Activity[],
) {
  const next = new Map(current.map((deletion) => [deletion.activityId, deletion]));
  removed.forEach((activity) => {
    const deletion = calendarDeletion(activity);
    if (deletion) next.set(deletion.activityId, deletion);
  });
  return [...next.values()];
}

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

function activitySeriesId(activity: Activity | undefined) {
  if (!activity) return undefined;
  if (activity.googleCalendar?.recurringEventId) {
    return `google:${activity.googleCalendar.calendarId}:${activity.googleCalendar.recurringEventId}`;
  }
  return activity.recurrence?.seriesId
    ? `ontrack:${activity.recurrence.seriesId}`
    : undefined;
}

function cloneEventDetail<T extends { activityId: string }>(detail: T, activityId: string): T {
  const cloned = { ...detail, activityId } as T & {
    items?: unknown[];
    exercises?: { sets: unknown[] }[];
    tasks?: unknown[];
    genres?: string[];
  };
  if (cloned.items) cloned.items = cloned.items.map((item) => ({ ...(item as object) }));
  if (cloned.exercises) {
    cloned.exercises = cloned.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...(set as object) })),
    }));
  }
  if (cloned.tasks) cloned.tasks = cloned.tasks.map((task) => ({ ...(task as object) }));
  if (cloned.genres) cloned.genres = [...cloned.genres];
  return cloned;
}

export function migrateLegacyGoogleAllDayActivities(activities: Activity[]) {
  let changed = false;
  const migrated = activities.map((activity) => {
    if (activity.allDay !== undefined || !isAllDayActivity(activity)) return activity;
    changed = true;
    return { ...activity, allDay: true };
  });
  return changed ? migrated : activities;
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

export const useSchedule = create<ScheduleState>()(
  persist(
    (set, get) => ({
      seeded: false,
      activities: [],
      meals: [],
      workouts: [],
      workSessions: [],
      movies: [],
      eventDetails: [],
      eventFollows: [],
      eventSuggestions: [],
      suppressedExternalEvents: [],
      categories: DEFAULT_CATEGORIES,
      googleCalendarDeletions: [],

      seedIfNeeded: () => {
        if (get().seeded) return;
        const seed = buildSeedData();
        set({
          seeded: true,
          activities: seed.activities,
          meals: seed.meals,
          workouts: seed.workouts,
          workSessions: seed.workSessions,
          movies: [],
        });
      },

      addActivity: (draft) => {
        const now = new Date().toISOString();
        const activity: Activity = {
          id: newId(),
          status: 'upcoming',
          createdAt: now,
          updatedAt: now,
          ...draft,
        };
        set((s) => ({ activities: [...s.activities, activity] }));
        return activity;
      },

      replaceTravelActivities: (travelPlanId, drafts) => {
        const now = new Date().toISOString();
        const activities = drafts.map((draft) => ({
          id: newId('trip-event'),
          status: 'upcoming' as const,
          createdAt: now,
          updatedAt: now,
          ...draft,
          travelPlanId,
        }));
        set((state) => {
          const removed = state.activities.filter((activity) => activity.travelPlanId === travelPlanId);
          return {
            activities: [
              ...state.activities.filter((activity) => activity.travelPlanId !== travelPlanId),
              ...activities,
            ],
            googleCalendarDeletions: appendCalendarDeletions(state.googleCalendarDeletions, removed),
          };
        });
        return activities;
      },

      removeTravelActivities: (travelPlanIds) => {
        const removed = new Set(travelPlanIds);
        if (removed.size === 0) return;
        set((state) => {
          const removedActivities = state.activities.filter(
            (activity) => activity.travelPlanId && removed.has(activity.travelPlanId),
          );
          const activities = state.activities.filter(
            (activity) =>
              !activity.travelPlanId || !removed.has(activity.travelPlanId),
          );
          if (activities.length === state.activities.length) return state;
          return {
            activities,
            googleCalendarDeletions: appendCalendarDeletions(state.googleCalendarDeletions, removedActivities),
          };
        });
      },

      replaceGoogleCalendarActivities: (activities) =>
        set((state) => {
          // A sync response can arrive after the user deleted a linked event.
          // Keep that tombstone authoritative until the provider acknowledges it
          // so a stale response cannot briefly resurrect the activity.
          const pendingDeletionIds = new Set(
            state.googleCalendarDeletions.map((deletion) => deletion.activityId),
          );
          const acceptedActivities = activities.filter(
            (activity) => !pendingDeletionIds.has(activity.id),
          );
          const incomingIds = new Set(acceptedActivities.map((activity) => activity.id));
          const retained = state.activities.filter(
            (activity) => !activity.googleCalendar || incomingIds.has(activity.id),
          );
          const retainedIds = new Set(retained.map((activity) => activity.id));
          const currentById = new Map(state.activities.map((activity) => [activity.id, activity]));
          const reconciled = acceptedActivities.map((activity) => {
            const current = currentById.get(activity.id);
            if (!current || new Date(current.updatedAt).getTime() <= new Date(activity.updatedAt).getTime()) return activity;
            return {
              ...activity,
              ...current,
              googleCalendar: activity.googleCalendar ?? current.googleCalendar,
            };
          });
          return {
            activities: [
              ...retained.filter((activity) => !incomingIds.has(activity.id)),
              ...reconciled,
            ],
            meals: state.meals.filter((item) => retainedIds.has(item.activityId) || incomingIds.has(item.activityId)),
            workouts: state.workouts.filter((item) => retainedIds.has(item.activityId) || incomingIds.has(item.activityId)),
            workSessions: state.workSessions.filter((item) => retainedIds.has(item.activityId) || incomingIds.has(item.activityId)),
            movies: state.movies.filter((item) => retainedIds.has(item.activityId) || incomingIds.has(item.activityId)),
            eventDetails: state.eventDetails.filter((item) => retainedIds.has(item.activityId) || incomingIds.has(item.activityId)),
          };
        }),

      clearGoogleCalendarDeletions: (activityIds) =>
        set((state) => {
          if (!activityIds) return { googleCalendarDeletions: [] };
          const cleared = new Set(activityIds);
          return {
            googleCalendarDeletions: state.googleCalendarDeletions.filter(
              (deletion) => !cleared.has(deletion.activityId),
            ),
          };
        }),

      removeGoogleCalendarImports: () =>
        set((state) => {
          const removedIds = new Set(
            state.activities
              .filter((activity) => activity.googleCalendar?.origin === 'google')
              .map((activity) => activity.id),
          );
          return {
            activities: state.activities.filter(
              (activity) => activity.googleCalendar?.origin !== 'google',
            ),
            meals: state.meals.filter((item) => !removedIds.has(item.activityId)),
            workouts: state.workouts.filter((item) => !removedIds.has(item.activityId)),
            workSessions: state.workSessions.filter((item) => !removedIds.has(item.activityId)),
            movies: state.movies.filter((item) => !removedIds.has(item.activityId)),
            eventDetails: state.eventDetails.filter((item) => !removedIds.has(item.activityId)),
          };
        }),

      importEvents: (drafts) => {
        if (drafts.length === 0) throw new Error('Choose at least one event to import.');
        const categories = get().categories;
        const normalized = drafts.map((draft) => {
          const title = draft.title.trim();
          const category = categories.find((item) => item.id === draft.categoryId);
          if (!title) throw new Error('Every imported event needs a title.');
          if (!isDateKey(draft.date)) throw new Error('Every imported event needs a valid date.');
          if (
            !Number.isInteger(draft.startMinutes) ||
            draft.startMinutes < 0 ||
            draft.startMinutes > 1439
          ) {
            throw new Error('Every imported event needs a valid time.');
          }
          if (
            !Number.isFinite(draft.durationMinutes) ||
            draft.durationMinutes < 5
          ) {
            throw new Error('Every imported event needs a duration of at least 5 minutes.');
          }
          if (!category) throw new Error('Every imported event needs a valid category.');
          if (category.detailKind === 'movie' || category.detailKind === 'plant') {
            throw new Error(`${category.name} events must be created from their dedicated editor.`);
          }
          return {
            ...draft,
            title,
            durationMinutes: Math.round(draft.durationMinutes),
            notes: draft.notes?.trim() || undefined,
            category,
          };
        });

        const now = new Date().toISOString();
        const activities = normalized.map(({ category: _category, ...draft }) => ({
          id: newId('imported-event'),
          status: 'upcoming' as const,
          createdAt: now,
          updatedAt: now,
          ...draft,
        }));

        set((state) => {
          const meals = [...state.meals];
          const workouts = [...state.workouts];
          const workSessions = [...state.workSessions];
          activities.forEach((activity, index) => {
            const category = normalized[index].category;
            if (category.detailKind === 'food') {
              meals.push({
                activityId: activity.id,
                mealType: 'lunch',
                name: activity.title,
                items: [],
              });
            } else if (category.detailKind === 'gym') {
              workouts.push({
                activityId: activity.id,
                type: 'custom',
                name: activity.title,
                exercises: [],
              });
            } else if (category.detailKind === 'work') {
              workSessions.push({
                activityId: activity.id,
                tasks: [],
                focusMinutes: 0,
              });
            }
          });
          return {
            activities: [...state.activities, ...activities],
            meals,
            workouts,
            workSessions,
          };
        });
        return activities;
      },

      saveEvent: (payload) => {
        const now = new Date().toISOString();
        const existing = payload.id
          ? get().activities.find((activity) => activity.id === payload.id)
          : undefined;
        // Prefer an explicit payload id so __DEV__ fixtures can upsert stable keys.
        const id = existing?.id ?? payload.id ?? newId();
        const activity: Activity = {
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          ...(existing?.recurrence ? { recurrence: existing.recurrence } : {}),
          ...payload.activity,
          ...(existing?.googleCalendar ? { googleCalendar: existing.googleCalendar } : {}),
        };

        const seriesId = payload.editScope === 'series' ? activitySeriesId(existing) : undefined;
        const targetIds = new Set(
          seriesId
            ? get().activities
                .filter((item) => activitySeriesId(item) === seriesId)
                .map((item) => item.id)
            : [id],
        );
        const dateDelta = existing
          ? Math.round((fromDateKey(activity.date).getTime() - fromDateKey(existing.date).getTime()) / DAY_MS)
          : 0;

        const replaceDetails = <T extends { activityId: string }>(
          details: T[],
          next: T | undefined,
        ) => {
          const retained = details.filter((item) => !targetIds.has(item.activityId));
          return next
            ? [...retained, ...[...targetIds].map((activityId) => cloneEventDetail(next, activityId))]
            : retained;
        };

        set((state) => ({
          activities: existing
            ? state.activities.map((item) => {
                if (item.id === id) return activity;
                if (!targetIds.has(item.id)) return item;
                return {
                  ...item,
                  ...payload.activity,
                  id: item.id,
                  date: addDays(item.date, dateDelta),
                  status: item.status,
                  recurrence: item.recurrence,
                  googleCalendar: item.googleCalendar,
                  createdAt: item.createdAt,
                  updatedAt: now,
                };
              })
            : [...state.activities, activity],
          meals:
            payload.detailKind === 'food' && payload.meal
              ? replaceDetails(state.meals, payload.meal)
              : replaceDetails(state.meals, undefined),
          workouts:
            payload.detailKind === 'gym' && payload.workout
              ? replaceDetails(state.workouts, payload.workout)
              : replaceDetails(state.workouts, undefined),
          workSessions:
            payload.detailKind === 'work' && payload.workSession
              ? replaceDetails(state.workSessions, payload.workSession)
              : replaceDetails(state.workSessions, undefined),
          movies:
            payload.detailKind === 'movie' && payload.movie
              ? replaceDetails(state.movies, payload.movie)
              : replaceDetails(state.movies, undefined),
          eventDetails:
            payload.detailKind === 'event' && payload.event
              ? replaceDetails(state.eventDetails, {
                  ...payload.event,
                  syncState: eventSyncStateAfterSave(
                    existing,
                    state.eventDetails.find((detail) => detail.activityId === id),
                    payload.activity,
                  ),
                })
              : replaceDetails(state.eventDetails, undefined),
        }));

        return activity;
      },

      updateActivity: (id, patch) =>
        set((s) => ({
          activities: s.activities.map((a) =>
            a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a,
          ),
        })),

      deleteActivity: (id) =>
        set((s) => {
          const deleted = s.activities.find((activity) => activity.id === id);
          const deletedEvent = s.eventDetails.find((detail) => detail.activityId === id);
          const deletion = deleted ? calendarDeletion(deleted) : undefined;
          return {
            activities: s.activities.filter((a) => a.id !== id),
            meals: s.meals.filter((m) => m.activityId !== id),
            workouts: s.workouts.filter((w) => w.activityId !== id),
            workSessions: s.workSessions.filter((w) => w.activityId !== id),
            movies: s.movies.filter((movie) => movie.activityId !== id),
            eventDetails: s.eventDetails.filter((detail) => detail.activityId !== id),
            suppressedExternalEvents: (() => {
              if (!deletedEvent) return s.suppressedExternalEvents;
              const key = `${deletedEvent.provider}:${deletedEvent.providerEventId}`;
              return s.suppressedExternalEvents.includes(key)
                ? s.suppressedExternalEvents
                : [...s.suppressedExternalEvents, key];
            })(),
            googleCalendarDeletions: deletion && deleted
              ? appendCalendarDeletions(s.googleCalendarDeletions, [deleted])
              : s.googleCalendarDeletions,
          };
        }),

      setStatus: (id, status) => get().updateActivity(id, { status }),

      duplicateActivity: (id) => {
        const src = get().activities.find((a) => a.id === id);
        if (!src) return;
        const now = new Date().toISOString();
        const duplicateId = newId();
        const meal = get().meals.find((item) => item.activityId === id);
        const workout = get().workouts.find((item) => item.activityId === id);
        const workSession = get().workSessions.find((item) => item.activityId === id);
        const movie = get().movies.find((item) => item.activityId === id);
        const { googleCalendar: _googleCalendar, ...duplicateSource } = src;
        set((s) => ({
          activities: [
            ...s.activities,
            { ...duplicateSource, id: duplicateId, status: 'upcoming', createdAt: now, updatedAt: now },
          ],
          meals: meal
            ? [
                ...s.meals,
                {
                  ...meal,
                  activityId: duplicateId,
                  hungerBefore: undefined,
                  fullnessAfter: undefined,
                  items: meal.items.map((item) => ({ ...item })),
                },
              ]
            : s.meals,
          workouts: workout
            ? [
                ...s.workouts,
                {
                  ...workout,
                  activityId: duplicateId,
                  startedAt: undefined,
                  finishedAt: undefined,
                  exercises: workout.exercises.map((exercise) => ({
                    ...exercise,
                    sets: exercise.sets.map((set) => ({ ...set, done: false })),
                  })),
                },
              ]
            : s.workouts,
          workSessions: workSession
            ? [
                ...s.workSessions,
                {
                  ...workSession,
                  activityId: duplicateId,
                  focusMinutes: 0,
                  tasks: workSession.tasks.map((task) => ({ ...task, done: false })),
                },
              ]
            : s.workSessions,
          movies: movie
            ? [...s.movies, { ...movie, activityId: duplicateId, genres: [...movie.genres] }]
            : s.movies,
        }));
      },

      moveActivityToDate: (id, date) => get().updateActivity(id, { date, status: 'upcoming' }),

      upsertMeal: (meal) =>
        set((s) => ({
          meals: [...s.meals.filter((m) => m.activityId !== meal.activityId), meal],
        })),

      setProcessedMealPhoto: (activityId, photo, originalPhoto, version) =>
        set((state) => ({
          activities: state.activities.map((activity) =>
            activity.id === activityId
              ? { ...activity, photo, photoProcessingVersion: version, updatedAt: new Date().toISOString() }
              : activity,
          ),
          meals: state.meals.map((meal) =>
            meal.activityId === activityId
              ? {
                  ...meal,
                  photo,
                  originalPhoto: meal.originalPhoto ?? originalPhoto,
                  photoProcessingVersion: version,
                }
              : meal,
          ),
        })),

      upsertWorkout: (workout) =>
        set((s) => ({
          workouts: [...s.workouts.filter((w) => w.activityId !== workout.activityId), workout],
        })),

      upsertWorkSession: (session) =>
        set((s) => ({
          workSessions: [
            ...s.workSessions.filter((w) => w.activityId !== session.activityId),
            session,
          ],
        })),

      addCategory: (category) => set((s) => ({ categories: [...s.categories, category] })),
      ...createScheduleEventActions(get, set),

      resetAll: () =>
        set({
          seeded: false,
          activities: [],
          meals: [],
          workouts: [],
          workSessions: [],
          movies: [],
          eventDetails: [],
          eventFollows: [],
          eventSuggestions: [],
          suppressedExternalEvents: [],
          categories: DEFAULT_CATEGORIES,
          googleCalendarDeletions: [],
        }),
    }),
    {
      name: STORAGE_KEYS.schedule,
      storage: createPersistStorage(),
      version: 1,
      migrate: (persistedState, version) => {
        const persisted = persistedState as Partial<ScheduleState>;
        if (version >= 1 || !persisted.activities) return persisted;
        return {
          ...persisted,
          activities: migrateLegacyGoogleAllDayActivities(persisted.activities),
        };
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ScheduleState>;
        return {
          ...currentState,
          ...persisted,
          movies: persisted.movies ?? [],
          eventDetails: persisted.eventDetails ?? [],
          eventFollows: persisted.eventFollows ?? [],
          eventSuggestions: persisted.eventSuggestions ?? [],
          suppressedExternalEvents: persisted.suppressedExternalEvents ?? [],
          googleCalendarDeletions: persisted.googleCalendarDeletions ?? [],
          categories: mergeDefaultCategories(persisted.categories),
        };
      },
    },
  ),
);

// ── Selectors ───────────────────────────────────────────────────────────

export function selectActivitiesForDate(state: ScheduleState, date: string): Activity[] {
  return state.activities
    .filter((a) => a.date === date)
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

export function selectActivitiesByDate(state: ScheduleState): Record<string, Activity[]> {
  const map: Record<string, Activity[]> = {};
  for (const a of state.activities) {
    (map[a.date] ??= []).push(a);
  }
  return map;
}
