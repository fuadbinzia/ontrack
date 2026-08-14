import type { EzPassActivityDraft } from '@/features/finance/ezpass-parser';
import { parseEzPassRows } from '@/features/finance/ezpass-parser';
import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';
import { Platform } from 'react-native';

import type { EzPassAiFile, EzPassAiRow } from './ezpass-ai-server';

class EzPassImportError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
  }
}

export async function requestEzPassAiParse(
  files: EzPassAiFile[],
): Promise<EzPassActivityDraft[]> {
  const useHostedApi = __DEV__ && Platform.OS !== 'web';
  const result = await apiRequest<{ activities: EzPassAiRow[] }, EzPassImportError>({
    url: resolveExpoApiUrl('/api/finance/ezpass/parse', {
      configuredBaseUrl: useHostedApi
        ? process.env.EXPO_PUBLIC_FINANCE_API_BASE_URL || 'https://ontrack.expo.app'
        : process.env.EXPO_PUBLIC_API_BASE_URL,
      preferConfiguredFirst: useHostedApi || !__DEV__,
      requireHttpsInProduction: true,
      createNotConfiguredError: () => new EzPassImportError(
        'Finance services are not configured for this build.',
        'NOT_CONFIGURED',
      ),
    }),
    body: { files },
    timeoutMs: 75_000,
    offlineMessage: 'Connect to the internet to use AI statement parsing.',
    unavailableMessage: 'AI statement parsing is unavailable.',
    createError: (message, code, status) => new EzPassImportError(message, code, status),
  });
  const rows: unknown[][] = [
    ['date', 'time', 'amount', 'description', 'type', 'reference'],
    ...result.activities.map((row) => [
      row.date,
      row.time,
      row.amount,
      row.description,
      row.type,
      row.reference,
    ]),
  ];
  return parseEzPassRows(rows).activities;
}
