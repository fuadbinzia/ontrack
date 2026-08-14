import { resolveSportsDbKey } from '@/services/events/server';

describe('event provider development configuration', () => {
  it('uses TheSportsDB public key when local development has no loaded env key', () => {
    expect(resolveSportsDbKey(undefined, 'development')).toBe('123');
    expect(resolveSportsDbKey('   ', 'test')).toBe('123');
  });

  it('prefers an explicitly configured key in every environment', () => {
    expect(resolveSportsDbKey(' premium-key ', 'development')).toBe('premium-key');
    expect(resolveSportsDbKey('production-key', 'production')).toBe('production-key');
  });

  it('never falls back to the public development key in production', () => {
    expect(resolveSportsDbKey(undefined, 'production')).toBeUndefined();
    expect(resolveSportsDbKey('', 'staging')).toBeUndefined();
  });
});
