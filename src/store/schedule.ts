import { persist } from 'zustand/middleware';
import { createWithEqualityFn as create } from 'zustand/traditional';

import { DEFAULT_CATEGORIES, mergeDefaultCategories } from '@/constants/categories';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import type { Activity } from '@/types/models';
import { addDays, DAY_MS, fromDateKey, isDateKey } from '@/utils/date';
import { newId } from '@/utils/id';

import {
  activitySeriesId,
  appendCalendarDeletions,
  calendarDeletion,
  cloneEventDetail,
  migrateLegacyGoogleAllDayActivities,
  stripLegacySeedData,
} from './schedule-helpers';
import { createScheduleEventActions, eventSyncStateAfterSave } from './schedule-events';
import type { ScheduleState } from './schedule-types';

export { newId } from '@/utils/id';
export {
  migrateLegacyGoogleAllDayActivities,
  selectActivitiesByDate,
  selectActivitiesForDate,
} from './schedule-helpers';
export type {
  ActivityDraft,
  EventSavePayload,
  ImportedEventDraft,
  ScheduleState,
} from './schedule-types';

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
        set({
          seeded: true,
          activities: [],
          meals: [],
          workouts: [],
          workSessions: [],
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
      version: 2,
      migrate: (persistedState, version) => {
        const persisted = persistedState as Partial<ScheduleState>;
        if (!persisted.activities) return persisted;
        let next = persisted;
        const activities = persisted.activities;
        if (version < 1) {
          next = {
            ...next,
            activities: migrateLegacyGoogleAllDayActivities(activities),
          };
        }
        if (version < 2) {
          next = {
            ...stripLegacySeedData(next),
            seeded: true,
          };
        }
        return next;
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
