import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { STORAGE_KEYS } from '@/services/storage';
import { useSchedule } from '@/store/schedule';
import type { Activity, Meal, Movie, Workout, WorkSession } from '@/types/models';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

const activity: Activity = {
  id: 'event-1',
  date: '2026-07-10',
  title: 'Lunch',
  categoryId: 'food',
  startMinutes: 720,
  durationMinutes: 45,
  status: 'upcoming',
  createdAt: '2026-07-10T12:00:00.000Z',
  updatedAt: '2026-07-10T12:00:00.000Z',
};

const meal: Meal = {
  activityId: activity.id,
  mealType: 'lunch',
  name: 'Lunch',
  items: [],
};

describe('schedule event saves', () => {
  beforeEach(() => {
    useSchedule.setState({
      seeded: true,
      activities: [activity],
      meals: [meal],
      workouts: [],
      workSessions: [],
      movies: [],
    });
  });

  it('atomically updates an event and its compatible details', () => {
    useSchedule.getState().saveEvent({
      id: activity.id,
      detailKind: 'food',
      activity: {
        date: activity.date,
        title: 'Updated lunch',
        categoryId: 'food',
        startMinutes: 750,
        durationMinutes: 30,
        status: 'completed',
        summary: '420 kcal · 1 item',
      },
      meal: {
        ...meal,
        name: 'Updated lunch',
        items: [
          {
            id: 'food-1',
            name: 'Soup',
            portion: '1 bowl',
            calories: 420,
            proteinG: 15,
            carbsG: 50,
            fatG: 18,
          },
        ],
      },
    });

    const state = useSchedule.getState();
    expect(state.activities[0]).toMatchObject({ title: 'Updated lunch', startMinutes: 750 });
    expect(state.meals[0].items).toHaveLength(1);
  });

  it('persists guest emails with the event for calendar invitation sync', () => {
    useSchedule.getState().saveEvent({
      id: activity.id,
      detailKind: 'food',
      activity: {
        date: activity.date,
        title: activity.title,
        categoryId: activity.categoryId,
        startMinutes: activity.startMinutes,
        durationMinutes: activity.durationMinutes,
        status: activity.status,
        attendeeEmails: ['alex@example.com', 'jordan@example.com'],
      },
      meal,
    });

    expect(useSchedule.getState().activities[0].attendeeEmails).toEqual([
      'alex@example.com',
      'jordan@example.com',
    ]);
  });

  it('updates only the selected occurrence when a recurring edit uses single scope', () => {
    const first = {
      ...activity,
      googleCalendar: {
        calendarId: 'primary',
        eventId: 'occurrence-1',
        recurringEventId: 'series-1',
        origin: 'google' as const,
        lastSyncedAt: activity.updatedAt,
      },
    };
    const second = {
      ...first,
      id: 'event-2',
      date: '2026-07-17',
      googleCalendar: { ...first.googleCalendar, eventId: 'occurrence-2' },
    };
    useSchedule.setState({ activities: [first, second], meals: [], workouts: [], workSessions: [], movies: [] });

    useSchedule.getState().saveEvent({
      id: first.id,
      editScope: 'single',
      detailKind: 'generic',
      activity: {
        date: first.date,
        title: 'One changed sync',
        categoryId: first.categoryId,
        startMinutes: first.startMinutes,
        durationMinutes: first.durationMinutes,
        status: first.status,
      },
    });

    expect(useSchedule.getState().activities).toEqual([
      expect.objectContaining({ id: first.id, title: 'One changed sync' }),
      expect.objectContaining({ id: second.id, title: second.title }),
    ]);
  });

  it('updates every occurrence in the chosen recurring series and preserves per-event status', () => {
    const first = {
      ...activity,
      googleCalendar: {
        calendarId: 'primary',
        eventId: 'occurrence-1',
        recurringEventId: 'series-1',
        origin: 'google' as const,
        lastSyncedAt: activity.updatedAt,
      },
    };
    const second = {
      ...first,
      id: 'event-2',
      date: '2026-07-17',
      status: 'completed' as const,
      googleCalendar: { ...first.googleCalendar, eventId: 'occurrence-2' },
    };
    const unrelated = {
      ...first,
      id: 'event-3',
      date: '2026-07-17',
      googleCalendar: {
        ...first.googleCalendar,
        eventId: 'occurrence-3',
        recurringEventId: 'series-2',
      },
    };
    useSchedule.setState({ activities: [first, second, unrelated], meals: [], workouts: [], workSessions: [], movies: [] });

    useSchedule.getState().saveEvent({
      id: first.id,
      editScope: 'series',
      detailKind: 'generic',
      activity: {
        date: '2026-07-11',
        title: 'Changed weekly sync',
        categoryId: first.categoryId,
        startMinutes: 780,
        durationMinutes: 30,
        status: first.status,
        notes: 'New agenda',
      },
    });

    expect(useSchedule.getState().activities).toEqual([
      expect.objectContaining({ id: first.id, date: '2026-07-11', title: 'Changed weekly sync', startMinutes: 780 }),
      expect.objectContaining({ id: second.id, date: '2026-07-18', title: 'Changed weekly sync', status: 'completed' }),
      expect.objectContaining({ id: unrelated.id, date: unrelated.date, title: unrelated.title }),
    ]);
  });

  it('copies meal details when duplicating a food event', () => {
    useSchedule.getState().duplicateActivity(activity.id);
    const state = useSchedule.getState();
    expect(state.activities).toHaveLength(2);
    expect(state.meals).toHaveLength(2);
    expect(state.meals[1]).toMatchObject({
      activityId: state.activities[1].id,
      name: 'Lunch',
      mealType: 'lunch',
    });
    expect(state.meals[1].items).not.toBe(meal.items);
  });

  it('resets execution state when duplicating completed sessions', () => {
    const workoutActivity: Activity = {
      ...activity,
      id: 'workout-event',
      categoryId: 'gym',
      status: 'completed',
    };
    const workActivity: Activity = {
      ...activity,
      id: 'work-event',
      categoryId: 'work',
      status: 'completed',
    };
    const workout: Workout = {
      activityId: workoutActivity.id,
      type: 'strength',
      name: 'Strength',
      startedAt: '2026-07-10T12:00:00.000Z',
      finishedAt: '2026-07-10T12:45:00.000Z',
      exercises: [{
        id: 'exercise-1',
        name: 'Squat',
        icon: 'figure-strengthtraining-traditional',
        restSeconds: 60,
        sets: [{ id: 'set-1', reps: 8, weightKg: 60, done: true }],
      }],
    };
    const workSession: WorkSession = {
      activityId: workActivity.id,
      focusMinutes: 45,
      tasks: [{ id: 'work-task-1', title: 'Outline', done: true, priority: 'high' }],
    };
    useSchedule.setState({
      activities: [workoutActivity, workActivity],
      meals: [],
      workouts: [workout],
      workSessions: [workSession],
      movies: [],
    });

    useSchedule.getState().duplicateActivity(workoutActivity.id);
    useSchedule.getState().duplicateActivity(workActivity.id);

    const state = useSchedule.getState();
    expect(state.activities.slice(2).every((item) => item.status === 'upcoming')).toBe(true);
    expect(state.workouts[1]).toMatchObject({
      startedAt: undefined,
      finishedAt: undefined,
      exercises: [{ sets: [{ done: false }] }],
    });
    expect(state.workSessions[1]).toMatchObject({
      focusMinutes: 0,
      tasks: [{ done: false }],
    });
  });

  it('removes incompatible detail records after a type change', () => {
    useSchedule.getState().saveEvent({
      id: activity.id,
      detailKind: 'work',
      activity: {
        date: activity.date,
        title: 'Planning',
        categoryId: 'work',
        startMinutes: activity.startMinutes,
        durationMinutes: activity.durationMinutes,
        status: activity.status,
      },
      workSession: {
        activityId: activity.id,
        focusMinutes: 0,
        tasks: [{ id: 'task-1', title: 'Outline', done: false, priority: 'high' }],
      },
    });

    const state = useSchedule.getState();
    expect(state.meals).toHaveLength(0);
    expect(state.workSessions).toHaveLength(1);
    expect(state.activities[0].categoryId).toBe('work');
  });

  it('keeps processed meal photos in sync with their activity thumbnails', () => {
    useSchedule.setState({
      activities: [{ ...activity, photo: 'file:///original.jpg' }],
      meals: [{ ...meal, photo: 'file:///original.jpg' }],
    });

    useSchedule.getState().setProcessedMealPhoto(
      activity.id,
      'file:///meal-images/meal-event-1-v1.png',
      'file:///original.jpg',
      1,
    );

    const state = useSchedule.getState();
    expect(state.activities[0]).toMatchObject({
      photo: 'file:///meal-images/meal-event-1-v1.png',
      photoProcessingVersion: 1,
    });
    expect(state.meals[0]).toMatchObject({
      photo: 'file:///meal-images/meal-event-1-v1.png',
      originalPhoto: 'file:///original.jpg',
      photoProcessingVersion: 1,
    });
  });
});

