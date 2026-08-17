import {
    ONTRACK_SUPPORT_EMAIL,
    PRIVACY_POLICY_UPDATED,
    TERMS_OF_USE_UPDATED,
} from '@/constants/legal';

import { PRIVACY_POLICY_SECTIONS } from '../privacy-policy-content';
import { TERMS_OF_USE_SECTIONS } from '../terms-of-use-content';

function documentText(
  sections: readonly { title: string; paragraphs: readonly string[] }[],
): string {
  return sections
    .flatMap((section) => [section.title, ...section.paragraphs])
    .join('\n');
}

describe('current legal disclosures', () => {
  it('dates both legal documents to the current product update', () => {
    expect(PRIVACY_POLICY_UPDATED).toBe('August 17, 2026');
    expect(TERMS_OF_USE_UPDATED).toBe('August 17, 2026');
  });

  it('covers newly introduced sensitive data and provider boundaries', () => {
    const privacy = documentText(PRIVACY_POLICY_SECTIONS);

    for (const required of [
      'Plaid',
      'Teller',
      'E-ZPass',
      'Google Calendar',
      'Google Drive',
      'StraiAway',
      'Siri',
      'Face ID',
      'Resend',
      'Food community posts',
      'anonymous device label',
    ]) {
      expect(privacy).toContain(required);
    }
    expect(privacy).toMatch(
      /does not receive your financial-institution login credentials/i,
    );
    expect(privacy).toMatch(/not your raw transaction ledger/i);
    expect(privacy).toMatch(
      /Apple Health summaries[\s\S]*not uploaded through onTrack cloud sync/i,
    );
    expect(privacy).toMatch(/photos, videos, voice notes/i);
    expect(privacy).not.toMatch(/are not packed into the backup file/i);
    expect(privacy).toMatch(/off by default for new installs/i);
    expect(privacy).not.toMatch(/on by default/i);
  });

  it('states the product limits for finance, AI, sharing, and imported data', () => {
    const terms = documentText(TERMS_OF_USE_SECTIONS);

    expect(terms).toMatch(/not a bank, broker, investment adviser/i);
    expect(terms).toMatch(
      /do not create a professional or fiduciary relationship/i,
    );
    expect(terms).toMatch(/E-ZPass imports can misread/i);
    expect(terms).toMatch(/people or audience you select can view/i);
    expect(terms).toMatch(/does not promise to monitor every post/i);
    expect(terms).toMatch(/at least 13 years old/i);
  });

  it('disclaims third-party affiliation and provides a removal contact', () => {
    const privacy = documentText(PRIVACY_POLICY_SECTIONS);
    const terms = documentText(TERMS_OF_USE_SECTIONS);

    expect(privacy).toMatch(
      /does not imply affiliation, sponsorship, endorsement, or an official partnership/i,
    );
    expect(terms).toMatch(/belong to their respective owners/i);
    expect(terms).toMatch(/used only to identify or visually represent/i);
    expect(terms).toMatch(/name, logo, trademark, or other brand material/i);
    expect(terms).toContain(ONTRACK_SUPPORT_EMAIL);
    expect(terms).not.toContain('imithoss@gmail.com');
  });
});
