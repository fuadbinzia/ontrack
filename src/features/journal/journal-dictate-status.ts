import { reportOperationalFailure, userVisibleError } from '@/utils/operational-error';

export function journalDictateStatusMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (message) reportOperationalFailure(message, 'journal.dictate');
  return userVisibleError(message) ?? 'Dictate is temporarily unavailable. Typing still works.';
}
