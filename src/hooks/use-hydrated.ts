import { useEffect, useState } from 'react';

import { settleDevModeAfterRehydrate } from '@/features/account/dev-mode-controller';
import { useAddons } from '@/store/addons';
import { useAgents } from '@/store/agents';
import { useAuthAccess } from '@/store/auth-access';
import { useDevMode } from '@/store/dev-mode';
import { useHealth } from '@/store/health';
import { useJournal } from '@/store/journal';
import { usePlants } from '@/store/plants';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useChecklists } from '@/store/todos';
import { useTravel } from '@/store/travel';
import { useVehicles } from '@/store/vehicles';
import { useVisionBoard } from '@/store/vision-board';

/**
 * Survives Fast Refresh remounts so RootNavigator does not tear down the
 * Stack and bounce back to the default landing tab.
 */
let sessionHydrated = false;

async function rehydrateStore(
  rehydrate: () => Promise<unknown> | unknown,
): Promise<void> {
  try {
    await Promise.resolve(rehydrate());
  } catch {
    // Keep booting on empty/default state rather than white-screening.
  }
}

/**
 * True only after every persisted store has finished rehydrating from disk.
 * Auth prepare/sign-out wipes must not race a late persist.setState — so we
 * never seal while any rehydrate is still in flight (no timeout escape hatch).
 */
export function useHydrated(): boolean {
  // Keep the server and first browser render identical, then release the
  // loading shell at one deterministic point when all stores are ready.
  // Remounts in the same JS session start hydrated to preserve navigation.
  const [hydrated, setHydrated] = useState(sessionHydrated);

  useEffect(() => {
    if (sessionHydrated) {
      setHydrated(true);
      return;
    }

    let active = true;
    const release = () => {
      // Only seal the session after a mount that is still alive. A remount
      // during in-flight rehydrate must await its own Promise.all — otherwise
      // sessionHydrated=true would skip disk restore on the next mount.
      if (!active) return;
      sessionHydrated = true;
      setHydrated(true);
    };

    void Promise.all([
      rehydrateStore(() => usePreferences.persist.rehydrate()),
      rehydrateStore(() => useSchedule.persist.rehydrate()),
      rehydrateStore(() => usePlants.persist.rehydrate()),
      rehydrateStore(() => useAddons.persist.rehydrate()),
      rehydrateStore(() => useTravel.persist.rehydrate()),
      rehydrateStore(() => useAgents.persist.rehydrate()),
      rehydrateStore(() => useAuthAccess.persist.rehydrate()),
      rehydrateStore(() => useChecklists.persist.rehydrate()),
      rehydrateStore(() => useVisionBoard.persist.rehydrate()),
      rehydrateStore(() => useVehicles.persist.rehydrate()),
      rehydrateStore(() => useHealth.persist.rehydrate()),
      rehydrateStore(() => useJournal.persist.rehydrate()),
      rehydrateStore(() => useDevMode.persist.rehydrate()),
    ]).then(async () => {
      // Dev Mode must not stick across cold start (off by default for testers).
      await settleDevModeAfterRehydrate();
      release();
    });

    return () => {
      active = false;
    };
  }, []);

  return hydrated;
}
