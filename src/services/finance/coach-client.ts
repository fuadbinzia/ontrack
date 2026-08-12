import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';

import type { FinanceCoachInsight } from '@/features/finance/coach';

class FinanceCoachError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'FinanceCoachError';
  }
}

export async function requestFinanceCoachPolish(input: {
  insights: FinanceCoachInsight[];
  referenceSavingsApr: number;
}): Promise<{
  insights: FinanceCoachInsight[];
  source: 'local' | 'ai';
  disclaimer: string;
}> {
  const url = resolveExpoApiUrl('/api/finance/coach', {
    configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    createNotConfiguredError: () =>
      new FinanceCoachError('Coach polish requires a connected onTrack server.', 'NOT_CONFIGURED'),
  });
  return apiRequest<
    {
      insights: FinanceCoachInsight[];
      source: 'local' | 'ai';
      disclaimer: string;
    },
    FinanceCoachError
  >({
    url,
    method: 'POST',
    body: input,
    offlineMessage: 'Connect to polish coach tips.',
    unavailableMessage: 'Coach polish is temporarily unavailable.',
    createError: (message, code, status) => new FinanceCoachError(message, code, status),
  });
}
