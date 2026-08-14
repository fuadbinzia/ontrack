import {
  AGENT_UI_DEMO_ACTIVITY_ID,
  AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
  AGENT_UI_DEMO_EVENT_ACTIVITY_ID,
  AGENT_UI_DEMO_EVENT_BOUT_ID,
  AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
  AGENT_UI_DEMO_GROCERY_TASK_TOMATOES_ID,
  AGENT_UI_DEMO_HEALTH_FACTOR_ID,
  AGENT_UI_DEMO_HEALTH_MOOD_ID,
  AGENT_UI_DEMO_HOME_LOCATION,
  AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
  AGENT_UI_DEMO_VEHICLE_ID,
  AGENT_UI_DEMO_VISION_CATEGORY_ID,
  AGENT_UI_DEMO_VISION_ITEM_ID,
  AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
  AGENT_UI_DEMO_WORKOUT_EXERCISE_ID,
  AGENT_UI_DEMO_WORKOUT_SET_ID,
  type AgentUiFixtureName,
} from './fixtures-constants';
import type { AgentUiSeedResult } from './fixtures-seed-types';
import { buildAgentUiDemoChecklist, buildAgentUiDemoGrocery, upsertTodoFixtureLists } from './fixtures-todos';

type DomainFixtureName = Exclude<
  AgentUiFixtureName,
  | 'travel-demo'
  | 'travel-map-demo'
  | 'travel-punta-cana'
  | 'travel-home'
  | 'travel-home-empty'
  | 'travel-restore-documents'
>;

