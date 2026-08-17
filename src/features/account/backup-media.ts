import { Directory, File, Paths } from 'expo-file-system';

import { resolveCloudMediaUri } from '@/services/cloud/media';
import type { OnTrackBackup } from './backup-archive';

export type BackupMediaEntry = {
  path: string;
  mime: string;
  data: string;
};

export type BackupMediaIO = {
  readBase64: (uri: string) => Promise<string | undefined>;
  writeBytes: (relativePath: string, bytes: Uint8Array) => Promise<string>;
};

const DOCUMENTS_MARKER = '/Documents/';

function isPackableMediaUri(value: string): boolean {
  if (value.startsWith('file://') || value.startsWith('content://')) return true;
  if (value.startsWith('ontrack-media:')) return true;
  if (value.startsWith('ontrack-todo-recipe-media:')) return true;
  return false;
}

function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]{1,8})(?:[?#]|$)/.exec(uri);
  return match ? `.${match[1].toLowerCase()}` : '';
}

export function mimeFromMediaUri(uri: string): string {
  const ext = extensionFromUri(uri);
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic' || ext === '.heif') return 'image/heic';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.m4a' || ext === '.aac' || ext === '.mp3') return 'audio/mp4';
  if (ext === '.caf' || ext === '.wav' || ext === '.3gp') return 'audio/x-caf';
  if (ext === '.mp4' || ext === '.m4v' || ext === '.mov' || ext === '.webm') return 'video/mp4';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function documentsRelativePath(uri: string): string {
  const trimmed = uri.split('?')[0] ?? uri;
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }
  const markerIndex = decoded.indexOf(DOCUMENTS_MARKER);
  if (markerIndex >= 0) {
    const relative = decoded.slice(markerIndex + DOCUMENTS_MARKER.length).replace(/^\/+/, '');
    if (relative) return relative;
  }
  const ext = extensionFromUri(decoded) || '.bin';
  const folder = uri.startsWith('ontrack-media:') || uri.startsWith('ontrack-todo-recipe-media:')
    ? 'cloud-media'
    : 'imported';
  return `${folder}/${stableHash(uri)}${ext}`;
}

/**
 * Archive paths are untrusted input — a crafted backup must not climb out of
 * the documents sandbox. Returns the normalized relative path, or undefined
 * when any segment could traverse upward.
 */
export function safeBackupMediaPath(path: unknown): string | undefined {
  if (typeof path !== 'string') return undefined;
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return undefined;
  const unsafe = segments.some(
    (segment) => segment === '.' || segment === '..' || segment.includes('\\'),
  );
  return unsafe ? undefined : segments.join('/');
}

export function collectLocalMediaUris(value: unknown, found = new Set<string>()): string[] {
  if (typeof value === 'string') {
    if (isPackableMediaUri(value)) found.add(value);
    return [...found];
  }
  if (Array.isArray(value)) {
    for (const item of value) collectLocalMediaUris(item, found);
    return [...found];
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'data' || key === 'media') continue;
      collectLocalMediaUris(child, found);
    }
  }
  return [...found];
}

export function rewriteMediaUris(value: unknown, rewritten: Record<string, string>): unknown {
  if (typeof value === 'string') return rewritten[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => rewriteMediaUris(item, rewritten));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, rewriteMediaUris(child, rewritten)]),
    );
  }
  return value;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function decodeMediaBase64(data: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(data, 'base64'));
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function defaultReadBase64(uri: string): Promise<string | undefined> {
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    try {
      const file = new File(uri);
      if (!file.exists || file.size <= 0) return undefined;
      return file.base64();
    } catch {
      return undefined;
    }
  }
  if (!uri.startsWith('ontrack-media:') && !uri.startsWith('ontrack-todo-recipe-media:')) {
    return undefined;
  }
  try {
    const resolved = await resolveCloudMediaUri(uri);
    if (resolved.startsWith('file://') || resolved.startsWith('content://')) {
      return defaultReadBase64(resolved);
    }
    const response = await fetch(resolved);
    if (!response.ok) return undefined;
    return bytesToBase64(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return undefined;
  }
}

async function defaultWriteBytes(relativePath: string, bytes: Uint8Array): Promise<string> {
  const parts = relativePath.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) throw new Error('Backup media path is missing a file name.');
  const directory = parts.length
    ? new Directory(Paths.document, ...parts)
    : new Directory(Paths.document);
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, name);
  destination.create({ overwrite: true, intermediates: true });
  destination.write(bytes);
  return destination.uri || `file://${relativePath}`;
}

const defaultIO: BackupMediaIO = {
  readBase64: defaultReadBase64,
  writeBytes: defaultWriteBytes,
};

/** Embed local photos, videos, voice notes, and other attachments in the backup. */
export async function packBackupMedia(
  backup: OnTrackBackup,
  io: BackupMediaIO = defaultIO,
): Promise<OnTrackBackup> {
  if (backup.media && Object.keys(backup.media).length > 0) return backup;
  const uris = collectLocalMediaUris({ domains: backup.domains, local: backup.local });
  if (uris.length === 0) return backup;
  const media: Record<string, BackupMediaEntry> = {};
  for (const uri of uris) {
    const data = await io.readBase64(uri);
    if (!data) continue;
    media[uri] = {
      path: documentsRelativePath(uri),
      mime: mimeFromMediaUri(uri),
      data,
    };
  }
  return Object.keys(media).length ? { ...backup, media } : backup;
}

/** Write packed attachments onto this device and point the snapshot at the new files. */
export async function unpackBackupMedia(
  backup: OnTrackBackup,
  io: BackupMediaIO = defaultIO,
): Promise<OnTrackBackup> {
  const packed = backup.media;
  if (!packed || Object.keys(packed).length === 0) return backup;
  const rewritten: Record<string, string> = {};
  for (const [sourceUri, entry] of Object.entries(packed)) {
    const path = safeBackupMediaPath(entry?.path);
    if (!entry?.data || !path) continue;
    try {
      rewritten[sourceUri] = await io.writeBytes(path, decodeMediaBase64(entry.data));
    } catch {
      // Keep the original reference; restore of the rest of the archive still proceeds.
    }
  }
  const next = rewriteMediaUris(
    { domains: backup.domains, local: backup.local },
    rewritten,
  ) as Pick<OnTrackBackup, 'domains' | 'local'>;
  return {
    ...backup,
    domains: next.domains,
    local: next.local,
    media: undefined,
  };
}
