/* eslint-disable import/first -- Jest mocks must initialize before the module under test. */
const mockCreateClient = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import {
  createTellerSession,
  deleteTellerEnrollmentRecord,
  loadTellerEnrollment,
  loadTellerSession,
  markTellerSynced,
} from '../teller-server';

describe('Teller server vault persistence', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://project.supabase.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-synthetic';
    process.env.TELLER_ENVIRONMENT = 'sandbox';
    process.env.TELLER_TOKEN_ENCRYPTION_KEY = 'encryption-secret-synthetic';
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it('cleans expired capabilities before inserting a new hashed link session', async () => {
    const cleanupLt = jest.fn().mockResolvedValue({ error: null });
    const cleanupDelete = jest.fn(() => ({ lt: cleanupLt }));
    const insert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn()
      .mockReturnValueOnce({ delete: cleanupDelete })
      .mockReturnValueOnce({ insert });
    mockCreateClient.mockReturnValue({ from });

    const result = await createTellerSession('user-synthetic');

    expect(from).toHaveBeenNthCalledWith(1, 'teller_link_sessions');
    expect(from).toHaveBeenNthCalledWith(2, 'teller_link_sessions');
    expect(cleanupDelete).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-synthetic',
      environment: 'sandbox',
      session_token_hash: expect.any(String),
      nonce: expect.any(String),
    }));
    expect(result.sessionId).not.toBe(result.nonce);
    expect(result.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('loads a non-expired session by hashed capability and optional owner', async () => {
    const query = {
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          user_id: 'user-synthetic',
          nonce: 'nonce-synthetic',
          environment: 'development',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          completed_at: null,
          enrollment_id: null,
        },
        error: null,
      }),
    };
    query.eq.mockReturnValue(query);
    const select = jest.fn(() => query);
    const from = jest.fn(() => ({ select }));
    mockCreateClient.mockReturnValue({ from });

    await expect(loadTellerSession('session-synthetic', 'user-synthetic')).resolves.toMatchObject({
      userId: 'user-synthetic',
      nonce: 'nonce-synthetic',
      environment: 'development',
    });
    expect(from).toHaveBeenCalledWith('teller_link_sessions');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'session_token_hash', expect.any(String));
    expect(query.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-synthetic');
  });

  it('rejects missing or expired link sessions at the persistence boundary', async () => {
    const query = {
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    query.eq.mockReturnValue(query);
    mockCreateClient.mockReturnValue({
      from: jest.fn(() => ({ select: jest.fn(() => query) })),
    });

    await expect(loadTellerSession('missing-session')).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
      status: 400,
    });
  });

  it('loads enrollment records by both user and enrollment id before decrypting', async () => {
    const query = {
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    query.eq.mockReturnValue(query);
    const from = jest.fn(() => ({ select: jest.fn(() => query) }));
    mockCreateClient.mockReturnValue({ from });

    await expect(loadTellerEnrollment('user-synthetic', 'enrollment-synthetic'))
      .rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND', status: 404 });
    expect(from).toHaveBeenCalledWith('teller_enrollments');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-synthetic');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'enrollment_id', 'enrollment-synthetic');
  });

  it('updates sync timestamps and deletes only the authenticated user enrollment', async () => {
    const updateQuery = { eq: jest.fn(), error: null as null };
    updateQuery.eq.mockReturnValue(updateQuery);
    const deleteQuery = { eq: jest.fn(), error: null as null };
    deleteQuery.eq.mockReturnValue(deleteQuery);
    const update = jest.fn(() => updateQuery);
    const remove = jest.fn(() => deleteQuery);
    const from = jest.fn()
      .mockReturnValueOnce({ update })
      .mockReturnValueOnce({ delete: remove });
    mockCreateClient.mockReturnValue({ from });

    await markTellerSynced('user-synthetic', 'enrollment-synthetic');
    await deleteTellerEnrollmentRecord('user-synthetic', 'enrollment-synthetic');

    expect(from).toHaveBeenNthCalledWith(1, 'teller_enrollments');
    expect(from).toHaveBeenNthCalledWith(2, 'teller_enrollments');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      last_synced_at: expect.any(String),
      updated_at: expect.any(String),
    }));
    expect(updateQuery.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-synthetic');
    expect(updateQuery.eq).toHaveBeenNthCalledWith(2, 'enrollment_id', 'enrollment-synthetic');
    expect(deleteQuery.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-synthetic');
    expect(deleteQuery.eq).toHaveBeenNthCalledWith(2, 'enrollment_id', 'enrollment-synthetic');
  });
});
