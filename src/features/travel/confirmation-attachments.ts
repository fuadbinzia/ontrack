import { Directory, File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
    CLOUD_MEDIA_MARKER_PREFIX,
    cloudMediaMarkerFromUri,
    resolveCloudMediaUri,
} from '@/services/cloud/media';
import { openInAppBrowser } from '@/utils/safe-url';

import TravelDocumentReader from '../../../modules/travel-document-reader';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif)$/i;
const CONFIRMATIONS_MARKER = '/Documents/travel-confirmations/';

export function isImageConfirmationUri(uri: string): boolean {
  const path = uri.split('?')[0] ?? uri;
  // Cloud markers embed the extension in the storage path (…/hash.jpg).
  if (path.startsWith(CLOUD_MEDIA_MARKER_PREFIX)) {
    return IMAGE_EXT.test(path.slice(CLOUD_MEDIA_MARKER_PREFIX.length));
  }
  return IMAGE_EXT.test(path);
}

/** Coerce absolute filesystem paths into durable `file://` URIs. */
export function asConfirmationFileUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('ph://') ||
    trimmed.startsWith(CLOUD_MEDIA_MARKER_PREFIX)
  ) {
    return trimmed;
  }
  // Expo File.uri is usually file://…; bare absolute paths still need a scheme
  // or normalizeConfirmationUris will drop them on every savePlan.
  if (trimmed.startsWith('/')) return `file://${trimmed}`;
  return trimmed;
}

export function normalizeConfirmationUris(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const uris = [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => {
          const cloud = cloudMediaMarkerFromUri(entry);
          if (cloud) return cloud;
          return asConfirmationFileUri(entry);
        })
        .filter(
          (entry) =>
            entry.startsWith('file://') ||
            entry.startsWith('content://') ||
            entry.startsWith(CLOUD_MEDIA_MARKER_PREFIX),
        ),
    ),
  ];
  return uris.length ? uris : undefined;
}

/** Resolve stored confirmation URIs against the current app Documents container. */
export function resolveConfirmationUris(uris?: string[]): string[] {
  if (!uris?.length) return [];
  const resolved: string[] = [];
  for (const uri of uris) {
    const next = resolveConfirmationUri(uri);
    if (next) resolved.push(next);
  }
  return resolved;
}

function resolveConfirmationUri(uri: string): string | undefined {
  const trimmed = uri.trim();
  // Android SAF / picker fallbacks stay openable via the system viewer.
  if (trimmed.startsWith('content://')) return trimmed;

  try {
    if (new File(trimmed).exists) return trimmed;
  } catch {
    // Fall through to Documents-relative remap.
  }

  if (Platform.OS === 'web' || !trimmed.startsWith('file://')) return undefined;

  const markerIndex = trimmed.indexOf(CONFIRMATIONS_MARKER);
  if (markerIndex < 0) return undefined;
  const relative = trimmed
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

function extensionForAsset(fileName: string, uri: string): string {
  const fromName = /\.([a-z0-9]+)$/i.exec(fileName)?.[1];
  if (fromName) return `.${fromName.toLowerCase()}`;
  const fromUri = /\.([a-z0-9]+)$/i.exec(uri.split('?')[0] ?? '')?.[1];
  if (fromUri) return `.${fromUri.toLowerCase()}`;
  return '.bin';
}

/**
 * Copy picker/cache confirmation files into durable app documents storage.
 * Temporary OS cache URIs must not be persisted in store state.
 * When `nameHint` is a confirmation code, it is embedded in the filename so
 * orphan-recovery can re-link the file to matching flights later.
 */
export async function persistConfirmationAssets(
  assets: { uri: string; fileName: string }[],
  kind: 'flight' | 'rental' | 'stay' | 'transport',
  options?: { nameHint?: string },
): Promise<string[]> {
  if (Platform.OS === 'web') {
    return assets
      .map((asset) => asConfirmationFileUri(asset.uri))
      .filter(Boolean);
  }
  const directory = new Directory(Paths.document, 'travel-confirmations', kind);
  directory.create({ idempotent: true, intermediates: true });
  const uris: string[] = [];
  const stamp = Date.now();
  const hint = (options?.nameHint ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 12);
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    if (!asset.uri) continue;
    const extension = extensionForAsset(asset.fileName, asset.uri);
    const safeStem = (asset.fileName || `${kind}-confirmation`)
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 40);
    const stem = [hint, safeStem || kind].filter(Boolean).join('-');
    const destination = new File(
      directory,
      `${stem}-${stamp}-${index}${extension}`,
    );
    try {
      const source = new File(asset.uri);
      await source.copy(destination);
      uris.push(asConfirmationFileUri(destination.uri));
    } catch {
      // Fall back to the source URI when copy fails (e.g. content:// on some Android builds).
      const fallback = asConfirmationFileUri(asset.uri);
      if (fallback.startsWith('file://') || fallback.startsWith('content://')) {
        uris.push(fallback);
      }
    }
  }
  return uris;
}

