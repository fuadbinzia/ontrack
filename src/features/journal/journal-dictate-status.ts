import { reportOperationalFailure, userVisibleError } from '@/utils/operational-error';

export function journalDictateStatusMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (message) reportOperationalFailure(message, 'journal.dictate');
  return userVisibleError(message) ?? 'Dictate is temporarily unavailable. Typing still works.';
}

/**
 * Dictation lands in the composer input for review before sending — it never
 * posts straight to the page. Appends to anything already typed.
 */
export function mergeDictationIntoDraft(draft: string, dictated: string): string {
  const spoken = dictated.trim();
  if (!spoken) return draft;
  const current = draft.trim();
  return current ? `${current} ${spoken}` : spoken;
}
