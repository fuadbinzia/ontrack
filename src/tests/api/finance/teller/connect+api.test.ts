/* eslint-disable import/first -- Jest mocks must initialize before the route module. */
const mockLoadTellerSession = jest.fn();
const mockTellerEnvironment = jest.fn(() => 'development');

jest.mock('@/services/finance/teller-server', () => ({
  loadTellerSession: (sessionId: string) => mockLoadTellerSession(sessionId),
  tellerEnvironment: () => mockTellerEnvironment(),
  TellerServerError: class TellerServerError extends Error {
    code: string | undefined;
    status: number;

    constructor(message: string, errorCode?: string, httpStatus = 502) {
      super(message);
      this.code = errorCode;
      this.status = httpStatus;
    }
  },
}));

import * as route from '@/app/api/finance/teller/connect+api';
import { TellerServerError } from '@/services/finance/teller-server';

describe('Teller Connect capability page', () => {
  const originalApplicationId = process.env.TELLER_APPLICATION_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELLER_APPLICATION_ID = 'app-synthetic';
    mockLoadTellerSession.mockResolvedValue({
      nonce: 'nonce-synthetic',
      environment: 'sandbox',
    });
  });

  afterAll(() => {
    if (originalApplicationId === undefined) delete process.env.TELLER_APPLICATION_ID;
    else process.env.TELLER_APPLICATION_ID = originalApplicationId;
  });

  it('rejects a missing or whitespace-only session capability', async () => {
    await expect(route.GET(new Request('https://ontrack.example/api/finance/teller/connect')))
      .resolves.toMatchObject({ status: 400 });
    await expect(route.GET(new Request('https://ontrack.example/api/finance/teller/connect?session=%20')))
      .resolves.toMatchObject({ status: 400 });
    expect(mockLoadTellerSession).not.toHaveBeenCalled();
  });

  it('loads the server session and emits a locked-down no-store Connect page', async () => {
    const response = await route.GET(new Request(
      'https://ontrack.example/api/finance/teller/connect?session=session-synthetic',
    ));
    const html = await response.text();

    expect(mockLoadTellerSession).toHaveBeenCalledWith('session-synthetic');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Security-Policy')).toContain('https://cdn.teller.io');
    expect(html).toContain('"applicationId":"app-synthetic"');
    expect(html).toContain('"environment":"sandbox"');
    expect(html).toContain('https://ontrack.example/api/finance/teller/complete');
    expect(html).toContain('ontrack://teller/complete?status=');
  });

  it('uses the validated server environment when a legacy session has none', async () => {
    mockLoadTellerSession.mockResolvedValueOnce({ nonce: 'nonce-synthetic', environment: '' });

    const response = await route.GET(new Request(
      'https://ontrack.example/api/finance/teller/connect?session=session-synthetic',
    ));

    expect(mockTellerEnvironment).toHaveBeenCalled();
    expect(await response.text()).toContain('"environment":"development"');
  });

  it('returns safe no-store errors for missing configuration and expired sessions', async () => {
    delete process.env.TELLER_APPLICATION_ID;
    const unconfigured = await route.GET(new Request(
      'https://ontrack.example/api/finance/teller/connect?session=session-synthetic',
    ));
    expect(unconfigured.status).toBe(503);
    expect(unconfigured.headers.get('Cache-Control')).toBe('no-store');

    mockLoadTellerSession.mockRejectedValueOnce(
      new TellerServerError('This Teller session is missing or expired.', 'SESSION_EXPIRED', 400),
    );
    const expired = await route.GET(new Request(
      'https://ontrack.example/api/finance/teller/connect?session=session-expired',
    ));
    expect(expired.status).toBe(400);
    await expect(expired.text()).resolves.toBe('This Teller session is missing or expired.');
  });
});
