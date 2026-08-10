import {
    AGENT_UI_DEMO_ACTIVITY_ID,
    AGENT_UI_DEMO_CHASE_OUTBOUND_ID,
    AGENT_UI_DEMO_CHASE_RETURN_ID,
    AGENT_UI_DEMO_CHECKLIST_LIST_ID,
    AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
    AGENT_UI_DEMO_FLIGHT_ID,
    AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
    AGENT_UI_DEMO_GROCERY_LIST_ID,
    AGENT_UI_DEMO_GROCERY_RECIPE_ID,
    AGENT_UI_DEMO_HEALTH_FACTOR_ID,
    AGENT_UI_DEMO_HEALTH_MOOD_ID,
    AGENT_UI_DEMO_PLANT_ID,
    AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
    AGENT_UI_DEMO_TRIP_ID,
    AGENT_UI_PUNTA_CANA_STAY_ID,
    AGENT_UI_PUNTA_CANA_TRIP_ID,
    AGENT_UI_DEMO_VEHICLE_ID,
    AGENT_UI_DEMO_VISION_CATEGORY_ID,
    AGENT_UI_DEMO_VISION_ITEM_ID,
    AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
    AGENT_UI_DEMO_WORKOUT_CATALOG_EXERCISE_ID,
    AGENT_UI_FIXTURE_NAMES,
    buildAgentUiDemoChecklist,
    buildAgentUiDemoGrocery,
    buildAgentUiDemoTrip,
    buildAgentUiPuntaCanaTrip,
    buildTravelHomeVisualTrips,
    createIdFromAgentUiItemIds,
    formatAgentUiSeedDetail,
    normalizeFixtureName,
    seedAgentUiFixture,
} from '../fixtures';
import { normalizeTravelPlan } from '@/features/travel/normalize';
import { resolveTravelCoTravelerPeople } from '@/features/travel/travel-cotraveler-people';
import {
    AGENT_UI_WAIT_TIMEOUT_MS,
    listAgentUiFlowNames,
    resolveAgentUiFlow,
} from '../flows';

const mockSavePlan = jest.fn(() => true);
const mockRecordPlanInteraction = jest.fn();
const mockReplacePlans = jest.fn();
const mockTodosSetState = jest.fn();
const mockSaveFactor = jest.fn(() => AGENT_UI_DEMO_HEALTH_FACTOR_ID);
const mockSaveMoodEntry = jest.fn(() => AGENT_UI_DEMO_HEALTH_MOOD_ID);
const mockSaveVehicle = jest.fn();
const mockPlantsSetState = jest.fn();
const mockSaveEvent = jest.fn((payload: { id?: string }) => ({
  id: payload.id ?? 'activity-random',
}));
const mockReplaceVisionBoardData = jest.fn();

jest.mock('@/features/account/dev-mode-controller', () => ({
  ensureDevModeSandboxSync: jest.fn(),
}));

const mockSetTabBarCollapsed = jest.fn();

jest.mock('@/store/travel', () => ({
  useTravel: {
    getState: () => ({
      savePlan: mockSavePlan,
      recordPlanInteraction: mockRecordPlanInteraction,
      replacePlans: mockReplacePlans,
    }),
  },
}));

jest.mock('@/store/ui', () => ({
  useUI: {
    getState: () => ({
      setTabBarCollapsed: mockSetTabBarCollapsed,
    }),
  },
}));

jest.mock('@/store/todos', () => ({
  useTodos: {
    setState: mockTodosSetState,
  },
}));

jest.mock('@/store/health', () => ({
  useHealth: {
    getState: () => ({
      saveFactor: mockSaveFactor,
      saveMoodEntry: mockSaveMoodEntry,
    }),
  },
}));

jest.mock('@/store/vehicles', () => ({
  createEmptyVehicle: (input: { id?: string; nickname: string }) => ({
    id: input.id ?? 'vehicle-random',
    nickname: input.nickname,
  }),
  useVehicles: {
    getState: () => ({
      saveVehicle: mockSaveVehicle,
    }),
  },
}));

jest.mock('@/features/plants/sample', () => ({
  SAMPLE_PLANT_ID: 'plant-sample-monstera',
  PLANT_SAMPLE_VERSION: 2,
  createSamplePlant: () => ({ id: 'plant-sample-monstera', nickname: 'Monstera' }),
}));

jest.mock('@/store/plants', () => ({
  usePlants: {
    setState: mockPlantsSetState,
  },
}));

jest.mock('@/utils/date', () => ({
  ...jest.requireActual('@/utils/date'),
  todayKey: () => '2026-08-05',
}));

const mockReplaceFoodProfile = jest.fn();
const mockPantryAddItem = jest.fn();
const mockUpsertRecipe = jest.fn();
const mockMealPlanAddEntry = jest.fn();

