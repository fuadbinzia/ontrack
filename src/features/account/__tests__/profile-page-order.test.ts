import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const profile = readFileSync(resolve(process.cwd(), 'src/app/(tabs)/profile/index.tsx'), 'utf8');
const hero = readFileSync(
  resolve(process.cwd(), 'src/features/account/profile-identity-hero.tsx'),
  'utf8',
);
const about = readFileSync(
  resolve(process.cwd(), 'src/features/account/profile-about-section.tsx'),
  'utf8',
);

function idIndex(source: string, key: string): number {
  const needle = `AgentUiIds.profile.section.${key}`;
  let from = 0;
  while (from < source.length) {
    const index = source.indexOf(needle, from);
    expect(index).toBeGreaterThanOrEqual(0);
    const next = source[index + needle.length] ?? '';
    if (!/[A-Za-z]/.test(next)) return index;
    from = index + needle.length;
  }
  throw new Error(`Missing ${needle}`);
}

it('keeps Profile as an always-open settings list', () => {
  expect(profile).not.toContain('CollapsibleSection');
  expect(profile).toContain('ProfileIdentityHero');
  expect(profile).toContain('ProfileAboutSection');
});

it('orders you, account, look, preferences, agents, about, then danger', () => {
  const account = idIndex(profile, 'account');
  const connections = idIndex(profile, 'accountSyncing');
  const appearance = idIndex(profile, 'appearance');
  const preferences = idIndex(profile, 'preferences');
  const features = idIndex(profile, 'features');
  const developer = idIndex(profile, 'developer');
  const aboutSection = profile.indexOf('<ProfileAboutSection');
  const danger = idIndex(profile, 'dangerZone');

  expect(connections).toBeGreaterThan(account);
  expect(appearance).toBeGreaterThan(connections);
  expect(preferences).toBeGreaterThan(appearance);
  expect(features).toBeGreaterThan(preferences);
  expect(developer).toBeGreaterThan(features);
  expect(aboutSection).toBeGreaterThan(developer);
  expect(danger).toBeGreaterThan(aboutSection);
});

it('keeps add-ons, nutrition, and AI Summaries off Profile', () => {
  expect(profile).not.toContain('Add-ons');
  expect(profile).not.toContain('section.addons');
  expect(profile).not.toContain('profile.addon');
  expect(profile).not.toContain('profile.nutrition');
  expect(profile).not.toContain('nutrition-profile');
  expect(profile).not.toContain('AI Summaries');
  expect(profile).not.toContain('setAiEnabled');
});

it('puts Calendar Sync under Account without a second header', () => {
  expect(profile).not.toContain('Account Syncing');
  expect(profile.match(/label="Calendar Sync"/g)).toHaveLength(1);
  expect(profile).not.toContain('StraiAway');
  expect(profile).not.toContain('profile.straiaway');
});

it('centers identity on glass and keeps avatar vs name as distinct actions', () => {
  expect(hero).toContain('GlassPlate');
  expect(hero).toContain('Customize profile icon');
  expect(hero).toContain('Edit name and blurb');
  expect(hero).toContain('AgentUiIds.profile.displayName');
  expect(hero).toContain('AgentUiIds.profile.blurb');
  expect(hero.match(/onPress=\{onOpenIdentity\}/g)).toHaveLength(1);
  expect(hero.match(/onPress=\{onOpenAvatar\}/g)).toHaveLength(1);
});

it('folds legal and version into About without TMDB', () => {
  expect(about).toContain('AgentUiIds.profile.section.about');
  expect(about).toContain('AgentUiIds.profile.section.legal');
  expect(about).toContain('AgentUiIds.profile.section.appInformation');
  expect(about).toContain('AgentUiIds.profile.privacy');
  expect(about).toContain('AgentUiIds.profile.terms');
  expect(about).toContain('AgentUiIds.profile.version');
  expect(about).not.toContain('AgentUiIds.profile.section.disclaimers');
  expect(about).not.toContain('AgentUiIds.profile.tmdb');
  expect(about).not.toContain('TMDB');
});