/** Non-travel seed branches for `seedAgentUiFixture`. */
export function seedDomainAgentUiFixture(
  fixture: DomainFixtureName,
): AgentUiSeedResult | null {
  if (fixture === 'checklist-demo') {
    const built = buildAgentUiDemoChecklist();
    upsertTodoFixtureLists({
      lists: [built.list],
      tasks: built.tasks,
    });
    return {
      fixture,
      primaryId: built.list.id,
      listId: built.list.id,
      taskId: AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
    };
  }

  if (fixture === 'grocery-demo') {
    const built = buildAgentUiDemoGrocery();
    upsertTodoFixtureLists({
      lists: [built.list],
      tasks: built.tasks,
      recipes: [built.recipe],
    });
    return {
      fixture,
      primaryId: built.list.id,
      listId: built.list.id,
      recipeId: built.recipe.id,
      taskId: AGENT_UI_DEMO_GROCERY_TASK_TOMATOES_ID,
    };
  }

  if (fixture === 'health-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useHealth } = require('@/store/health') as typeof import('@/store/health');
    const health = useHealth.getState();
    const factorId = health.saveFactor({
      id: AGENT_UI_DEMO_HEALTH_FACTOR_ID,
      name: 'Work deadlines',
      category: 'situation',
      emotionIds: ['stressed'],
    });
    const moodEntryId = health.saveMoodEntry({
      id: AGENT_UI_DEMO_HEALTH_MOOD_ID,
      occurredAt: '2026-08-01T12:00:00.000Z',
      emotions: [{ emotionId: 'calm', intensity: 4 }],
      factorIds: [factorId],
      note: 'Stable agent fixture.',
      source: 'ontrack',
    });
    return {
      fixture,
      primaryId: moodEntryId,
      factorId,
      moodEntryId,
    };
  }

  if (fixture === 'vehicle-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vehiclesMod =
      require('@/store/vehicles') as typeof import('@/store/vehicles');
    const vehicle = vehiclesMod.createEmptyVehicle({
      id: AGENT_UI_DEMO_VEHICLE_ID,
      nickname: 'Demo Car',
      year: 2022,
      make: 'Honda',
      model: 'Civic',
      odometerMiles: 12000,
    });
    vehiclesMod.useVehicles.getState().saveVehicle(vehicle);
    return {
      fixture,
      primaryId: vehicle.id,
      vehicleId: vehicle.id,
    };
  }

  if (fixture === 'plants-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sample =
      require('@/features/plants/sample') as typeof import('@/features/plants/sample');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { usePlants } = require('@/store/plants') as typeof import('@/store/plants');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { todayKey } = require('@/utils/date') as typeof import('@/utils/date');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSchedule } = require('@/store/schedule') as typeof import('@/store/schedule');
    const plant = {
      ...sample.createSamplePlant(),
      wateringActivityId: AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
      // Fresh seed: no prior log so Undo appears only after Log Watering.
      wateringLogs: [] as [],
      lastWateredAt: undefined,
    };
    const reminderMinutes = plant.reminderMinutes ?? 9 * 60;
    const minMl = plant.carePlan?.watering?.minMl ?? 250;
    const maxMl = plant.carePlan?.watering?.maxMl ?? 400;
    useSchedule.getState().saveEvent({
      id: AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
      detailKind: 'plant',
      activity: {
        date: todayKey(),
        title: `Water ${plant.nickname}`,
        categoryId: 'plant',
        startMinutes: reminderMinutes,
        durationMinutes: 10,
        status: 'upcoming',
        photo: plant.photoUri,
        summary: `${Math.round(minMl)}–${Math.round(maxMl)} mL · check soil`,
        plantId: plant.id,
        careKind: 'watering',
      },
    });
    usePlants.setState((state) => ({
      plants: [
        plant,
        ...state.plants.filter((item) => item.id !== sample.SAMPLE_PLANT_ID),
      ],
      sampleVersion: Math.max(state.sampleVersion, sample.PLANT_SAMPLE_VERSION),
      sampleDismissed: false,
    }));
    return {
      fixture,
      primaryId: plant.id,
      plantId: plant.id,
      activityId: AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
    };
  }

  if (fixture === 'home-weather') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { usePreferences } =
      require('@/store/preferences') as typeof import('@/store/preferences');
    usePreferences.getState().setHomeLocation(AGENT_UI_DEMO_HOME_LOCATION);
    return {
      fixture,
      primaryId: AGENT_UI_DEMO_HOME_LOCATION,
    };
  }

  if (fixture === 'activity-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { todayKey } = require('@/utils/date') as typeof import('@/utils/date');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSchedule } =
      require('@/store/schedule') as typeof import('@/store/schedule');
    const activity = useSchedule.getState().saveEvent({
      id: AGENT_UI_DEMO_ACTIVITY_ID,
      detailKind: 'generic',
      activity: {
        title: 'Agent UI Mindfulness',
        categoryId: 'mindfulness',
        date: todayKey(),
        startMinutes: 9 * 60,
        durationMinutes: 30,
        status: 'upcoming',
        notes: 'Stable agent fixture.',
      },
    });
    return {
      fixture,
      primaryId: activity.id,
      activityId: activity.id,
    };
  }

  if (fixture === 'event-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { todayKey } = require('@/utils/date') as typeof import('@/utils/date');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSchedule } =
      require('@/store/schedule') as typeof import('@/store/schedule');
    const activity = useSchedule.getState().saveEvent({
      id: AGENT_UI_DEMO_EVENT_ACTIVITY_ID,
      detailKind: 'event',
      activity: {
        title: 'Agent UI Fight Night',
        categoryId: 'event',
        date: todayKey(),
        startMinutes: 21 * 60,
        durationMinutes: 240,
        status: 'upcoming',
      },
      event: {
        activityId: AGENT_UI_DEMO_EVENT_ACTIVITY_ID,
        provider: 'espn',
        providerEventId: 'event-agent-ui-demo',
        kind: 'sports',
        sourceName: 'Agent UI',
        participants: ['Alex Rivera', 'Jordan Lee'],
        bouts: [{
          providerCompetitionId: AGENT_UI_DEMO_EVENT_BOUT_ID,
          cardSection: 'main',
          weightClass: 'Welterweight',
          title: 'Agent UI Welterweight Title',
          status: 'Scheduled',
          fighters: [
            {
              providerAthleteId: 'fighter-agent-ui-alex',
              name: 'Alex Rivera',
              record: '18-1-0',
              age: 31,
              height: `5' 11"`,
              weight: '170 lbs',
              reach: '72"',
            },
            {
              providerAthleteId: 'fighter-agent-ui-jordan',
              name: 'Jordan Lee',
              record: '15-2-0',
              age: 29,
              height: `6' 1"`,
              weight: '170 lbs',
              reach: '74"',
            },
          ],
        }],
        venue: { name: 'Harbor Arena', city: 'Port City' },
        broadcasts: [],
        status: 'scheduled',
        importMode: 'manual',
        syncState: 'linked',
        lastSyncedAt: new Date().toISOString(),
      },
    });
    return {
      fixture,
      primaryId: activity.id,
      activityId: activity.id,
    };
  }

  if (fixture === 'food-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { todayKey } = require('@/utils/date') as typeof import('@/utils/date');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSchedule } =
      require('@/store/schedule') as typeof import('@/store/schedule');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedFoodDemoStores } =
      require('./fixtures-food') as typeof import('./fixtures-food');
    const { recipeId } = seedFoodDemoStores();

    const activity = useSchedule.getState().saveEvent({
      id: AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
      detailKind: 'food',
      activity: {
        title: 'Agent UI Meal',
        categoryId: 'food',
        date: todayKey(),
        startMinutes: 12 * 60,
        durationMinutes: 30,
        status: 'upcoming',
        notes: 'Stable agent meal fixture.',
      },
      meal: {
        activityId: AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
        mealType: 'lunch',
        name: 'Agent UI Meal',
        items: [],
      },
    });
    return {
      fixture,
      primaryId: activity.id,
      activityId: activity.id,
      recipeId,
    };
  }

  if (fixture === 'workouts-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { todayKey } = require('@/utils/date') as typeof import('@/utils/date');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSchedule } =
      require('@/store/schedule') as typeof import('@/store/schedule');
    const activity = useSchedule.getState().saveEvent({
      id: AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
      detailKind: 'gym',
      activity: {
        title: 'Agent UI Bench Press',
        categoryId: 'gym',
        date: todayKey(),
        startMinutes: 10 * 60,
        durationMinutes: 30,
        status: 'upcoming',
        summary: '1 exercise · 30 min',
        notes: 'Stable agent fixture.',
      },
      workout: {
        activityId: 'draft',
        type: 'strength',
        name: 'Agent UI Bench Press',
        exercises: [
          {
            id: AGENT_UI_DEMO_WORKOUT_EXERCISE_ID,
            name: 'Bench Press',
            icon: 'dumbbell.fill',
            restSeconds: 120,
            sets: [
              {
                id: AGENT_UI_DEMO_WORKOUT_SET_ID,
                reps: 8,
                weightKg: 0,
                done: false,
              },
            ],
          },
        ],
      },
    });
    return {
      fixture,
      primaryId: activity.id,
      activityId: activity.id,
    };
  }

  if (fixture === 'vision-board-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const defaults =
      require('@/features/vision-board/defaults') as typeof import('@/features/vision-board/defaults');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sample =
      require('@/features/vision-board/sample') as typeof import('@/features/vision-board/sample');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useVisionBoard } =
      require('@/store/vision-board') as typeof import('@/store/vision-board');
    const at = '2026-01-01T00:00:00.000Z';
    useVisionBoard.getState().replaceVisionBoardData(
      defaults.createDefaultVisionBoardCategories(at),
      sample.createSampleVisionBoardItems(at),
      at,
      sample.VISION_BOARD_SAMPLE_VERSION,
    );
    return {
      fixture,
      primaryId: AGENT_UI_DEMO_VISION_CATEGORY_ID,
      categoryId: AGENT_UI_DEMO_VISION_CATEGORY_ID,
      itemId: AGENT_UI_DEMO_VISION_ITEM_ID,
    };
  }

  return null;
}
