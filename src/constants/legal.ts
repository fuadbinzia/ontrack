/** Public legal pages on the production EAS Hosting alias. */
export const ONTRACK_LEGAL_BASE_URL = 'https://ontrack.expo.app';

/**
 * Product support contact for privacy / terms / account deletion.
 * Set EXPO_PUBLIC_SUPPORT_EMAIL in EAS / .env — never hardcode a personal inbox.
 */
export const ONTRACK_SUPPORT_EMAIL =
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@ontrack.expo.app';

export const PRIVACY_POLICY_URL = `${ONTRACK_LEGAL_BASE_URL}/privacy`;
export const TERMS_OF_USE_URL = `${ONTRACK_LEGAL_BASE_URL}/terms`;

export const PRIVACY_POLICY_UPDATED = 'August 17, 2026';
export const TERMS_OF_USE_UPDATED = 'August 17, 2026';
