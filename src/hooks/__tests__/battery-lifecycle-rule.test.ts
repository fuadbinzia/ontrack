import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('battery lifecycle contracts', () => {
  it('mounts tabs lazily and suspends inactive sections', () => {
    const tabs = read('src/app/(tabs)/_layout.tsx');
    const nav = read('src/components/navigation/bottom-nav-bar.tsx');

    expect(tabs).toContain('detachInactiveScreens={false}');
    expect(tabs).toContain('freezeOnBlur: route.name !== MORE_TAB_ROUTE');
    expect(tabs).toContain('lazy: true');
    expect(nav).not.toContain('navigation.preload');
  });

  it('scopes root realtime collaboration to its visible foreground section', () => {
    const root = read('src/app/_layout.tsx');

    expect(root).toContain("phase === 'authenticated' && appIsActive");
    expect(root).toMatch(/pathIsWithin\(pathname, \[[\s\S]*?'\/to-do'/);
    expect(root).toContain("pathIsWithin(pathname, ['/vehicles', '/v'])");
  });

  it('stops native sensors and continuous FX when the route is inactive', () => {
    const activity = read('src/hooks/use-app-activity.ts');
    const performanceTier = read('src/hooks/use-performance-tier.ts');
    const quality = read('src/features/travel/use-travel-sky-quality.ts');
    const tilt = read('src/features/travel/use-tilt-sky-motion.ts');
    const moon = read('src/features/travel/travel-phase-moon.tsx');
    const fan = read('src/features/games/balloon-pop/fan.tsx');

    expect(activity).toContain('focused && appIsActive');
    expect(performanceTier).toContain('allowsLoopMotion: false');
    expect(performanceTier).toContain('allowsSensors: false');
    expect(quality).toContain('active && allowsLoopMotion');
    expect(quality).toContain('active && base.tilt && allowsSensors');
    expect(tilt).toContain('subscription?.remove()');
    expect(tilt).not.toContain("AppState.addEventListener('change'");
    expect(moon).toContain('if (!routeIsActive)');
    expect(fan).toContain('!routeIsActive');
  });

  it('does not run the dev command-file fallback as a permanent interval', () => {
    const agentBridge = read('src/utils/agent-ui/AgentUiRouteSync.tsx');

    expect(agentBridge).not.toContain('setInterval(');
    expect(agentBridge).toContain(
      'if (!isAgentUiEnabled() || !appIsActive) return',
    );
  });
});
