import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { newId } from '@/utils/id';

export const JOURNAL_VOICE_DIRECTORY = 'journal-voice';

function extensionForUri(uri: string): string {
  const match = uri.toLowerCase().match(/\.(m4a|caf|wav|webm|mp3|aac|3gp)(?:\?|$)/);
  return match?.[1] ?? 'm4a';
}

/** Copy a recorder cache URI into durable app documents. Never persist cache URIs. */
export async function persistJournalVoice(uri: string, fileStem = newId('voice')): Promise<string> {
  if (Platform.OS === 'web' || uri.startsWith('ontrack-media:')) return uri;
  const dir = new Directory(Paths.document, JOURNAL_VOICE_DIRECTORY);
  dir.create({ idempotent: true, intermediates: true });
  const dest = new File(dir, `${fileStem}.${extensionForUri(uri)}`);
  const source = new File(uri);
  await source.copy(dest);
  return dest.uri;
}

/**
 * Stored voice URIs are absolute, but the iOS app container UUID changes on
 * every binary install — re-anchor persisted paths to the current documents
 * directory so older notes keep playing after an app update.
 */
export function resolveJournalVoiceUri(uri: string): string {
  if (Platform.OS === 'web' || uri.startsWith('ontrack-media:')) return uri;
  const marker = `/${JOURNAL_VOICE_DIRECTORY}/`;
  const index = uri.lastIndexOf(marker);
  if (index === -1) return uri;
  const name = uri.slice(index + marker.length);
  if (!name || name.includes('/')) return uri;
  return new File(new Directory(Paths.document, JOURNAL_VOICE_DIRECTORY), name).uri;
}

export async function deleteJournalVoice(uri: string | null | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  try {
    const file = new File(resolveJournalVoiceUri(uri));
    if (file.exists) file.delete();
  } catch {
    // Best-effort cleanup; store references are cleared separately.
  }
}

export async function deleteAllJournalVoice(): Promise<void> {
  if (Platform.OS === 'web') return;
  const directory = new Directory(Paths.document, JOURNAL_VOICE_DIRECTORY);
  if (!directory.exists) return;
  try {
    await directory.delete();
  } catch {
    // Best-effort cleanup.
  }
}
