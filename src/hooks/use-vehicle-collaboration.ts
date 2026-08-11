import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import {
  removeRuntimeActivity,
  setRuntimeActivity,
} from '@/features/performance/runtime-activity';
import {
  flushVehicleMutations,
  loadAllSharedVehicles,
  loadVehicleSnapshot,
  subscribeToVehicle,
} from '@/services/vehicles/collaboration';
import { useVehicles } from '@/store/vehicles';

export function useVehicleCollaboration(enabled: boolean) {
  const vehicles = useVehicles((state) => state.vehicles);
  const sharedVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.mode === 'shared'),
    [vehicles],
  );
  const pendingCount = useVehicles((state) => state.pendingMutations.length);
  const sharedKey = useMemo(
    () =>
      sharedVehicles
        .map((vehicle) => vehicle.id)
        .sort()
        .join(','),
    [sharedVehicles],
  );

  useEffect(() => {
    if (!enabled) return;
    setRuntimeActivity(
      { id: 'sync.vehicles', label: 'Shared vehicle sync', category: 'sync' },
      {
        status: 'running',
        pending: pendingCount,
        detail: `${sharedVehicles.length} shared vehicles`,
      },
    );
    return () => removeRuntimeActivity('sync.vehicles');
  }, [enabled, pendingCount, sharedVehicles.length]);

  useEffect(() => {
    if (!enabled) return;
    void loadAllSharedVehicles().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void loadAllSharedVehicles().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !pendingCount) return;
    void flushVehicleMutations().catch(() => undefined);
  }, [enabled, pendingCount]);

  useEffect(() => {
    if (!enabled) return;
    const channels = sharedVehicles.flatMap((vehicle) => {
      const channel = subscribeToVehicle(vehicle, () => {
        void (async () => {
          const hasPending = () =>
            useVehicles
              .getState()
              .pendingMutations.some(
                (mutation) => mutation.vehicleId === vehicle.id,
              );
          if (hasPending()) {
            await flushVehicleMutations().catch(() => undefined);
            if (hasPending()) return;
          }
          await loadVehicleSnapshot(vehicle.id).catch(() => {
            useVehicles.getState().removeSharedVehicle(vehicle.id);
          });
        })();
      });
      return channel ? [channel] : [];
    });
    return () => {
      channels.forEach((channel) => {
        void channel.unsubscribe();
      });
    };
  }, [enabled, sharedKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
