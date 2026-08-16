import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8');
}

describe('production OTA graph stays off the agent-ui ops barrel', () => {
  it('keeps @/utils/agent-ui chrome-only so fixtures and flows are not in every screen', () => {
    const barrel = read('src/utils/agent-ui/index.ts');
    expect(barrel).toContain("from './AgentTestId'");
    expect(barrel).toContain("from './ids'");
    expect(barrel).toContain("from './use-agent-ui-target'");
    expect(barrel).not.toContain("from './fixtures'");
    expect(barrel).not.toContain("from './flows'");
    expect(barrel).not.toContain("from './handle-agent-ui-url'");
    expect(barrel).not.toContain("from './http-bridge'");
    expect(barrel).not.toContain("from './persist'");
    expect(barrel).not.toContain("from './AgentUiOverlay'");
    expect(barrel).not.toContain("from './AgentUiRouteSync'");
  });

  it('loads overlay, native-intent, and agent/ui ops only behind __DEV__', () => {
    const layout = read('src/app/_layout.tsx');
    const nativeIntent = read('src/app/+native-intent.ts');
    const agentRoute = read('src/app/agent/ui.tsx');
    const startup = read('src/hooks/use-root-startup-effects.ts');
    const metro = read('metro.config.js');

    expect(layout).toContain("if (__DEV__)");
    expect(layout).toContain("require('@/utils/agent-ui/AgentUiOverlay')");
    expect(layout).not.toContain("from '@/utils/agent-ui/AgentUiOverlay'");
    expect(nativeIntent).toContain('if (__DEV__)');
    expect(nativeIntent).toContain("require('@/utils/agent-ui/handle-agent-ui-url')");
    expect(nativeIntent).not.toContain("from '@/utils/agent-ui'");
    expect(agentRoute).toContain("require('@/utils/agent-ui/handle-agent-ui-url')");
    expect(startup).toContain("require('@/utils/agent-ui/handle-agent-ui-url')");
    expect(metro).toContain('__tests__');
    expect(metro).toContain('(test|spec)');
  });
});
