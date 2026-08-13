import { resolveFlowEnvironment } from '@/services/analytics/flow-environment';

describe('flow analytics release environment', () => {
  it.each([
    ['production', 'production'],
    ['testflight', 'testflight'],
    ['device', 'preview'],
  ] as const)('uses the %s update channel for the %s analytics bucket', (channel, expected) => {
    expect(resolveFlowEnvironment(channel, undefined)).toBe(expected);
  });

  it('does not let a missing production EAS variable relabel a production OTA as development', () => {
    expect(resolveFlowEnvironment('production', undefined)).toBe('production');
  });

  it('lets the update channel override a stale shared EAS environment value', () => {
    expect(resolveFlowEnvironment('device', 'testflight')).toBe('preview');
    expect(resolveFlowEnvironment('production', 'development')).toBe('production');
  });

  it('uses configured values locally and otherwise falls back to development', () => {
    expect(resolveFlowEnvironment(null, 'preview')).toBe('preview');
    expect(resolveFlowEnvironment(undefined, 'unexpected')).toBe('development');
  });
});