describe('movie event details', () => {
  const movieActivity: Activity = { ...activity, id: 'movie-event', title: 'Arrival', categoryId: 'movie' };
  const movie: Movie = {
    activityId: movieActivity.id,
    tmdbId: 329865,
    title: 'Arrival',
    releaseDate: '2016-11-10',
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    overview: 'A linguist works with the military to communicate with alien lifeforms.',
    runtimeMinutes: 116,
    genres: ['Drama', 'Science Fiction'],
  };

  beforeEach(() => {
    useSchedule.setState({
      seeded: true,
      activities: [movieActivity],
      meals: [],
      workouts: [],
      workSessions: [],
      movies: [movie],
    });
  });

  it('updates and replaces movie details with its event', () => {
    useSchedule.getState().saveEvent({
      id: movieActivity.id,
      detailKind: 'movie',
      activity: { ...movieActivity, title: 'Dune', categoryId: 'movie' },
      movie: { ...movie, tmdbId: 438631, title: 'Dune', runtimeMinutes: 155 },
    });
    expect(useSchedule.getState().movies).toEqual([
      expect.objectContaining({ activityId: movieActivity.id, tmdbId: 438631, title: 'Dune' }),
    ]);
  });

  it('copies movie metadata when duplicating an event', () => {
    useSchedule.getState().duplicateActivity(movieActivity.id);
    const state = useSchedule.getState();
    expect(state.activities).toHaveLength(2);
    expect(state.movies).toHaveLength(2);
    expect(state.movies[1]).toMatchObject({ activityId: state.activities[1].id, tmdbId: movie.tmdbId });
    expect(state.movies[1].genres).not.toBe(movie.genres);
  });

  it('deletes movie metadata with its event', () => {
    useSchedule.getState().deleteActivity(movieActivity.id);
    expect(useSchedule.getState().movies).toHaveLength(0);
  });
});

