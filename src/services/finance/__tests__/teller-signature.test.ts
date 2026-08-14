import { verifyTellerEnrollmentSignature } from '../teller-server';

describe('Teller enrollment signature verification', () => {
  const original = process.env.TELLER_SIGNING_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.TELLER_SIGNING_KEY;
    else process.env.TELLER_SIGNING_KEY = original;
  });

  it('accepts the current Ed25519 signature and rejects altered enrollment data', async () => {
    const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
    const publicKey = await crypto.subtle.exportKey('raw', pair.publicKey);
    process.env.TELLER_SIGNING_KEY = Buffer.from(publicKey).toString('base64');
    const input = {
      nonce: 'nonce', accessToken: 'token', userId: 'user',
      enrollmentId: 'enrollment', environment: 'development' as const,
    };
    const message = Object.values(input).join('.');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
    const signature = await crypto.subtle.sign('Ed25519', pair.privateKey, digest);
    const encoded = Buffer.from(signature).toString('base64');

    await expect(verifyTellerEnrollmentSignature({ ...input, signatures: [encoded] })).resolves.toBe(true);
    await expect(verifyTellerEnrollmentSignature({
      ...input, enrollmentId: 'altered', signatures: [encoded],
    })).resolves.toBe(false);
  });
});
