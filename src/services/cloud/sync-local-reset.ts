import { Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { deleteAllVisionBoardImages } from '@/features/vision-board/media';
import { clearFlightConfirmationAIMemory } from '@/services/travel/flight-confirmation-ai-memory';
import { removePersistedStorageItems, STORAGE_KEYS } from '@/services/storage';
import { deletePlant } from '@/services/plants/schedule';
import { useAccountFlags } from '@/store/account-flags';
import { useFoodProfile } from '@/store/food-profile';
import { useFinanceEzPassStatements } from '@/store/finance-ezpass-statements';
import { useFlowAnalytics } from '@/store/flow-analytics';
import { useMealPlan } from '@/store/food-meal-plan';
import { usePantry } from '@/store/food-pantry';
import { useRecipes } from '@/store/food-recipes';
import { useHealth } from '@/store/health';
import { useJournal } from '@/store/journal';
import { useNutrition } from '@/store/nutrition';
import { usePlants } from '@/store/plants';
import { restoreAppearance, snapshotAppearance } from '@/store/appearance-sync';
import { usePreferences } from '@/store/preferences';
import { useThemeOverrides } from '@/store/theme-overrides';
import { useTravelMap } from '@/store/travel-map';
import { useTravelPlanUi } from '@/store/travel-plan-ui';
import { useUsageAnalytics } from '@/store/usage-analytics';

import { getSupabaseClient } from './supabase';
import { domains } from './sync-domains';
import { stopCloudSync, syncRuntime, useCloudSyncStatus } from './sync-session';

export async function deleteAppOwnedMedia(options?: {
  plants?: boolean;
  visionBoard?: boolean;
  mealImages?: boolean;
}) {
  const clearEveryDirectory = options == null;
  const clearPlants = options?.plants ?? true;
  const clearVisionBoard = options?.visionBoard ?? true;
  const clearMealImages = options?.mealImages ?? clearPlants;
  const plants = clearPlants ? [...usePlants.getState().plants] : [];
  await Promise.all([
    ...plants.map((plant) => deletePlant(plant.id)),
    clearVisionBoard ? deleteAllVisionBoardImages() : Promise.resolve(),
  ]);
  if (Platform.OS === 'web') return;
  const directories = [
    ...(clearPlants ? ['plants'] : []),
    ...(clearMealImages ? ['meal-images'] : []),
    ...(clearEveryDirectory ? ['recipe-images'] : []),
    ...(clearEveryDirectory ? ['profile-avatars'] : []),
    ...(clearEveryDirectory ? ['travel-confirmations'] : []),
    ...(clearEveryDirectory ? ['travel-moments'] : []),
    ...(clearEveryDirectory ? ['finance-docs'] : []),
    ...(clearEveryDirectory ? ['journal-voice'] : []),
  ];
  for (const name of directories) {
    const directory = new Directory(Paths.document, name);
    if (directory.exists) {
      try {
        await directory.delete();
      } catch {
        // Best-effort cleanup; store references are cleared below.
      }
    }
  }
}

export async function resetLocalDomains() {
  syncRuntime.stopSubscriptions?.();
  syncRuntime.stopSubscriptions = undefined;
  await deleteAppOwnedMedia();
  domains.forEach((domain) => domain.reset());
  useNutrition.getState().reset();
  // Device-only Health stays off cloud sync, but must not leak across accounts
  // on the same device after sign-out / delete / unexpected session expiry.
  useHealth.getState().reset();
  useJournal.getState().reset();
  useFinanceEzPassStatements.getState().reset();
  useFoodProfile.getState().reset();
  usePantry.getState().reset();
  useRecipes.getState().reset();
  useMealPlan.getState().reset();
  useTravelMap.getState().reset();
  useTravelPlanUi.getState().reset();
  useThemeOverrides.getState().resetAll();
  useThemeOverrides.getState().clearHistory();
  useUsageAnalytics.getState().resetLocal();
  useFlowAnalytics.getState().reset();
  await clearFlightConfirmationAIMemory();

  // Removing the backing values as well as resetting live stores prevents an
  // interrupted reset or a stale hydration from resurrecting account data.
  await removePersistedStorageItems([
    STORAGE_KEYS.schedule,
    STORAGE_KEYS.plants,
    STORAGE_KEYS.addons,
    STORAGE_KEYS.agents,
    STORAGE_KEYS.travel,
    STORAGE_KEYS.travelMap,
    STORAGE_KEYS.travelPlanUi,
    STORAGE_KEYS.checklists,
    STORAGE_KEYS.visionBoard,
    STORAGE_KEYS.vehicles,
    STORAGE_KEYS.finance,
    STORAGE_KEYS.financeEzPassStatements,
    STORAGE_KEYS.foodProfile,
    STORAGE_KEYS.foodPantry,
    STORAGE_KEYS.foodRecipes,
    STORAGE_KEYS.foodMealPlan,
    STORAGE_KEYS.themeOverrides,
    STORAGE_KEYS.usageAnalytics,
    STORAGE_KEYS.flowAnalytics,
  ]);
  await removePersistedStorageItems(
    [STORAGE_KEYS.health, STORAGE_KEYS.journal, STORAGE_KEYS.flightParserMemory],
    { sensitive: true },
  );
}

export async function clearLocalAccountData(options?: {
  markSignedOut?: boolean;
  preserveAccountFlags?: boolean;
}) {
  // First-run completion and appearance are device chrome, not account graph:
  // wiping them on sign-out reset the welcome canvas and the chosen theme
  // before cloud restore could put them back.
  const hadOnboarded = usePreferences.getState().hasOnboarded;
  const appearance = snapshotAppearance();
  syncRuntime.pendingRemote = undefined;
  stopCloudSync();
  await resetLocalDomains();
  if (!options?.preserveAccountFlags) useAccountFlags.getState().reset();
  if (options?.markSignedOut ?? true) {
    useCloudSyncStatus.setState({
      state: getSupabaseClient() ? 'signed-out' : 'disabled',
      email: undefined,
      lastSyncedAt: undefined,
      message: undefined,
    });
  }
  restoreAppearance(appearance, { hasOnboarded: hadOnboarded });
}