describe('schedule persistence migrations', () => {
  it('marks legacy Google midnight whole-day records as all-day', async () => {
    const legacyGoogleAllDay: Activity = {
      ...activity,
      id: 'legacy-google-all-day',
      startMinutes: 0,
      durationMinutes: 24 * 60,
      googleCalendar: {
        calendarId: 'primary',
        eventId: 'google-event-1',
        origin: 'google',
        lastSyncedAt: activity.updatedAt,
      },
    };
    const localMidnightEvent: Activity = {
      ...legacyGoogleAllDay,
      id: 'local-midnight-event',
      googleCalendar: undefined,
    };
    await mockAsyncStorage.setItem(
      STORAGE_KEYS.schedule,
      JSON.stringify({
        state: {
          seeded: true,
          activities: [legacyGoogleAllDay, localMidnightEvent],
          meals: [],
          workouts: [],
          workSessions: [],
          movies: [],
          categories: DEFAULT_CATEGORIES,
        },
        version: 0,
      }),
    );

    await useSchedule.persist.rehydrate();

    const migrated = useSchedule.getState().activities;
    expect(migrated[0]).toEqual(expect.objectContaining({
      id: legacyGoogleAllDay.id,
      allDay: true,
    }));
    expect(migrated[1]).toEqual(expect.objectContaining({ id: localMidnightEvent.id }));
    expect(migrated[1]).not.toHaveProperty('allDay');
  });

  it('adds newly shipped categories to an existing saved schedule', async () => {
    await mockAsyncStorage.setItem(
      STORAGE_KEYS.schedule,
      JSON.stringify({
        state: {
          seeded: true,
          activities: [],
          meals: [],
          workouts: [],
          workSessions: [],
          categories: DEFAULT_CATEGORIES.filter((category) => category.id !== 'movie'),
        },
        version: 0,
      }),
    );

    await useSchedule.persist.rehydrate();

    expect(useSchedule.getState().categories.some((category) => category.id === 'movie')).toBe(true);
    expect(useSchedule.getState().movies).toEqual([]);
  });
});
