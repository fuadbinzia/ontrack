import { Directory, File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import TravelDocumentReader from '../../../modules/travel-document-reader';

import type { EzPassImportAsset } from './ezpass-import';

const STATEMENTS_MARKER = '/Documents/finance-docs/ezpass/';

function safeFileName(name: string, index: number): string {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? 'bin';
  const stem = name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 48) || `statement-${index + 1}`;
  return `${stem}-${Date.now()}-${index}.${extension}`;
}

export async function persistEzPassStatementAssets(
  assets: EzPassImportAsset[],
): Promise<string[]> {
  if (Platform.OS === 'web') return assets.map((asset) => asset.uri).filter(Boolean);
  const directory = new Directory(Paths.document, 'finance-docs', 'ezpass');
  directory.create({ idempotent: true, intermediates: true });
  const uris: string[] = [];
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    if (!asset.uri) continue;
    const destination = new File(directory, safeFileName(asset.name, index));
    try {
      await new File(asset.uri).copy(destination);
      uris.push(destination.uri);
    } catch {
      if (asset.uri.startsWith('file:') || asset.uri.startsWith('content:')) {
        uris.push(asset.uri);
      }
    }
  }
  return uris;
}

export function resolveEzPassStatementUri(uri: string): string | undefined {
  if (uri.startsWith('content://')) return uri;
  try {
    if (new File(uri).exists) return uri;
  } catch {
    // Try remapping an old iOS Documents-container URI below.
  }
  if (Platform.OS === 'web' || !uri.startsWith('file://')) return undefined;
  const markerIndex = uri.indexOf(STATEMENTS_MARKER);
  if (markerIndex < 0) return undefined;
  const relative = uri
    .slice(markerIndex + '/Documents/'.length)
    .split('?')[0]
    ?.replace(/^\/+/, '');
  if (!relative) return undefined;
  try {
    const remapped = new File(Paths.document, ...relative.split('/').filter(Boolean));
    return remapped.exists ? remapped.uri : undefined;
  } catch {
    return undefined;
  }
}

export async function openEzPassStatement(uris: string[]): Promise<void> {
  const openable = uris.flatMap((uri) => {
    const resolved = resolveEzPassStatementUri(uri);
    return resolved ? [resolved] : [];
  });
  if (!openable.length) return;
  if (Platform.OS !== 'web' && TravelDocumentReader?.previewDocumentsAsync) {
    try {
      await TravelDocumentReader.previewDocumentsAsync(openable);
      return;
    } catch {
      // Fall through to the platform URL handler.
    }
  }
  await Linking.openURL(openable[0]);
}
