import { useMemo, useSyncExternalStore } from 'react';

import { useAddons } from '@/store/addons';
import { useFinance } from '@/store/finance';
import { useRecipes } from '@/store/food-recipes';
import { useFriends } from '@/store/friends';
import { useHealth } from '@/store/health';
import { useJournal } from '@/store/journal';
import { usePlants } from '@/store/plants';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useChecklists } from '@/store/todos';
import { useTravel } from '@/store/travel';
import { useVehicles } from '@/store/vehicles';
import { useVisionBoard } from '@/store/vision-board';

import { buildSearchDocuments, groupSearchDocuments } from './search-documents';
import type { SearchGroup } from './search-types';

let searchRevision = 0;

function subscribeSearchStores(onStoreChange: () => void): () => void {
  const bump = () => {
    searchRevision += 1;
    onStoreChange();
  };
  const unsubscribers = [
    useAddons.subscribe(bump),
    useChecklists.subscribe(bump),
    useSchedule.subscribe(bump),
    useTravel.subscribe(bump),
    useRecipes.subscribe(bump),
    usePlants.subscribe(bump),
    useFinance.subscribe(bump),
    useVehicles.subscribe(bump),
    useVisionBoard.subscribe(bump),
    useFriends.subscribe(bump),
    useJournal.subscribe(bump),
    useHealth.subscribe(bump),
    usePreferences.subscribe(bump),
  ];
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

function peekSearchRevision(): number {
  return searchRevision;
}

/** In-memory typeahead over screens + local entities. Empty query = screens only. */
export function useAppSearch(query: string): SearchGroup[] {
  const enabledAddons = useAddons((state) => state.enabled);
  const revision = useSyncExternalStore(
    subscribeSearchStores,
    peekSearchRevision,
    peekSearchRevision,
  );
  return useMemo(
    () => groupSearchDocuments(buildSearchDocuments({ enabledAddons, query })),
    [enabledAddons, query, revision],
  );
}
