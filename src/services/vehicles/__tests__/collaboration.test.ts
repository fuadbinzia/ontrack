const mockGetSupabaseClient = jest.fn();
const mockVehicleState = {
  vehicles: [] as unknown[],
  pendingMutations: [] as unknown[],
  removeVehicle: jest.fn(),
  replaceSharedVehicle: jest.fn(),
  removeSharedVehicle: jest.fn(),
  saveVehicle: jest.fn(),
  clearPendingMutations: jest.fn(),
};

jest.mock('@/services/cloud/supabase', () => ({
  getSupabaseClient: (...args: unknown[]) => mockGetSupabaseClient(...args),
}));

jest.mock('@/store/vehicles', () => ({
  useVehicles: { getState: () => mockVehicleState },
}));

// eslint-disable-next-line import/first
import {
  createVehicleShareLink,
  loadVehicleSnapshot,
  publishVehicle,
  VehicleCollaborationError,
} from '../collaboration';

describe('vehicle collaboration boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVehicleState.vehicles = [];
    mockVehicleState.pendingMutations = [];
  });

  it('distinguishes missing cloud configuration from a signed-out session', async () => {
    mockGetSupabaseClient.mockReturnValueOnce(undefined);
    await expect(loadVehicleSnapshot('vehicle-1')).rejects.toEqual(
      new VehicleCollaborationError('Shared vehicles are not configured for this build.'),
    );

    mockGetSupabaseClient.mockReturnValueOnce({
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }) },
    });
    await expect(loadVehicleSnapshot('vehicle-1')).rejects.toEqual(
      new VehicleCollaborationError('Sign in to share or join a vehicle.'),
    );
  });

  it('rejects publishing before making a network request unless the private owner exists', async () => {
    await expect(publishVehicle('missing')).rejects.toEqual(
      new VehicleCollaborationError('Only a private vehicle owner can share it.'),
    );
    expect(mockGetSupabaseClient).not.toHaveBeenCalled();
  });

  it('preserves the service error when share-link creation fails', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: '  owner only  ' } });
    mockGetSupabaseClient.mockReturnValue({
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null }) },
      rpc,
    });
    await expect(createVehicleShareLink('vehicle-1')).rejects.toEqual(
      new VehicleCollaborationError('owner only'),
    );
    expect(rpc).toHaveBeenCalledWith('create_vehicle_share_link', {
      requested_vehicle_id: 'vehicle-1',
    });
  });
});
