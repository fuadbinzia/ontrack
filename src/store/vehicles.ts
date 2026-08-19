import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  mergePrivateVehiclesFromCloud,
  normalizeVehicle,
  normalizeVehicles,
  privateVehiclePayload,
} from '@/features/vehicles/normalize';
import type {
  Vehicle,
  VehicleActivityEvent,
  VehicleExpense,
  VehicleInsurance,
  VehicleMaintenanceLog,
  VehicleMaintenanceSchedule,
  VehicleMileageLog,
  VehiclePart,
  VehicleRegistration,
} from '@/features/vehicles/types';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { newUuid } from '@/utils/id';

export type { Vehicle };
export { mergePrivateVehiclesFromCloud, privateVehiclePayload };

const MAX_LOCAL_ACTIVITY = 100;

interface VehiclesState {
  vehicles: Vehicle[];
  pendingMutations: VehiclePendingMutation[];
  saveVehicle: (vehicle: Vehicle) => void;
  removeVehicle: (id: string) => void;
  replaceVehicles: (vehicles: Vehicle[]) => void;
  replaceSharedVehicle: (vehicle: Vehicle) => void;
  removeSharedVehicle: (id: string) => void;
  appendLocalActivity: (
    vehicleId: string,
    event: Omit<VehicleActivityEvent, 'id' | 'createdAt'> & {
      id?: string;
      createdAt?: string;
    },
  ) => void;
  enqueueMutation: (mutation: Omit<VehiclePendingMutation, 'id' | 'createdAt'>) => void;
  clearPendingMutations: (ids: string[]) => void;
  reset: () => void;
}

export type VehicleMutationOp =
  | { type: 'upsert_vehicle'; vehicle: Vehicle }
  | { type: 'delete_vehicle'; vehicleId: string }
  | {
      type: 'upsert_schedule';
      vehicleId: string;
      schedule: VehicleMaintenanceSchedule;
    }
  | { type: 'delete_schedule'; vehicleId: string; scheduleId: string }
  | { type: 'upsert_maintenance_log'; vehicleId: string; log: VehicleMaintenanceLog }
  | { type: 'delete_maintenance_log'; vehicleId: string; logId: string }
  | { type: 'upsert_mileage'; vehicleId: string; log: VehicleMileageLog }
  | { type: 'delete_mileage'; vehicleId: string; logId: string }
  | { type: 'upsert_expense'; vehicleId: string; expense: VehicleExpense }
  | { type: 'delete_expense'; vehicleId: string; expenseId: string }
  | { type: 'upsert_part'; vehicleId: string; part: VehiclePart }
  | { type: 'delete_part'; vehicleId: string; partId: string }
  | {
      type: 'set_docs';
      vehicleId: string;
      registration?: VehicleRegistration;
      insurance?: VehicleInsurance;
    };

export interface VehiclePendingMutation {
  id: string;
  vehicleId: string;
  createdAt: string;
  op: VehicleMutationOp;
}

