import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const profile = readFileSync(resolve(process.cwd(), 'src/app/(tabs)/profile/index.tsx'), 'utf8');

it('places Calendar Sync once between Account and Appearance', () => {
  const account = profile.indexOf('AgentUiIds.profile.section.account');
  const accountSyncing = profile.indexOf('AgentUiIds.profile.section.accountSyncing');
  const appearance = profile.indexOf('AgentUiIds.profile.section.appearance');

  expect(account).toBeGreaterThanOrEqual(0);
  expect(accountSyncing).toBeGreaterThan(account);
  expect(appearance).toBeGreaterThan(accountSyncing);
  expect(profile.match(/label="Calendar Sync"/g)).toHaveLength(1);
});
