import { Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { deleteAllVisionBoardImages } from '@/features/vision-board/media';
import { deletePlant } from '@/services/plants/schedule';
import { useAccountFlags } from '@/store/account-flags';
import { useHealth } from '@/store/health';
import { useNutrition } from '@/store/nutrition';
import { usePlants } from '@/store/plants';
import { usePreferences } from '@/store/preferences';

import { getSupabaseClient } from './supabase';
import { domains } from './sync-domains';
import { stopCloudSync, syncRuntime, useCloudSyncStatus } from './sync-session';

export async function deleteAppOwnedMedia(options?: {
  plants?: boolean;
  visionBoard?: boolean;
  mealImages?: boolean;
}) {
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
}

export async function clearLocalAccountData() {
  // First-run completion is device chrome, not account graph: wiping it on
  // sign-out forced the name/goal welcome canvas even when force-preview is off.
  const hadOnboarded = usePreferences.getState().hasOnboarded;
  syncRuntime.pendingRemote = undefined;
  stopCloudSync();
  await resetLocalDomains();
  useAccountFlags.getState().reset();
  useCloudSyncStatus.setState({
    state: getSupabaseClient() ? 'signed-out' : 'disabled',
    email: undefined,
    lastSyncedAt: undefined,
    message: undefined,
  });
  if (hadOnboarded) {
    usePreferences.setState({ hasOnboarded: true });
  }
}
