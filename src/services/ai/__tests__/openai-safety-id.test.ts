import { openaiSafetyIdentifier } from '@/services/ai/openai-safety-id';

describe('openaiSafetyIdentifier', () => {
  const original = process.env.ANALYTICS_INSTALL_HASH_SECRET;
  const originalSafety = process.env.OPENAI_SAFETY_HASH_SECRET;
  const originalAppEnv = process.env.EXPO_PUBLIC_APP_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.ANALYTICS_INSTALL_HASH_SECRET;
    else process.env.ANALYTICS_INSTALL_HASH_SECRET = original;
    if (originalSafety === undefined) delete process.env.OPENAI_SAFETY_HASH_SECRET;
    else process.env.OPENAI_SAFETY_HASH_SECRET = originalSafety;
    if (originalAppEnv === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
    else process.env.EXPO_PUBLIC_APP_ENV = originalAppEnv;
  });

  it('does not emit the raw user id', () => {
    process.env.ANALYTICS_INSTALL_HASH_SECRET = 'test-secret';
    const hashed = openaiSafetyIdentifier('user-123');
    expect(hashed).not.toContain('user-123');
    expect(hashed).toHaveLength(32);
    expect(openaiSafetyIdentifier('user-123')).toBe(hashed);
    expect(openaiSafetyIdentifier('user-456')).not.toBe(hashed);
  });

  it('refuses the repo fallback secret in production-like app env', () => {
    delete process.env.ANALYTICS_INSTALL_HASH_SECRET;
    delete process.env.OPENAI_SAFETY_HASH_SECRET;
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    expect(() => openaiSafetyIdentifier('user-123')).toThrow(
      'OPENAI_SAFETY_HASH_SECRET is required',
    );
  });
});