function touch(vehicle: Vehicle, patch: Partial<Vehicle> = {}): Vehicle {
  return {
    ...vehicle,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

function withActivity(
  vehicle: Vehicle,
  event: Omit<VehicleActivityEvent, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  },
): Vehicle {
  const nextEvent: VehicleActivityEvent = {
    id: event.id ?? newUuid(),
    createdAt: event.createdAt ?? new Date().toISOString(),
    actorUserId: event.actorUserId,
    actorDisplayName: event.actorDisplayName,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    summary: event.summary,
    meta: event.meta,
  };
  return touch(vehicle, {
    activity: [nextEvent, ...vehicle.activity].slice(0, MAX_LOCAL_ACTIVITY),
  });
}

export function createEmptyVehicle(input: {
  id?: string;
  nickname: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  engine?: string;
  vin?: string;
  plate?: string;
  color?: string;
  odometerMiles?: number;
  baseCurrency?: string;
}): Vehicle {
  const now = new Date().toISOString();
  return {
    id: input.id ?? newUuid(),
    nickname: input.nickname.trim() || 'My vehicle',
    year: input.year,
    make: input.make,
    model: input.model,
    trim: input.trim,
    engine: input.engine,
    vin: input.vin,
    plate: input.plate,
    color: input.color,
    odometerMiles: input.odometerMiles,
    odometerUpdatedAt: input.odometerMiles !== undefined ? now : undefined,
    baseCurrency: input.baseCurrency ?? 'USD',
    maintenanceSchedules: [],
    maintenanceLogs: [],
    mileageLogs: [],
    expenses: [],
    parts: [],
    activity: [],
    mode: 'private',
    role: 'owner',
    members: [],
    invites: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const useVehicles = create<VehiclesState>()(
  persist(
    (set, get) => ({
      vehicles: [],
      pendingMutations: [],
      saveVehicle: (vehicle) =>
        set((state) => {
          const normalized = normalizeVehicle(vehicle);
          if (!normalized) return state;
          return {
            vehicles: [
              ...state.vehicles.filter((item) => item.id !== normalized.id),
              normalized,
            ],
          };
        }),
      removeVehicle: (id) =>
        set((state) => ({
          vehicles: state.vehicles.filter((item) => item.id !== id),
          pendingMutations: state.pendingMutations.filter(
            (mutation) => mutation.vehicleId !== id,
          ),
        })),
      replaceVehicles: (vehicles) =>
        set({ vehicles: normalizeVehicles(vehicles) }),
      replaceSharedVehicle: (vehicle) =>
        set((state) => {
          const normalized = normalizeVehicle(vehicle);
          if (!normalized) return state;
          return {
            vehicles: [
              ...state.vehicles.filter((item) => item.id !== normalized.id),
              { ...normalized, mode: 'shared' },
            ],
          };
        }),
      removeSharedVehicle: (id) =>
        set((state) => ({
          vehicles: state.vehicles.filter(
            (item) => !(item.id === id && item.mode === 'shared'),
          ),
        })),
      appendLocalActivity: (vehicleId, event) =>
        set((state) => ({
          vehicles: state.vehicles.map((vehicle) =>
            vehicle.id === vehicleId ? withActivity(vehicle, event) : vehicle,
          ),
        })),
      enqueueMutation: (mutation) =>
        set((state) => ({
          pendingMutations: [
            ...state.pendingMutations,
            {
              ...mutation,
              id: newUuid(),
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      clearPendingMutations: (ids) =>
        set((state) => ({
          pendingMutations: state.pendingMutations.filter(
            (mutation) => !ids.includes(mutation.id),
          ),
        })),
      reset: () => set({ vehicles: [], pendingMutations: [] }),
    }),
    {
      name: STORAGE_KEYS.vehicles,
      storage: createPersistStorage(),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<VehiclesState>;
        return {
          ...currentState,
          ...persisted,
          vehicles: normalizeVehicles(persisted.vehicles),
          pendingMutations: Array.isArray(persisted.pendingMutations)
            ? persisted.pendingMutations
            : [],
        };
      },
      partialize: (state) =>
        ({
          vehicles: state.vehicles,
          pendingMutations: state.pendingMutations,
        }) as VehiclesState,
    },
  ),
);

export function updateVehicleLocally(
  vehicleId: string,
  updater: (vehicle: Vehicle) => Vehicle,
  activity?: Omit<VehicleActivityEvent, 'id' | 'createdAt'>,
) {
  const state = useVehicles.getState();
  const current = state.vehicles.find((item) => item.id === vehicleId);
  if (!current) return;
  let next = updater(current);
  if (activity) next = withActivity(next, activity);
  state.saveVehicle(next);
  if (next.mode === 'shared') {
    state.enqueueMutation({
      vehicleId,
      op: { type: 'upsert_vehicle', vehicle: next },
    });
  }
}

export function recordVehicleChange(
  vehicleId: string,
  summary: string,
  entityType: VehicleActivityEvent['entityType'],
  entityId?: string,
) {
  useVehicles.getState().appendLocalActivity(vehicleId, {
    actorDisplayName: 'You',
    action: 'update',
    entityType,
    entityId,
    summary,
  });
}