jest.mock('@/store/food-profile', () => ({
  useFoodProfile: {
    getState: () => ({ replaceProfile: mockReplaceFoodProfile }),
  },
}));

jest.mock('@/store/food-pantry', () => ({
  usePantry: {
    getState: () => ({ addItem: mockPantryAddItem }),
  },
}));

jest.mock('@/store/food-recipes', () => ({
  useRecipes: {
    getState: () => ({ upsertRecipe: mockUpsertRecipe }),
  },
}));

jest.mock('@/store/food-meal-plan', () => ({
  useMealPlan: {
    getState: () => ({ addEntry: mockMealPlanAddEntry }),
  },
}));

jest.mock('@/store/schedule', () => ({
  useSchedule: {
    getState: () => ({
      saveEvent: mockSaveEvent,
    }),
  },
}));

jest.mock('@/features/vision-board/defaults', () => ({
  createDefaultVisionBoardCategories: () => [
    { id: 'vision-mindset', name: 'Mindset' },
  ],
}));

jest.mock('@/features/vision-board/sample', () => ({
  VISION_BOARD_SAMPLE_VERSION: 3,
  createSampleVisionBoardItems: () => [
    { id: 'vision-sample-forest', categoryId: 'vision-mindset' },
  ],
}));

jest.mock('@/store/vision-board', () => ({
  useVisionBoard: {
    getState: () => ({
      replaceVisionBoardData: mockReplaceVisionBoardData,
    }),
  },
}));

