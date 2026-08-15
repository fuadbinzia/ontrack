import type { FinanceRewardProfileDraft, RewardProfileImporter } from '@/features/finance/rewards-types';
import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';

export class RewardCardImportError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = 'RewardCardImportError';
  }
}

export async function importRewardCardLink(
  url: string,
  signal?: AbortSignal,
): Promise<FinanceRewardProfileDraft> {
  const endpoint = resolveExpoApiUrl('/api/finance/rewards/import-link', {
    configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    createNotConfiguredError: () => new RewardCardImportError(
      'Card link import requires a connected onTrack server.',
      'NOT_CONFIGURED',
    ),
  });
  return apiRequest<FinanceRewardProfileDraft, RewardCardImportError>({
    url: endpoint,
    method: 'POST',
    body: { url },
    signal,
    offlineMessage: 'Connect to analyze this card link.',
    unavailableMessage: 'Card link analysis is temporarily unavailable.',
    createError: (message, code, status) => new RewardCardImportError(message, code, status),
  });
}

export const urlRewardProfileImporter: RewardProfileImporter<string> = {
  id: 'url',
  import: importRewardCardLink,
};

