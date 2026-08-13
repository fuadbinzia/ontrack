import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  FLOW_ANALYTICS_SCHEMA_VERSION,
  FLOW_EVENT_BATCH_MAX,
  type FlowEnvironment,
  type FlowEventBatchV1,
} from '@/services/analytics/flow-model';
import { resolveExpoApiUrl } from '@/services/http/api-url';
import { apiRequest } from '@/services/http/api-client';
import { useFlowAnalytics } from '@/store/flow-analytics';
import { useUsageAnalytics } from '@/store/usage-analytics';

class FlowAnalyticsTransportError extends Error {}

function environment(): FlowEnvironment {
  const value = process.env.EXPO_PUBLIC_APP_ENV;
  if (value === 'production' || value === 'testflight' || value === 'preview') return value;
  return 'development';
}

function url() {
  return resolveExpoApiUrl('/api/analytics/flows', {
    configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    requireHttpsInProduction: true,
    createNotConfiguredError: () => new FlowAnalyticsTransportError('Flow analytics is unavailable.'),
  });
}

export async function flushFlowAnalytics(): Promise<number> {
  const events = useFlowAnalytics.getState().pending.slice(0, FLOW_EVENT_BATCH_MAX);
  if (!events.length) return 0;
  const installId = useUsageAnalytics.getState().ensureInstallId();
  const body: FlowEventBatchV1 = {
    schemaVersion: FLOW_ANALYTICS_SCHEMA_VERSION,
    installId,
    platform: Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
      ? Platform.OS
      : 'unknown',
    environment: environment(),
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    events,
  };
  const result = await apiRequest<{ accepted: string[] }, FlowAnalyticsTransportError>({
    url: url(),
    body,
    authenticate: false,
    timeoutMs: 8_000,
    offlineMessage: 'Flow analytics will retry when online.',
    unavailableMessage: 'Flow analytics is unavailable.',
    createError: (message) => new FlowAnalyticsTransportError(message),
  });
  useFlowAnalytics.getState().acknowledge(result.accepted);
  return result.accepted.length;
}
