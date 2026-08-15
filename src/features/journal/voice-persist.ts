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

export async function deleteJournalVoice(uri: string | null | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  try {
    const file = new File(uri);
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
