import type { FlowEnvironment } from '@/services/analytics/flow-model';

const CONFIGURED_ENVIRONMENTS = new Set<FlowEnvironment>([
  'production',
  'testflight',
  'preview',
  'development',
]);

const CHANNEL_ENVIRONMENTS: Record<string, FlowEnvironment> = {
  production: 'production',
  testflight: 'testflight',
  device: 'preview',
};

export function resolveFlowEnvironment(
  updateChannel: string | null | undefined,
  configuredEnvironment: string | undefined,
): FlowEnvironment {
  const channelEnvironment = updateChannel
    ? CHANNEL_ENVIRONMENTS[updateChannel.trim().toLowerCase()]
    : undefined;
  if (channelEnvironment) return channelEnvironment;
  if (CONFIGURED_ENVIRONMENTS.has(configuredEnvironment as FlowEnvironment)) {
    return configuredEnvironment as FlowEnvironment;
  }
  return 'development';
}
