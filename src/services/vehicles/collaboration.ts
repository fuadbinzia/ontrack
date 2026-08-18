import type { RealtimeChannel } from '@supabase/supabase-js';

import { normalizeVehicle } from '@/features/vehicles/normalize';
import type { Vehicle } from '@/features/vehicles/types';
import { getSupabaseClient } from '@/services/cloud/supabase';
import {
  type VehiclePendingMutation,
  useVehicles,
} from '@/store/vehicles';

export class VehicleCollaborationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VehicleCollaborationError';
  }
}

function messageFrom(error: { message?: string } | null, fallback: string) {
  return error?.message?.trim() || fallback;
}

async function authenticatedClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new VehicleCollaborationError(
      'Shared vehicles are not configured for this build.',
    );
  }
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    throw new VehicleCollaborationError('Sign in to share or join a vehicle.');
  }
  return client;
}

function snapshotFrom(value: unknown): Vehicle | undefined {
  const normalized = normalizeVehicle(value);
  return normalized ? { ...normalized, mode: 'shared' } : undefined;
}

export async function loadVehicleSnapshot(
  vehicleId: string,
): Promise<Vehicle | undefined> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('vehicle_snapshot', {
    requested_vehicle_id: vehicleId,
  });
  if (error) {
    throw new VehicleCollaborationError(
      messageFrom(error, 'The shared vehicle could not be refreshed.'),
    );
  }
  const snapshot = snapshotFrom(data);
  if (snapshot) useVehicles.getState().replaceSharedVehicle(snapshot);
  else useVehicles.getState().removeSharedVehicle(vehicleId);
  return snapshot;
}

export async function publishVehicle(vehicleId: string): Promise<Vehicle> {
  const state = useVehicles.getState();
  const vehicle = state.vehicles.find((item) => item.id === vehicleId);
  if (!vehicle || vehicle.mode !== 'private' || vehicle.role !== 'owner') {
    throw new VehicleCollaborationError(
      'Only a private vehicle owner can share it.',
    );
  }
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('publish_vehicle', {
    vehicle_payload: {
      ...vehicle,
      mode: 'shared',
      role: 'owner',
      members: [],
      invites: [],
      activity: vehicle.activity.slice(0, 20),
    },
  });
  if (error) {
    throw new VehicleCollaborationError(
      messageFrom(error, 'The vehicle could not be shared.'),
    );
  }
  const snapshot = snapshotFrom(data);
  if (!snapshot) {
    throw new VehicleCollaborationError('Shared vehicle snapshot was empty.');
  }
  // Replace local private copy with shared snapshot (same id).
  state.removeVehicle(vehicleId);
  state.replaceSharedVehicle(snapshot);
  return snapshot;
}

export async function flushVehicleMutations(): Promise<void> {
  const state = useVehicles.getState();
  const pending = state.pendingMutations;
  if (!pending.length) return;
  const client = await authenticatedClient();
  const batch = pending.slice(0, 50);
  const { error } = await client.rpc('apply_vehicle_mutations', {
    requested_mutations: batch.map((mutation: VehiclePendingMutation) => ({
      id: mutation.id,
      vehicleId: mutation.vehicleId,
      summary:
        mutation.op.type === 'upsert_vehicle'
          ? `Updated ${mutation.op.vehicle.nickname}`
          : mutation.op.type,
      op: mutation.op,
    })),
  });
  if (error) {
    throw new VehicleCollaborationError(
      messageFrom(error, 'Vehicle changes could not be synced.'),
    );
  }
  state.clearPendingMutations(batch.map((mutation) => mutation.id));
}

export async function loadAllSharedVehicles(): Promise<void> {
  const client = await authenticatedClient();
  await flushVehicleMutations().catch(() => undefined);
  const { data, error } = await client.rpc('vehicle_shared_ids');
  if (error) {
    throw new VehicleCollaborationError(
      messageFrom(error, 'Shared vehicles could not be loaded.'),
    );
  }
  const ids = Array.isArray(data)
    ? data.flatMap((row) =>
        row && typeof row === 'object' && typeof (row as { vehicle_id?: string }).vehicle_id === 'string'
          ? [(row as { vehicle_id: string }).vehicle_id]
          : typeof row === 'string'
            ? [row]
            : [],
      )
    : [];
  const remoteIds = new Set(ids);
  for (const vehicle of useVehicles.getState().vehicles) {
    if (vehicle.mode === 'shared' && !remoteIds.has(vehicle.id)) {
      useVehicles.getState().removeSharedVehicle(vehicle.id);
    }
  }
  await Promise.all(ids.map((id) => loadVehicleSnapshot(id)));
}

