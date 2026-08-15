import {
  clearLocalAccountData,
  deleteAppOwnedMedia,
  resetLocalDomains,
} from '@/services/cloud/sync-local-reset';
import { STORAGE_KEYS } from '@/services/storage';

const mockDeletedDirectories: string[] = [];
const mockDeleteVisionImages = jest.fn();
const mockDeletePlant = jest.fn();
const mockRemovePersistedStorageItems = jest.fn();
const mockClearFlightMemory = jest.fn();
const mockStopCloudSync = jest.fn();
const mockCloudStatusSetState = jest.fn();

const mockResetAddons = jest.fn();
const mockResetFoodProfile = jest.fn();
const mockResetMealPlan = jest.fn();
const mockResetPantry = jest.fn();
const mockResetRecipes = jest.fn();
const mockResetHealth = jest.fn();
const mockResetJournal = jest.fn();
const mockResetNutrition = jest.fn();
const mockResetPlants = jest.fn();
const mockResetPreferences = jest.fn();
const mockResetTheme = jest.fn();
const mockClearThemeHistory = jest.fn();
const mockResetTravelMap = jest.fn();
const mockResetTravelPlanUi = jest.fn();
const mockResetUsage = jest.fn();
const mockResetFlowAnalytics = jest.fn();
const mockResetAccountFlags = jest.fn();
const mockSetPreferences = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: { document: '/documents' },
  Directory: class MockDirectory {
    exists = true;
    name: string;

    constructor(_root: string, name: string) {
      this.name = name;
    }

    async delete() {
      mockDeletedDirectories.push(this.name);
    }
  },
}));

jest.mock('@/features/vision-board/media', () => ({
  deleteAllVisionBoardImages: (...args: unknown[]) => mockDeleteVisionImages(...args),
}));
jest.mock('@/services/plants/schedule', () => ({
  deletePlant: (...args: unknown[]) => mockDeletePlant(...args),
}));
jest.mock('@/services/travel/flight-confirmation-ai-memory', () => ({
  clearFlightConfirmationAIMemory: (...args: unknown[]) => mockClearFlightMemory(...args),
}));
jest.mock('@/services/storage', () => {
  const actual = jest.requireActual('@/services/storage');
  return {
    ...actual,
    removePersistedStorageItems: (...args: unknown[]) => mockRemovePersistedStorageItems(...args),
  };
});

jest.mock('@/store/account-flags', () => ({
  useAccountFlags: { getState: () => ({ reset: mockResetAccountFlags }) },
}));
jest.mock('@/store/food-profile', () => ({
  useFoodProfile: { getState: () => ({ reset: mockResetFoodProfile }) },
}));
jest.mock('@/store/food-meal-plan', () => ({
  useMealPlan: { getState: () => ({ reset: mockResetMealPlan }) },
}));
jest.mock('@/store/food-pantry', () => ({
  usePantry: { getState: () => ({ reset: mockResetPantry }) },
}));
jest.mock('@/store/food-recipes', () => ({
  useRecipes: { getState: () => ({ reset: mockResetRecipes }) },
}));
jest.mock('@/store/health', () => ({
  useHealth: { getState: () => ({ reset: mockResetHealth }) },
}));
jest.mock('@/store/journal', () => ({
  useJournal: { getState: () => ({ reset: mockResetJournal }) },
}));
jest.mock('@/store/nutrition', () => ({
  useNutrition: { getState: () => ({ reset: mockResetNutrition }) },
}));
jest.mock('@/store/plants', () => ({
  usePlants: {
    getState: () => ({
      plants: [{ id: 'plant-1' }, { id: 'plant-2' }],
      reset: mockResetPlants,
    }),
  },
}));
jest.mock('@/store/preferences', () => ({
  usePreferences: {
    getState: () => ({ hasOnboarded: true, resetAll: mockResetPreferences }),
    setState: (...args: unknown[]) => mockSetPreferences(...args),
  },
}));
jest.mock('@/store/theme-overrides', () => ({
  useThemeOverrides: {
    getState: () => ({ resetAll: mockResetTheme, clearHistory: mockClearThemeHistory }),
  },
}));
jest.mock('@/store/travel-map', () => ({
  useTravelMap: { getState: () => ({ reset: mockResetTravelMap }) },
}));
jest.mock('@/store/travel-plan-ui', () => ({
  useTravelPlanUi: { getState: () => ({ reset: mockResetTravelPlanUi }) },
}));
jest.mock('@/store/usage-analytics', () => ({
  useUsageAnalytics: { getState: () => ({ resetLocal: mockResetUsage }) },
}));
jest.mock('@/store/flow-analytics', () => ({
  useFlowAnalytics: { getState: () => ({ reset: mockResetFlowAnalytics }) },
}));

