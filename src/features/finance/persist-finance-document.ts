import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { newUuid } from '@/utils/id';

/** Pick a tax doc and copy into durable app documents (never picker cache URIs). */
export async function pickAndPersistFinanceDocument(): Promise<
  | { ok: true; uri: string; name: string }
  | { ok: false; cancelled?: boolean; error?: string }
> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) {
    return { ok: false, cancelled: true };
  }
  const asset = result.assets[0];
  const name = asset.name?.trim() || 'Document';
  if (Platform.OS === 'web') {
    return { ok: true, uri: asset.uri, name };
  }
  try {
    const dir = new Directory(Paths.document, 'finance-docs');
    dir.create({ idempotent: true, intermediates: true });
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    const dest = new File(dir, `${newUuid()}${ext}`);
    const source = new File(asset.uri);
    await source.copy(dest);
    return { ok: true, uri: dest.uri, name };
  } catch (error) {
    // Fall back to picker URI when copy fails (e.g. some Android content://).
    if (asset.uri.startsWith('file:') || asset.uri.startsWith('content:')) {
      return { ok: true, uri: asset.uri, name };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save document',
    };
  }
}
