import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/services/cloud/supabase';
import { FriendsError } from '@/services/friends';
import { persistJpegToDocuments } from '@/utils/image-persist';
import { newId } from '@/utils/id';

const BUCKET = 'profile-avatars';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30;
const SIGNED_URL_CACHE_MS = 60 * 60 * 24 * 7 * 1000;

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

async function imageBytes(uri: string) {
  if (Platform.OS !== 'web' && uri.startsWith('file://')) {
    return new File(uri).arrayBuffer();
  }
  const response = await fetch(uri);
  if (!response.ok) throw new FriendsError('The avatar photo could not be read.');
  return response.arrayBuffer();
}

/** Persist a picked photo into documents for local/offline avatar use. */
export async function persistAvatarPhoto(uri: string): Promise<string> {
  return persistJpegToDocuments(uri, {
    width: 512,
    compress: 0.85,
    directorySegments: ['profile-avatars'],
    fileStem: newId('avatar'),
  });
}

/** Upload a local avatar JPEG and return the storage object path. */
export async function uploadProfileAvatarPhoto(
  userId: string,
  localUri: string,
): Promise<string> {
  const client = getSupabaseClient();
  if (!client) {
    throw new FriendsError('Cloud sync is not configured for this build.');
  }
  const path = `${userId}/avatar.jpg`;
  const { error } = await client.storage.from(BUCKET).upload(path, await imageBytes(localUri), {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) {
    throw new FriendsError(error.message || 'Avatar photo could not be uploaded.');
  }
  signedUrlCache.delete(path);
  return path;
}

export function peekProfileAvatarUrl(
  photoPath: string | undefined,
): string | undefined {
  const path = photoPath?.trim();
  if (!path) return undefined;
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  return undefined;
}

export function initialAvatarPhotoUrl(meta?: {
  kind?: string;
  localPhotoUri?: string;
  photoPath?: string;
}): string | undefined {
  if (meta?.kind !== 'photo') return undefined;
  return meta.localPhotoUri ?? peekProfileAvatarUrl(meta.photoPath);
}

/** Mint (or reuse) a signed URL for a profile avatar storage path. */
export async function resolveProfileAvatarUrl(
  photoPath: string | undefined,
): Promise<string | undefined> {
  const path = photoPath?.trim();
  if (!path) return undefined;
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const client = getSupabaseClient();
  if (!client) return undefined;
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return undefined;
  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_CACHE_MS,
  });
  return data.signedUrl;
}