/**
 * Resolve only the confirmation URIs owned by this itinerary item.
 * Never fall back to the kind-wide files on disk: those files can belong to a
 * different flight, stay, rental, or transport item.
 * Cloud `ontrack-media:` markers stay openable after sync (local file may be gone).
 */
export function confirmationUrisForDisplay(
  stored: string[] | undefined,
  _kind: 'flight' | 'rental' | 'stay' | 'transport',
): string[] {
  const normalized = normalizeConfirmationUris(stored);
  if (!normalized?.length) return [];
  const openable: string[] = [];
  for (const uri of normalized) {
    if (uri.startsWith(CLOUD_MEDIA_MARKER_PREFIX)) {
      openable.push(uri);
      continue;
    }
    const resolved = resolveConfirmationUri(uri);
    if (resolved) openable.push(resolved);
  }
  return openable;
}

/** Mint signed URLs for cloud markers so system preview / Image can open them. */
export async function resolveConfirmationUrisForOpen(
  uris: string[],
): Promise<string[]> {
  const openable: string[] = [];
  for (const uri of uris) {
    if (uri.startsWith(CLOUD_MEDIA_MARKER_PREFIX)) {
      openable.push(await resolveCloudMediaUri(uri));
      continue;
    }
    const cloud = cloudMediaMarkerFromUri(uri);
    if (cloud) {
      openable.push(await resolveCloudMediaUri(cloud));
      continue;
    }
    openable.push(uri);
  }
  return openable;
}

/**
 * Newest confirmation files on disk for a kind (name/mtime descending).
 * Used only for explicit orphan-recovery when an item has no stored URIs —
 * never as a display fallback for arbitrary items.
 */
export function newestStoredConfirmationUris(
  kind: 'flight' | 'rental' | 'stay' | 'transport',
  limit = 1,
): string[] {
  if (Platform.OS === 'web' || limit <= 0) return [];
  try {
    const directory = new Directory(Paths.document, 'travel-confirmations', kind);
    if (!directory.exists) return [];
    const entries = directory
      .list()
      .flatMap((entry) => {
        try {
          if (!(entry instanceof File) || !entry.exists) return [];
          const info = entry.info();
          return [{ uri: entry.uri, mtime: info.modificationTime ?? 0 }];
        } catch {
          return [];
        }
      })
      .sort((a, b) => b.mtime - a.mtime || b.uri.localeCompare(a.uri));
    return entries.slice(0, limit).map((entry) => entry.uri);
  } catch {
    return [];
  }
}

function isRemoteConfirmationUri(uri: string): boolean {
  return uri.startsWith('https://') || uri.startsWith('http://');
}

/**
 * Open confirmations in the system document preview (Quick Look / viewer).
 * Cloud-synced confirmations resolve to signed https URLs, which the native
 * preview cannot load — those stay in the in-app browser instead of Safari.
 */
export async function openConfirmationAttachments(uris: string[]): Promise<void> {
  const display = confirmationUrisForDisplay(uris, 'flight');
  const candidates = display.length
    ? display
    : uris.filter(
        (uri) =>
          uri.startsWith('file://') ||
          uri.startsWith('content://') ||
          uri.startsWith(CLOUD_MEDIA_MARKER_PREFIX) ||
          uri.startsWith('https://'),
      );
  const openable = await resolveConfirmationUrisForOpen(candidates);
  if (!openable.length) return;

  const localFiles = openable.filter((uri) => !isRemoteConfirmationUri(uri));
  if (localFiles.length) {
    try {
      if (TravelDocumentReader?.previewDocumentsAsync) {
        await TravelDocumentReader.previewDocumentsAsync(localFiles);
        return;
      }
    } catch (error) {
      if (__DEV__) console.warn('[openConfirmationAttachments] preview failed', error);
    }
  }

  const first = openable[0];
  if (isRemoteConfirmationUri(first)) {
    await openInAppBrowser(first);
    return;
  }
  await Linking.openURL(first);
}
