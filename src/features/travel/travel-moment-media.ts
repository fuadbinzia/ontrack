import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import {
    CLOUD_MEDIA_MARKER_PREFIX,
    cloudMediaMarkerFromUri,
} from '@/services/cloud/media';
import { persistJpegToDocuments } from '@/utils/image-persist';

const DIRECTORY_NAME = 'travel-moments';
const MOMENTS_MARKER = `/Documents/${DIRECTORY_NAME}/`;

export function normalizeTravelPhotoUris(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const uris = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => cloudMediaMarkerFromUri(entry) ?? entry.trim())
    .filter(
      (entry) =>
        entry.startsWith('file://') ||
        entry.startsWith('content://') ||
        entry.startsWith(CLOUD_MEDIA_MARKER_PREFIX),
    );
  return uris.length ? uris : undefined;
}

/** True when expo-image can be given this URI (local bytes or remote/https). */
export function isLoadableTravelPhotoUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('content://')
  ) {
    return true;
  }
  if (!trimmed.startsWith('file://')) return false;
  return readableLocalFileUri(trimmed) != null;
}

/** Resolve stored photo URIs against the current app Documents container. */
export function resolveTravelPhotoUris(uris?: string[]): string[] {
  if (!uris?.length) return [];
  const resolved: string[] = [];
  for (const uri of uris) {
    const next = resolveTravelPhotoUri(uri);
    if (next) resolved.push(next);
  }
  return resolved;
}

function readableLocalFileUri(uri: string): string | undefined {
  try {
    const file = new File(uri);
    // size === 0 means missing or unreadable — those paint as blank tiles.
    if (!file.exists || file.size <= 0) return undefined;
    return file.uri || uri;
  } catch {
    return undefined;
  }
}

function resolveTravelPhotoUri(uri: string): string | undefined {
  if (uri.startsWith('ontrack-media:')) return uri;
  const direct = readableLocalFileUri(uri);
  if (direct) return direct;

  if (Platform.OS === 'web' || !uri.startsWith('file://')) return undefined;

  const markerIndex = uri.indexOf(MOMENTS_MARKER);
  if (markerIndex < 0) return undefined;
  const relative = uri
    .slice(markerIndex + '/Documents/'.length)
    .split('?')[0]
    ?.replace(/^\/+/, '');
  if (!relative) return undefined;

  try {
    const remapped = new File(Paths.document, ...relative.split('/').filter(Boolean));
    if (!remapped.exists || remapped.size <= 0) return undefined;
    return remapped.uri;
  } catch {
    return undefined;
  }
}

export function isOwnedTravelMomentPhoto(uri: string) {
  return uri.startsWith('file://') && uri.includes(`/${DIRECTORY_NAME}/`);
}

/** Re-encode picker/camera images into durable Documents/travel-moments storage. */
export async function persistTravelMomentPhotos(
  uris: string[],
  itemId: string,
): Promise<string[]> {
  const persisted: string[] = [];
  for (let index = 0; index < uris.length; index += 1) {
    const uri = uris[index];
    if (!uri) continue;
    if (isOwnedTravelMomentPhoto(uri) || uri.startsWith('ontrack-media:')) {
      persisted.push(uri);
      continue;
    }
    const next = await persistJpegToDocuments(uri, {
      width: 1_600,
      compress: 0.82,
      directorySegments: [DIRECTORY_NAME],
      fileStem: `${itemId}-${index}`,
    });
    persisted.push(next);
  }
  return persisted;
}

export async function cleanupOrphanedTravelMomentPhotos(
  referencedUris: readonly string[],
) {
  if (Platform.OS === 'web') return;
  const directory = new Directory(Paths.document, DIRECTORY_NAME);
  if (!directory.exists) return;
  const referenced = new Set(referencedUris.filter(isOwnedTravelMomentPhoto));
  for (const entry of directory.list()) {
    if (entry instanceof File && !referenced.has(entry.uri)) {
      try {
        entry.delete();
      } catch {
        // Best-effort cleanup must not block navigation.
      }
    }
  }
}