export async function createVehicleShareLink(vehicleId: string): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('create_vehicle_share_link', {
    requested_vehicle_id: vehicleId,
  });
  if (error || typeof data !== 'string') {
    throw new VehicleCollaborationError(
      messageFrom(error, 'A share link could not be created.'),
    );
  }
  const current = useVehicles.getState().vehicles.find((item) => item.id === vehicleId);
  if (current) {
    useVehicles.getState().saveVehicle({ ...current, shareCode: data });
  }
  return data;
}

export async function revokeVehicleShareLink(vehicleId: string): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('revoke_vehicle_share_link', {
    requested_vehicle_id: vehicleId,
  });
  if (error) {
    throw new VehicleCollaborationError(
      messageFrom(error, 'The share link could not be revoked.'),
    );
  }
  const current = useVehicles.getState().vehicles.find((item) => item.id === vehicleId);
  if (current) {
    useVehicles.getState().saveVehicle({ ...current, shareCode: undefined });
  }
}

export async function resolveVehicleShareLink(code: string): Promise<{
  vehicleId: string;
  nickname: string;
  ownerName?: string;
}> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('resolve_vehicle_share_link', {
    link_code: code,
  });
  if (error || !data || typeof data !== 'object') {
    throw new VehicleCollaborationError(
      messageFrom(error, 'This invite link expired. Ask the owner for a fresh one.'),
    );
  }
  const row = data as Record<string, unknown>;
  if (typeof row.vehicleId !== 'string' || typeof row.nickname !== 'string') {
    throw new VehicleCollaborationError('This invite link expired. Ask the owner for a fresh one.');
  }
  return {
    vehicleId: row.vehicleId,
    nickname: row.nickname,
    ownerName: typeof row.ownerName === 'string' ? row.ownerName : undefined,
  };
}

export async function acceptVehicleShareLink(code: string): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('accept_vehicle_share_link', {
    link_code: code,
  });
  if (error || typeof data !== 'string') {
    throw new VehicleCollaborationError(
      messageFrom(error, 'Could not join this vehicle.'),
    );
  }
  await loadVehicleSnapshot(data);
  return data;
}

export async function removeVehicleMember(vehicleId: string, userId: string) {
  const client = await authenticatedClient();
  const { error } = await client.rpc('remove_vehicle_member', {
    requested_vehicle_id: vehicleId,
    requested_user_id: userId,
  });
  if (error) {
    throw new VehicleCollaborationError(messageFrom(error, 'Member could not be removed.'));
  }
  await loadVehicleSnapshot(vehicleId);
}

export async function transferVehicleOwnership(
  vehicleId: string,
  newOwnerUserId: string,
) {
  const client = await authenticatedClient();
  const { error } = await client.rpc('transfer_vehicle_ownership', {
    requested_vehicle_id: vehicleId,
    new_owner_user_id: newOwnerUserId,
  });
  if (error) {
    throw new VehicleCollaborationError(
      messageFrom(error, 'Ownership could not be transferred.'),
    );
  }
  await loadVehicleSnapshot(vehicleId);
}

export async function leaveVehicle(vehicleId: string) {
  const state = useVehicles.getState();
  const rollback = state.vehicles.find((item) => item.id === vehicleId);
  state.removeSharedVehicle(vehicleId);
  try {
    const client = await authenticatedClient();
    const { error } = await client.rpc('leave_vehicle', {
      requested_vehicle_id: vehicleId,
    });
    if (error) throw new VehicleCollaborationError(error.message);
  } catch (error) {
    if (rollback) state.replaceSharedVehicle(rollback);
    throw error;
  }
}

export async function deleteSharedVehicle(vehicleId: string) {
  const state = useVehicles.getState();
  const rollback = state.vehicles.find((item) => item.id === vehicleId);
  state.removeSharedVehicle(vehicleId);
  try {
    const client = await authenticatedClient();
    const { error } = await client.rpc('delete_shared_vehicle', {
      requested_vehicle_id: vehicleId,
    });
    if (error) throw new VehicleCollaborationError(error.message);
  } catch (error) {
    if (rollback) state.replaceSharedVehicle(rollback);
    throw error;
  }
}

export function subscribeToVehicle(
  vehicle: Pick<Vehicle, 'id'>,
  onChange: () => void,
): RealtimeChannel | undefined {
  const client = getSupabaseClient();
  if (!client) return undefined;
  return client
    .channel(`vehicle:${vehicle.id}`, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, onChange)
    .subscribe();
}
