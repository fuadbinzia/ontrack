import { reportOperationalFailure, userVisibleError } from '@/utils/operational-error';

export const COMPANION_UNAVAILABLE =
  'onTrack is temporarily unavailable. Search still works.';

export function companionStatusMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (message) reportOperationalFailure(message, 'search.companion');
  return userVisibleError(message) ?? COMPANION_UNAVAILABLE;
}
