import { createHash } from 'node:crypto';

/**
 * OpenAI `safety_identifier` must not be a raw account id.
 * Hash with a server secret so the vendor sees only a stable opaque token.
 */
function openaiSafetyHashSecret(): string {
  const fromEnv =
    process.env.ANALYTICS_INSTALL_HASH_SECRET?.trim() ||
    process.env.OPENAI_SAFETY_HASH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  const appEnv = (
    process.env.EXPO_PUBLIC_APP_ENV ||
    process.env.EAS_BUILD_PROFILE ||
    ''
  ).toLowerCase();
  if (
    appEnv === 'production' ||
    appEnv === 'preview' ||
    appEnv === 'testflight' ||
    appEnv === 'device'
  ) {
    throw new Error('OPENAI_SAFETY_HASH_SECRET is required');
  }
  return 'ontrack-openai-safety';
}

export function openaiSafetyIdentifier(userId: string | undefined | null): string {
  const subject = userId?.trim() || 'anonymous';
  return createHash('sha256')
    .update(`${openaiSafetyHashSecret()}:${subject}`)
    .digest('hex')
    .slice(0, 32);
}
