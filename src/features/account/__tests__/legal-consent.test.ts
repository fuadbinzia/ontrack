import {
    PRIVACY_POLICY_UPDATED,
    TERMS_OF_USE_UPDATED,
} from '@/constants/legal';
import { usePreferences } from '@/store/preferences';

import {
    createLegalConsentRecord,
    isLegalConsentRecord,
    legalConsentMatchesCurrent,
} from '../legal-consent';

describe('legal consent', () => {
  it('stamps the current privacy and terms versions', () => {
    const record = createLegalConsentRecord(new Date('2026-08-17T15:00:00.000Z'));
    expect(record).toEqual({
      privacyUpdated: PRIVACY_POLICY_UPDATED,
      termsUpdated: TERMS_OF_USE_UPDATED,
      acceptedAt: '2026-08-17T15:00:00.000Z',
    });
    expect(legalConsentMatchesCurrent(record)).toBe(true);
    expect(legalConsentMatchesCurrent({ ...record, termsUpdated: 'January 1, 2020' })).toBe(
      false,
    );
    expect(isLegalConsentRecord({ privacyUpdated: 'x' })).toBe(false);
  });

  it('records consent on first-run onboarding and defaults analytics off', () => {
    usePreferences.getState().resetAll();
    expect(usePreferences.getState().usageAnalyticsEnabled).toBe(false);
    expect(usePreferences.getState().legalConsent).toBeNull();

    usePreferences.getState().completeOnboarding({ name: 'Alex Rivera', goal: 'Stay organized' });
    const consent = usePreferences.getState().legalConsent;
    expect(consent?.privacyUpdated).toBe(PRIVACY_POLICY_UPDATED);
    expect(consent?.termsUpdated).toBe(TERMS_OF_USE_UPDATED);
    expect(consent?.acceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(usePreferences.getState().usageAnalyticsEnabled).toBe(false);
  });
});