jest.mock('@/services/cloud/supabase', () => ({ getSupabaseClient: () => ({}) }));
jest.mock('@/services/cloud/sync-domains', () => ({
  domains: [
    { name: 'addons', reset: (...args: unknown[]) => mockResetAddons(...args) },
    { name: 'plants', reset: (...args: unknown[]) => mockResetPlants(...args) },
    { name: 'preferences', reset: (...args: unknown[]) => mockResetPreferences(...args) },
  ],
}));
jest.mock('@/services/cloud/sync-session', () => ({
  stopCloudSync: (...args: unknown[]) => mockStopCloudSync(...args),
  syncRuntime: { stopSubscriptions: jest.fn(), pendingRemote: new Map() },
  useCloudSyncStatus: {
    setState: (...args: unknown[]) => mockCloudStatusSetState(...args),
  },
}));

describe('local account data reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeletedDirectories.length = 0;
    mockDeleteVisionImages.mockResolvedValue(undefined);
    mockDeletePlant.mockResolvedValue(undefined);
    mockRemovePersistedStorageItems.mockResolvedValue(undefined);
    mockClearFlightMemory.mockResolvedValue(undefined);
  });

  it('resets every user-content store, sensitive memory, and persisted backing value', async () => {
    await resetLocalDomains();

    for (const [name, reset] of [
      ['addons', mockResetAddons],
      ['food profile', mockResetFoodProfile],
      ['meal plan', mockResetMealPlan],
      ['pantry', mockResetPantry],
      ['recipes', mockResetRecipes],
      ['health', mockResetHealth],
      ['journal', mockResetJournal],
      ['nutrition', mockResetNutrition],
      ['plants', mockResetPlants],
      ['preferences', mockResetPreferences],
      ['theme', mockResetTheme],
      ['theme history', mockClearThemeHistory],
      ['travel map', mockResetTravelMap],
      ['travel plan UI', mockResetTravelPlanUi],
      ['usage analytics', mockResetUsage],
      ['flow analytics', mockResetFlowAnalytics],
    ] as const) {
      if (!reset.mock.calls.length) throw new Error(`${name} was not reset`);
    }
    expect(mockDeletePlant).toHaveBeenCalledTimes(2);
    expect(mockClearFlightMemory).toHaveBeenCalledTimes(1);
    expect(new Set(mockDeletedDirectories)).toEqual(
      new Set([
        'plants',
        'meal-images',
        'recipe-images',
        'profile-avatars',
        'travel-confirmations',
        'travel-moments',
        'finance-docs',
        'journal-voice',
      ]),
    );

    const regularKeys = mockRemovePersistedStorageItems.mock.calls[0][0] as string[];
    expect(regularKeys).toEqual(
      expect.arrayContaining([
        STORAGE_KEYS.foodProfile,
        STORAGE_KEYS.foodPantry,
        STORAGE_KEYS.foodRecipes,
        STORAGE_KEYS.foodMealPlan,
        STORAGE_KEYS.finance,
        STORAGE_KEYS.travelMap,
        STORAGE_KEYS.travelPlanUi,
        STORAGE_KEYS.themeOverrides,
        STORAGE_KEYS.usageAnalytics,
        STORAGE_KEYS.flowAnalytics,
      ]),
    );
    expect(mockRemovePersistedStorageItems).toHaveBeenNthCalledWith(
      2,
      [STORAGE_KEYS.health, STORAGE_KEYS.journal, STORAGE_KEYS.flightParserMemory],
      { sensitive: true },
    );
  });

  it('does not delete unrelated document folders during a partial cloud hydrate', async () => {
    await deleteAppOwnedMedia({ plants: true, visionBoard: false, mealImages: false });

    expect(mockDeletedDirectories).toEqual(['plants']);
    expect(mockDeleteVisionImages).not.toHaveBeenCalled();
  });

  it('can retain signed-in account flags and cloud status while clearing content', async () => {
    await clearLocalAccountData({ markSignedOut: false, preserveAccountFlags: true });

    expect(mockStopCloudSync).toHaveBeenCalled();
    expect(mockResetAccountFlags).not.toHaveBeenCalled();
    expect(mockCloudStatusSetState).not.toHaveBeenCalled();
    expect(mockSetPreferences).toHaveBeenCalledWith({ hasOnboarded: true });
  });
});
