import * as completeRoute from '../../../app/api/finance/teller/complete+api';
import * as disconnectRoute from '../../../app/api/finance/teller/disconnect+api';
import * as finishRoute from '../../../app/api/finance/teller/finish+api';
import * as sessionRoute from '../../../app/api/finance/teller/session+api';
import * as syncRoute from '../../../app/api/finance/teller/sync+api';

const mockCreateSession = jest.fn();
const mockLoadSession = jest.fn();
const mockCompleteSession = jest.fn();
const mockLoadEnrollment = jest.fn();
const mockDeleteEnrollment = jest.fn();
const mockMarkSynced = jest.fn();
const mockGatewayRequest = jest.fn();
const mockLoadData = jest.fn();

jest.mock('../teller-server', () => ({
  TellerServerError: class TellerServerError extends Error {
    code?: string;
    status: number;
    constructor(message: string, errorCode?: string, httpStatus = 502) {
      super(message);
      this.code = errorCode;
      this.status = httpStatus;
    }
  },
  tellerConfigured: jest.fn(() => true),
  tellerApiOptions: jest.fn(() => new Response(null, { status: 204 })),
  withTellerApiAuth: (request: Request, handler: (request: Request, userId: string) => unknown) =>
    handler(request, 'user-1'),
  createTellerSession: (...args: unknown[]) => mockCreateSession(...args),
  loadTellerSession: (...args: unknown[]) => mockLoadSession(...args),
  completeTellerSession: (...args: unknown[]) => mockCompleteSession(...args),
  loadTellerEnrollment: (...args: unknown[]) => mockLoadEnrollment(...args),
  deleteTellerEnrollmentRecord: (...args: unknown[]) => mockDeleteEnrollment(...args),
  markTellerSynced: (...args: unknown[]) => mockMarkSynced(...args),
  tellerGatewayRequest: (...args: unknown[]) => mockGatewayRequest(...args),
}));

jest.mock('../teller-data', () => ({
  loadTellerEnrollmentData: (...args: unknown[]) => mockLoadData(...args),
}));

function request(path: string, body: unknown): Request {
  return new Request(`https://ontrack.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Teller API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteEnrollment.mockResolvedValue(undefined);
    mockMarkSynced.mockResolvedValue(undefined);
  });

  it('creates a user-owned Connect session without returning its nonce', async () => {
    mockCreateSession.mockResolvedValue({
      sessionId: 'session-secret', nonce: 'server-nonce', expiresAt: '2026-08-14T12:00:00Z',
    });
    const result = await sessionRoute.POST(request('/session', { native: true })) as unknown as Record<string, unknown>;

    expect(mockCreateSession).toHaveBeenCalledWith('user-1');
    expect(result).toMatchObject({
      session_id: 'session-secret',
      connect_url: 'https://ontrack.example/api/finance/teller/connect?session=session-secret',
      completion_redirect_uri: 'ontrack://teller/complete',
    });
    expect(result).not.toHaveProperty('nonce');
  });

  it('accepts a complete signed enrollment payload only through the capability route', async () => {
    mockCompleteSession.mockResolvedValue(undefined);
    const response = await completeRoute.POST(request('/complete', {
      session_id: 'session-secret',
      access_token: 'browser-only-token',
      teller_user_id: 'teller-user',
      enrollment_id: 'enr-1',
      institution_name: 'Example Bank',
      signatures: ['signature'],
    }));

    expect(response.status).toBe(200);
    expect(mockCompleteSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-secret', accessToken: 'browser-only-token', enrollmentId: 'enr-1',
    }));
  });

  it('binds finish to the authenticated session owner', async () => {
    mockLoadSession.mockResolvedValue({ completedAt: 'now', enrollmentId: 'enr-1' });
    const result = await finishRoute.POST(request('/finish', { session_id: 'session-secret' })) as unknown as Record<string, unknown>;

    expect(mockLoadSession).toHaveBeenCalledWith('session-secret', 'user-1');
    expect(result).toEqual({ enrollment_id: 'enr-1' });
  });

  it('syncs using the server-owned token and never accepts a client token', async () => {
    mockLoadEnrollment.mockResolvedValue({
      enrollmentId: 'enr-1', accessToken: 'server-token', institutionName: 'Example Bank',
    });
    mockLoadData.mockResolvedValue({
      institutionName: 'Example Bank', accounts: [], transactions: [], refreshedFrom: '2026-08-04',
    });
    const result = await syncRoute.POST(request('/sync', {
      enrollment_id: 'enr-1', access_token: 'malicious-client-token',
    })) as unknown as Record<string, unknown>;

    expect(mockLoadEnrollment).toHaveBeenCalledWith('user-1', 'enr-1');
    expect(mockLoadData).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'server-token' }));
    expect(mockMarkSynced).toHaveBeenCalledWith('user-1', 'enr-1');
    expect(result).toMatchObject({ enrollment_id: 'enr-1', refreshed_from: '2026-08-04' });
  });

  it('revokes Teller before deleting the encrypted enrollment record', async () => {
    mockLoadEnrollment.mockResolvedValue({ enrollmentId: 'enr-1', accessToken: 'server-token' });
    mockGatewayRequest.mockResolvedValue({});

    await disconnectRoute.POST(request('/disconnect', { enrollment_id: 'enr-1' }));

    expect(mockGatewayRequest).toHaveBeenCalledWith({
      operation: 'disconnect', accessToken: 'server-token',
    });
    expect(mockGatewayRequest.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteEnrollment.mock.invocationCallOrder[0]!,
    );
    expect(mockDeleteEnrollment).toHaveBeenCalledWith('user-1', 'enr-1');
  });
});
