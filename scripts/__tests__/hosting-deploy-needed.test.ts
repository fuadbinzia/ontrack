import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import {
  hostingDeployNeeded,
  manifestHostingChanged,
} from '../lib/hosting-deploy-needed.mjs';

const helper = join(process.cwd(), 'scripts/lib/hosting-deploy-needed.mjs');

function decide(files: string[]): string {
  return execFileSync('node', [helper], {
    input: files.join('\n'),
    encoding: 'utf8',
  }).trim();
}

describe('hosting deploy gate', () => {
  it('skips UI-only ship diffs so push does not re-export web', () => {
    expect(
      hostingDeployNeeded([
        'src/features/travel/travel-plan-detail.tsx',
        'src/app/(tabs)/profile/index.tsx',
        'src/features/account/release-notes-user.ts',
        'docs/agent-ui-map.md',
      ]),
    ).toBe(false);
    expect(decide(['src/features/journal/journal-screen.tsx'])).toBe('skip');
  });

  it('skips the version bump that every ship:push writes', () => {
    expect(
      hostingDeployNeeded(['app.json', 'package.json'], {
        'app.json': false,
        'package.json': false,
      }),
    ).toBe(false);
    expect(
      manifestHostingChanged(
        'app.json',
        JSON.stringify({ expo: { version: '1.0.1', android: { versionCode: 1 } } }),
        JSON.stringify({ expo: { version: '1.0.2', android: { versionCode: 2 } } }),
      ),
    ).toBe(false);
    expect(
      manifestHostingChanged(
        'package.json',
        JSON.stringify({ name: 'ontrack', version: '1.0.1' }),
        JSON.stringify({ name: 'ontrack', version: '1.0.2' }),
      ),
    ).toBe(false);
  });

  it('deploys when an API route or hosting config changes', () => {
    expect(hostingDeployNeeded(['src/app/api/backup/google/callback+api.ts'])).toBe(
      true,
    );
    expect(hostingDeployNeeded(['src/app/meal-analysis/photo+api.ts'])).toBe(true);
    expect(hostingDeployNeeded(['eas.json'])).toBe(true);
    expect(hostingDeployNeeded(['package-lock.json'])).toBe(true);
    expect(hostingDeployNeeded(['metro.config.js'])).toBe(true);
    expect(hostingDeployNeeded(['babel.config.js'])).toBe(true);
    expect(decide(['src/app/api/calendar/google/sync+api.ts'])).toBe('needed');
  });

  it('deploys when app.json hosting config changes beside the version bump', () => {
    expect(
      manifestHostingChanged(
        'app.json',
        JSON.stringify({
          expo: { version: '1.0.1', web: { output: 'single' } },
        }),
        JSON.stringify({
          expo: { version: '1.0.2', web: { output: 'server' } },
        }),
      ),
    ).toBe(true);
    expect(
      hostingDeployNeeded(['app.json', 'src/features/todos/todo-list-screen.tsx'], {
        'app.json': true,
      }),
    ).toBe(true);
  });

  it('ignores empty paths and still deploys when a hosting file is mixed in', () => {
    expect(hostingDeployNeeded([])).toBe(false);
    expect(hostingDeployNeeded(['', '  '])).toBe(false);
    expect(
      hostingDeployNeeded([
        'src/features/todos/todo-list-screen.tsx',
        'src/app/food/recipe-ideas+api.ts',
      ]),
    ).toBe(true);
  });
});
