import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { StackRouter } from 'expo-router/build/react-navigation/routers/StackRouter';

type AnyState = ReturnType<ReturnType<typeof StackRouter>['getInitialState']>;

const routerOptions = { routeParamList: {}, routeGetIdList: {} };

function stackStateWithPreloaded(
  preloaded: { key: string; name: string; params?: Record<string, string> }[],
): AnyState {
  return {
    stale: false as const,
    type: 'stack' as const,
    key: 'stack-test',
    index: 0,
    routeNames: ['index', '[id]'],
    routes: [{ key: 'index-test', name: 'index' }],
    preloadedRoutes: preloaded,
  } as unknown as AnyState;
}

/**
 * First tap on a checklist opened the wrong list: the hub prefetch leaves a
 * preloaded `[id]` route behind, and the stack REPLACE action reused it with
 * its *warmed* params instead of the tapped ones (no getId → any same-name
 * preloaded route matches). Patched in patches/expo-router+*.patch.
 */
describe('first checklist tap opens the tapped list, not the warmed one', () => {
  const router = StackRouter({});

  it('replace into a warmed dynamic route applies the tapped params', () => {
    const state = stackStateWithPreloaded([
      { key: '[id]-warmed', name: '[id]', params: { id: 'warmed-list' } },
    ]);

    const next = router.getStateForAction(
      state,
      {
        type: 'REPLACE',
        payload: { name: '[id]', params: { id: 'tapped-list' } },
      },
      routerOptions,
    );

    expect(next?.routes[next.index]?.params).toEqual({ id: 'tapped-list' });
    // The warmed route is consumed — later taps navigate fresh.
    expect(next?.preloadedRoutes).toEqual([]);
  });

  it('replace without any preloaded route still lands on the tapped params', () => {
    const next = router.getStateForAction(
      stackStateWithPreloaded([]),
      {
        type: 'REPLACE',
        payload: { name: '[id]', params: { id: 'tapped-list' } },
      },
      routerOptions,
    );

    expect(next?.routes[next.index]?.params).toEqual({ id: 'tapped-list' });
  });

  it('navigate into a warmed dynamic route also applies the tapped params', () => {
    const next = router.getStateForAction(
      stackStateWithPreloaded([
        { key: '[id]-warmed', name: '[id]', params: { id: 'warmed-list' } },
      ]),
      {
        type: 'NAVIGATE',
        payload: { name: '[id]', params: { id: 'tapped-list' } },
      },
      routerOptions,
    );

    expect(next?.routes[next.index]?.params).toEqual({ id: 'tapped-list' });
  });

  it('preloading the same dynamic route again keeps only the newest params', () => {
    const first = router.getStateForAction(
      stackStateWithPreloaded([]),
      { type: 'PRELOAD', payload: { name: '[id]', params: { id: 'list-a' } } },
      routerOptions,
    );
    const second = router.getStateForAction(
      first!,
      { type: 'PRELOAD', payload: { name: '[id]', params: { id: 'list-b' } } },
      routerOptions,
    );

    // One preloaded route per screen name — warming many ids is churn with a
    // single survivor, which is why the hub warms only the top list.
    expect(second?.preloadedRoutes.map((route) => route.params)).toEqual([
      { id: 'list-b' },
    ]);
  });

  it('hub warms only the top list route so no wrong-id route can survive', () => {
    const overview = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-lists-overview.tsx'),
      'utf8',
    );
    expect(overview).toContain('lists.slice(0, 1)');
  });

  it('keeps the router params fix pinned as a patch-package patch', () => {
    const patch = readdirSync(join(process.cwd(), 'patches')).find((name) =>
      name.startsWith('expo-router+'),
    );
    expect(patch).toBeDefined();
    const contents = readFileSync(join(process.cwd(), 'patches', patch!), 'utf8');
    expect(contents).toContain('StackRouter.js');
    expect(contents).toContain('createParamsFromAction');
  });
});
