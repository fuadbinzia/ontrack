import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

describe('critical domain integration boundaries', () => {
  it('keeps authenticated session lifecycle wired to account sync preparation and cancellation', () => {
    const provider = source('src/features/auth/auth-provider.tsx');
    expect(provider).toContain("from '@/services/cloud/sync'");
    expect(provider).toContain('prepareAccountSync(');
    expect(provider).toContain('cancelAccountSync(');
    expect(provider).toContain('resolveAccountSync(');
  });

  it('keeps todo collaboration orchestration connected to both service and store state', () => {
    const hook = source('src/hooks/use-todo-collaboration.ts');
    expect(hook).toContain("from '@/services/todos/collaboration'");
    expect(hook).toContain("from '@/store/todos'");
  });

  it('keeps vehicle collaboration orchestration connected to both service and store state', () => {
    const hook = source('src/hooks/use-vehicle-collaboration.ts');
    expect(hook).toContain("from '@/services/vehicles/collaboration'");
    expect(hook).toContain("from '@/store/vehicles'");
  });
});
