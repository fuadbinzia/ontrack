import {
    PRIVACY_POLICY_UPDATED,
    TERMS_OF_USE_UPDATED,
} from '@/constants/legal';

export type LegalConsentRecord = {
  privacyUpdated: string;
  termsUpdated: string;
  acceptedAt: string;
};

export function createLegalConsentRecord(now = new Date()): LegalConsentRecord {
  return {
    privacyUpdated: PRIVACY_POLICY_UPDATED,
    termsUpdated: TERMS_OF_USE_UPDATED,
    acceptedAt: now.toISOString(),
  };
}

export function isLegalConsentRecord(value: unknown): value is LegalConsentRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<LegalConsentRecord>;
  return (
    typeof record.privacyUpdated === 'string' &&
    typeof record.termsUpdated === 'string' &&
    typeof record.acceptedAt === 'string' &&
    Boolean(record.privacyUpdated && record.termsUpdated && record.acceptedAt)
  );
}

export function legalConsentMatchesCurrent(
  record: LegalConsentRecord | null | undefined,
): boolean {
  return Boolean(
    record &&
      record.privacyUpdated === PRIVACY_POLICY_UPDATED &&
      record.termsUpdated === TERMS_OF_USE_UPDATED,
  );
}
