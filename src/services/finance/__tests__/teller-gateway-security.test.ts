import {
  constantTimeEqual,
  MAX_CLOCK_SKEW_MS,
  signGatewayRequest,
  validTimestamp,
} from '../../../../cloudflare/teller-gateway/src/security';

describe('Teller gateway request signing', () => {
  it('produces stable body-bound signatures', async () => {
    const signed = await signGatewayRequest('secret', '1000', 'nonce-value', '{"operation":"accounts"}');
    await expect(signGatewayRequest(
      'secret', '1000', 'nonce-value', '{"operation":"accounts"}',
    )).resolves.toBe(signed);
    expect(constantTimeEqual(signed, `${signed.slice(0, -1)}0`)).toBe(false);
    expect(constantTimeEqual(signed, signed)).toBe(true);
  });

  it('rejects stale and future timestamps outside the replay window', () => {
    const now = 1_000_000;
    expect(validTimestamp(String(now), now)).toBe(true);
    expect(validTimestamp(String(now - MAX_CLOCK_SKEW_MS - 1), now)).toBe(false);
    expect(validTimestamp(String(now + MAX_CLOCK_SKEW_MS + 1), now)).toBe(false);
    expect(validTimestamp('not-a-number', now)).toBe(false);
  });
});