describe('agent-ui fixtures', () => {
  beforeEach(() => {
    mockSavePlan.mockClear();
    mockRecordPlanInteraction.mockClear();
    mockSavePlan.mockReturnValue(true);
    mockTodosSetState.mockClear();
    mockSaveFactor.mockClear();
    mockSaveMoodEntry.mockClear();
    mockSaveVehicle.mockClear();
    mockPlantsSetState.mockClear();
    mockSaveEvent.mockClear();
    mockReplaceVisionBoardData.mockClear();
  });

  it('builds a stable demo trip', () => {
    const plan = buildAgentUiDemoTrip('2026-01-02T00:00:00.000Z');
    expect(plan.id).toBe(AGENT_UI_DEMO_TRIP_ID);
    expect(plan.itinerary[0]?.id).toBe(AGENT_UI_DEMO_FLIGHT_ID);
    expect(normalizeFixtureName('travel-demo')).toBe('travel-demo');
    expect(normalizeFixtureName('demo')).toBe('travel-demo');
    expect(normalizeFixtureName('nope')).toBeNull();
  });

  it('seeds the demo trip into the travel store', () => {
    const result = seedAgentUiFixture('travel-demo');
    expect(result).toEqual({
      fixture: 'travel-demo',
      primaryId: AGENT_UI_DEMO_TRIP_ID,
      planId: AGENT_UI_DEMO_TRIP_ID,
      flightItemId: AGENT_UI_DEMO_FLIGHT_ID,
    });
    expect(mockSavePlan).toHaveBeenCalledTimes(1);
    expect(mockRecordPlanInteraction).toHaveBeenCalledWith(AGENT_UI_DEMO_TRIP_ID);
  });

  it('builds and seeds the Airbnb Punta Cana stay mock', () => {
    const year = new Date('2026-08-09T12:00:00.000Z').getFullYear();
    const plan = buildAgentUiPuntaCanaTrip('2026-08-09T12:00:00.000Z');
    expect(plan.id).toBe(AGENT_UI_PUNTA_CANA_TRIP_ID);
    expect(plan.startDate).toBe(`${year}-08-10`);
    expect(plan.endDate).toBe(`${year}-08-14`);
    expect(plan.itinerary.map((item) => item.kind)).toEqual([
      'flight',
      'stay',
      'flight',
    ]);
    expect(
      plan.itinerary.find((item) => item.id === AGENT_UI_PUNTA_CANA_STAY_ID),
    ).toMatchObject({
      kind: 'stay',
      details: expect.stringContaining('La Altagracia'),
      stay: {
        checkoutDate: `${year}-08-14`,
        checkoutMinutes: 10 * 60,
        notes: 'Hosted by Lisbeth',
      },
    });
    expect(
      plan.itinerary.find((item) => item.kind === 'flight' && item.date === `${year}-08-10`),
    ).toMatchObject({
      flight: {
        departureAirport: 'JFK',
        arrivalAirport: 'SDQ',
        flightNumber: 'B6 2709',
      },
    });
    expect(normalizeFixtureName('punta-cana')).toBe('travel-punta-cana');
    mockSavePlan.mockClear();
    mockRecordPlanInteraction.mockClear();
    expect(seedAgentUiFixture('travel-punta-cana')).toEqual({
      fixture: 'travel-punta-cana',
      primaryId: AGENT_UI_PUNTA_CANA_TRIP_ID,
      planId: AGENT_UI_PUNTA_CANA_TRIP_ID,
      itemId: AGENT_UI_PUNTA_CANA_STAY_ID,
    });
    expect(resolveAgentUiFlow('travel-punta-cana')?.[1]).toMatchObject({
      op: 'seed',
      to: 'travel-punta-cana',
    });
  });

  it('seeds travel-home visual trips with Iceland first', () => {
    mockSavePlan.mockClear();
    mockRecordPlanInteraction.mockClear();
    mockSetTabBarCollapsed.mockClear();
    const result = seedAgentUiFixture('travel-home');
    expect(result).toEqual({
      fixture: 'travel-home',
      primaryId: 'trip-travel-home-iceland',
      planId: 'trip-travel-home-iceland',
    });
    expect(mockSavePlan).toHaveBeenCalledTimes(3);
    expect(mockRecordPlanInteraction).toHaveBeenLastCalledWith(
      'trip-travel-home-iceland',
    );
    expect(mockSetTabBarCollapsed).toHaveBeenCalledWith(false);
    expect(normalizeFixtureName('travel-home')).toBe('travel-home');
    expect(resolveAgentUiFlow('travel-home')?.[1]).toMatchObject({
      op: 'seed',
      to: 'travel-home',
    });
    expect(resolveAgentUiFlow('travel-home-iceland')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'seed', to: 'travel-home' }),
        expect.objectContaining({
          op: 'goto',
          to: 'travel/trip-travel-home-iceland',
        }),
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.travel.chrome.skyDecor',
        }),
      ]),
    );
  });

  it('keeps travel-home co-travelers through normalize (Antigua 1+4)', () => {
    const antigua = buildTravelHomeVisualTrips().find(
      (plan) => plan.id === 'trip-travel-home-antigua',
    );
    expect(antigua).toBeTruthy();
    const normalized = normalizeTravelPlan(antigua);
    expect(normalized?.participants).toHaveLength(4);
    for (const person of normalized?.participants ?? []) {
      expect(person.inviteCode).toMatch(/^[a-f0-9]{20}$/);
    }
    expect(resolveTravelCoTravelerPeople(normalized!, 'You')).toHaveLength(5);
  });

  it('seeds travel-home-empty by clearing plans', () => {
    mockReplacePlans.mockClear();
    mockSetTabBarCollapsed.mockClear();
    const result = seedAgentUiFixture('travel-home-empty');
    expect(result).toEqual({
      fixture: 'travel-home-empty',
      primaryId: 'travel-home-empty',
    });
    expect(mockReplacePlans).toHaveBeenCalledWith([]);
    expect(mockSetTabBarCollapsed).toHaveBeenCalledWith(false);
    expect(normalizeFixtureName('travel-empty')).toBe('travel-home-empty');
    expect(resolveAgentUiFlow('travel-home-empty')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'seed', to: 'travel-home-empty' }),
        expect.objectContaining({ op: 'goto', to: 'travel' }),
        expect.objectContaining({
          op: 'wait',
          id: 'ontrack.travel.list.empty.create',
        }),
      ]),
    );
  });

  it('builds and seeds checklist / grocery / health / vehicle fixtures', () => {
    const checklist = buildAgentUiDemoChecklist();
    expect(checklist.list.id).toBe(AGENT_UI_DEMO_CHECKLIST_LIST_ID);
    expect(checklist.tasks[0]?.id).toBe(AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID);

    const grocery = buildAgentUiDemoGrocery();
    expect(grocery.list.id).toBe(AGENT_UI_DEMO_GROCERY_LIST_ID);
    expect(grocery.recipe.id).toBe(AGENT_UI_DEMO_GROCERY_RECIPE_ID);

    expect(normalizeFixtureName('checklist')).toBe('checklist-demo');
    expect(normalizeFixtureName('grocery-demo')).toBe('grocery-demo');
    expect(normalizeFixtureName('health')).toBe('health-demo');
    expect(normalizeFixtureName('vehicle-demo')).toBe('vehicle-demo');
    expect(AGENT_UI_FIXTURE_NAMES).toEqual(
      expect.arrayContaining([
        'travel-demo',
        'travel-punta-cana',
        'checklist-demo',
        'grocery-demo',
        'health-demo',
        'vehicle-demo',
      ]),
    );

    expect(seedAgentUiFixture('checklist-demo')).toMatchObject({
      fixture: 'checklist-demo',
      listId: AGENT_UI_DEMO_CHECKLIST_LIST_ID,
      primaryId: AGENT_UI_DEMO_CHECKLIST_LIST_ID,
    });
    expect(mockTodosSetState).toHaveBeenCalled();

    expect(seedAgentUiFixture('grocery-demo')).toMatchObject({
      fixture: 'grocery-demo',
      recipeId: AGENT_UI_DEMO_GROCERY_RECIPE_ID,
    });

    expect(seedAgentUiFixture('health-demo')).toEqual({
      fixture: 'health-demo',
      primaryId: AGENT_UI_DEMO_HEALTH_MOOD_ID,
      factorId: AGENT_UI_DEMO_HEALTH_FACTOR_ID,
      moodEntryId: AGENT_UI_DEMO_HEALTH_MOOD_ID,
    });
    expect(mockSaveFactor).toHaveBeenCalledWith(
      expect.objectContaining({ id: AGENT_UI_DEMO_HEALTH_FACTOR_ID }),
    );

    expect(seedAgentUiFixture('vehicle-demo')).toEqual({
      fixture: 'vehicle-demo',
      primaryId: AGENT_UI_DEMO_VEHICLE_ID,
      vehicleId: AGENT_UI_DEMO_VEHICLE_ID,
    });
    expect(mockSaveVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ id: AGENT_UI_DEMO_VEHICLE_ID }),
    );

    expect(seedAgentUiFixture('plants-demo')).toEqual({
      fixture: 'plants-demo',
      primaryId: AGENT_UI_DEMO_PLANT_ID,
      plantId: AGENT_UI_DEMO_PLANT_ID,
      activityId: AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
    });
    expect(mockPlantsSetState).toHaveBeenCalled();
    expect(mockSaveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
        detailKind: 'plant',
      }),
    );

    expect(seedAgentUiFixture('activity-demo')).toEqual({
      fixture: 'activity-demo',
      primaryId: AGENT_UI_DEMO_ACTIVITY_ID,
      activityId: AGENT_UI_DEMO_ACTIVITY_ID,
    });
    expect(mockSaveEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: AGENT_UI_DEMO_ACTIVITY_ID }),
    );

    expect(seedAgentUiFixture('food-demo')).toEqual({
      fixture: 'food-demo',
      primaryId: AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
      activityId: AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
      recipeId: 'recipe-agent-ui-food-chicken-tagine',
    });
    expect(mockSaveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
        detailKind: 'food',
      }),
    );
    // food-demo hydrates all four food stores.
    expect(mockReplaceFoodProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        dietaryPreferences: expect.arrayContaining(['halal']),
        allergies: expect.arrayContaining([
          expect.objectContaining({ allergen: 'Peanuts', severity: 'severe' }),
        ]),
      }),
    );
    expect(mockPantryAddItem).toHaveBeenCalled();
    expect(mockUpsertRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'recipe-agent-ui-food-chicken-tagine' }),
    );
    expect(mockMealPlanAddEntry).toHaveBeenCalled();

    expect(seedAgentUiFixture('workouts-demo')).toEqual({
      fixture: 'workouts-demo',
      primaryId: AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
      activityId: AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
    });
    expect(mockSaveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
        detailKind: 'gym',
      }),
    );

    expect(seedAgentUiFixture('vision-board-demo')).toEqual({
      fixture: 'vision-board-demo',
      primaryId: AGENT_UI_DEMO_VISION_CATEGORY_ID,
      categoryId: AGENT_UI_DEMO_VISION_CATEGORY_ID,
      itemId: AGENT_UI_DEMO_VISION_ITEM_ID,
    });
    expect(mockReplaceVisionBoardData).toHaveBeenCalled();

    expect(
      formatAgentUiSeedDetail({
        fixture: 'checklist-demo',
        primaryId: AGENT_UI_DEMO_CHECKLIST_LIST_ID,
        listId: AGENT_UI_DEMO_CHECKLIST_LIST_ID,
        taskId: AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
      }),
    ).toContain('listId=');
  });
});

describe('agent-ui stable createId', () => {
  it('consumes ordered agentUiItemIds then falls back', () => {
    let fallback = 0;
    const next = createIdFromAgentUiItemIds(
      [AGENT_UI_DEMO_CHASE_OUTBOUND_ID, AGENT_UI_DEMO_CHASE_RETURN_ID],
      () => `fallback-${++fallback}`,
    );
    expect(next()).toBe(AGENT_UI_DEMO_CHASE_OUTBOUND_ID);
    expect(next()).toBe(AGENT_UI_DEMO_CHASE_RETURN_ID);
    expect(next()).toBe('fallback-1');
    expect(
      createIdFromAgentUiItemIds(undefined, () => 'random')(),
    ).toBe('random');
  });
});

