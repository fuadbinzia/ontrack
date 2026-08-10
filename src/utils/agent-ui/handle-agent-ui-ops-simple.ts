import { Platform } from 'react-native';

import { useUI } from '@/store/ui';
import { todayKey } from '@/utils/date';

import { dismissAgentUiOverlays } from './dismiss-overlays';
import {
  AGENT_UI_ANDROID_WAIT_TIMEOUT_MS,
  AGENT_UI_WAIT_TIMEOUT_MS,
} from './flows';
import { asNumber, asSingle, sleep } from './handle-agent-ui-helpers';
import { hasWaitTarget, routeMatches } from './handle-agent-ui-assert';
import type { AgentUiOp, AgentUiRequest } from './handle-agent-ui-types';
import {
  isAgentUiOverlayEnabled,
  setAgentUiOverlayEnabled,
  toggleAgentUiOverlay,
} from './overlay';
import { writeAgentUiDump, writeAgentUiStatus } from './persist';
import {
  getAgentUiTarget,
  hitAgentUiTarget,
  hitAgentUiTargets,
  listAgentUiTargets,
  tapAgentUiTarget,
} from './registry';
import {
  agentUiNavigate,
  getAgentUiRoute,
  resolveAgentUiDestination,
} from './route';
import { scrollAgentUiTargetIntoView } from './scroll-into-view';

export async function continueAgentUiRequest(
  request: AgentUiRequest,
  ctx: {
    emitStatus: boolean;
    op: AgentUiOp;
    id: string | undefined;
    prefix: string | undefined;
    to: string | undefined;
    refreshDump: boolean;
  },
): Promise<boolean> {
  const { emitStatus, op, id, prefix, to, refreshDump } = ctx;

  if (op === 'wait') {
    const settleMs = Math.max(0, asNumber(request.ms) ?? 0);
    const defaultWaitMs =
      Platform.OS === 'android'
        ? AGENT_UI_ANDROID_WAIT_TIMEOUT_MS
        : AGENT_UI_WAIT_TIMEOUT_MS;
    const timeoutMs = Math.max(
      settleMs,
      asNumber(request.timeoutMs) ??
        (hasWaitTarget(id, prefix, to) ? defaultWaitMs : settleMs || 0),
    );
    if (settleMs > 0) await sleep(settleMs);

    const routeTarget = to;
    const started = Date.now();
    const poll = () => {
      if (id && getAgentUiTarget(id)) return true;
      if (
        prefix &&
        listAgentUiTargets().some((e) => e.testID.startsWith(prefix))
      ) {
        return true;
      }
      if (routeTarget && routeMatches(getAgentUiRoute(), routeTarget)) {
        return true;
      }
      return false;
    };

    if (!hasWaitTarget(id, prefix, routeTarget)) {
      if (emitStatus) {
        await writeAgentUiStatus({
          op: 'wait',
          ok: true,
          detail: `delayed ${settleMs}ms`,
          route: getAgentUiRoute(),
        });
      }
      return true;
    }

    let ok = poll();
    while (!ok && Date.now() - started < timeoutMs) {
      await sleep(16);
      ok = poll();
    }
    const count = prefix
      ? listAgentUiTargets().filter((e) => e.testID.startsWith(prefix)).length
      : undefined;
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'wait',
        id: id ?? prefix ?? routeTarget,
        ok,
        detail: ok
          ? `ready after ${Date.now() - started}ms`
          : `timed out after ${timeoutMs}ms`,
        count,
        route: getAgentUiRoute(),
      });
    }
    return ok;
  }

  if (op === 'dump') {
    const dump = writeAgentUiDump();
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'dump',
        ok: true,
        detail: `Wrote ${dump.count} elements.`,
        count: dump.count,
        route: dump.route,
        // Host materializes Android dumps from status (no simctl container).
        elements: dump.elements,
      });
    }
    return true;
  }

  if (op === 'overlay') {
    const mode = (to ?? id ?? 'toggle').trim().toLowerCase();
    let enabled = isAgentUiOverlayEnabled();
    if (mode === 'on' || mode === '1' || mode === 'true' || mode === 'yes') {
      setAgentUiOverlayEnabled(true);
      enabled = true;
    } else if (
      mode === 'off' ||
      mode === '0' ||
      mode === 'false' ||
      mode === 'no'
    ) {
      setAgentUiOverlayEnabled(false);
      enabled = false;
    } else if (mode === 'status' || mode === 'get') {
      // leave as-is
    } else {
      enabled = toggleAgentUiOverlay();
    }
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'overlay',
        ok: true,
        detail: enabled ? 'overlay on' : 'overlay off',
        id: enabled ? 'on' : 'off',
        route: getAgentUiRoute(),
      });
    }
    return true;
  }

  if (op === 'devmode') {
    const mode = (to ?? id ?? 'status').trim().toLowerCase();
    // Lazy require keeps unit tests free of the controller graph.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      enterDevMode,
      exitAgentDevModeIfNeeded,
      exitDevMode,
    } = require('@/features/account/dev-mode-controller') as typeof import('@/features/account/dev-mode-controller');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useDevMode } =
      require('@/store/dev-mode') as typeof import('@/store/dev-mode');

    if (mode === 'on' || mode === '1' || mode === 'true' || mode === 'yes') {
      await enterDevMode('agent');
    } else if (
      mode === 'off' ||
      mode === '0' ||
      mode === 'false' ||
      mode === 'no' ||
      mode === 'release'
    ) {
      // Prefer agent-only exit so a user-owned sandbox stays on.
      if (mode === 'release') {
        await exitAgentDevModeIfNeeded();
      } else {
        await exitDevMode();
      }
    } else if (mode === 'status' || mode === 'get') {
      // leave as-is
    } else {
      if (emitStatus) {
        await writeAgentUiStatus({
          op: 'devmode',
          ok: false,
          detail: `Unknown mode: ${mode} (use on|off|release|status)`,
          route: getAgentUiRoute(),
        });
      }
      return false;
    }

    const state = useDevMode.getState();
    const detail = state.enabled
      ? `devmode on (source=${state.source ?? 'unknown'})`
      : 'devmode off';
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'devmode',
        ok: true,
        detail,
        id: state.enabled ? 'on' : 'off',
        route: getAgentUiRoute(),
      });
    }
    return true;
  }

  if (op === 'login') {
    // Lazy require keeps unit tests free of the auth/supabase graph.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runAgentUiLogin } = require('./agent-login') as typeof import('./agent-login');
    const result = await runAgentUiLogin({
      email: asSingle(request.email),
      password: asSingle(request.password),
    });
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'login',
        // Detail carries the account email only — never the password.
        id: result.email,
        ok: result.ok,
        detail: result.detail,
        route: getAgentUiRoute(),
      });
    }
    return result.ok;
  }

  if (op === 'hit') {
    const x = asNumber(request.x) ?? asNumber(asSingle(request.id)?.split(',')[0]);
    const y =
      asNumber(request.y) ??
      asNumber(asSingle(request.id)?.split(',')[1]) ??
      asNumber(to);
    if (x === undefined || y === undefined) {
      if (emitStatus) {
        await writeAgentUiStatus({
          op: 'hit',
          ok: false,
          detail: 'Missing x/y (logical window points).',
          route: getAgentUiRoute(),
        });
      }
      return false;
    }
    const element = hitAgentUiTarget(x, y);
    const stack = hitAgentUiTargets(x, y);
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'hit',
        id: element?.testID,
        ok: Boolean(element),
        detail: element
          ? `hit ${element.testID} @ (${x},${y}) stack=${stack.length}`
          : `no target @ (${x},${y})`,
        element,
        count: stack.length,
        route: getAgentUiRoute(),
      });
    }
    return Boolean(element);
  }

  if (op === 'dismiss') {
    const scope = prefix ?? id ?? 'ontrack.';
    const { tapped, rounds } = dismissAgentUiOverlays(scope);
    if (tapped.length > 0) {
      // Let sheet unmount / registry catch up before the next land step.
      await sleep(Platform.OS === 'android' ? 200 : 120);
    }
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'dismiss',
        id: scope,
        ok: true,
        detail:
          tapped.length > 0
            ? `dismissed ${tapped.length} (${rounds} round${rounds === 1 ? '' : 's'})`
            : 'nothing open',
        count: tapped.length,
        route: getAgentUiRoute(),
      });
    }
    return true;
  }

  if (op === 'route') {
    const route = getAgentUiRoute();
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'route',
        ok: Boolean(route),
        detail: route ?? 'unknown',
        route,
      });
    }
    return Boolean(route);
  }

  if (op === 'prefix') {
    if (!prefix) {
      if (emitStatus) {
        await writeAgentUiStatus({
          op: 'prefix',
          ok: false,
          detail: 'Missing prefix.',
          count: 0,
        });
      }
      return false;
    }
    const count = listAgentUiTargets().filter((e) =>
      e.testID.startsWith(prefix),
    ).length;
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'prefix',
        id: prefix,
        ok: count > 0,
        detail: count > 0 ? `matches=${count}` : 'no matches',
        count,
        route: getAgentUiRoute(),
      });
    }
    return count > 0;
  }

  if (op === 'reset' || op === 'goto') {
    const destination = resolveAgentUiDestination(
      op === 'reset' ? 'reset' : to,
    );
    if (!destination) {
      if (emitStatus) {
        await writeAgentUiStatus({
          op,
          ok: false,
          detail: 'Missing to/path destination for goto.',
        });
      }
      return false;
    }
    // Unblock the host before router.replace — on Android, solo goto/reset
    // can stall inside navigate/Documents I/O and never post a post-nav status
    // (batch steps skip emitStatus and still succeed). Re-post if navigate fails.
    if (emitStatus) {
      await writeAgentUiStatus({
        op,
        ok: true,
        detail: `Navigated to ${destination}`,
        route: destination,
      });
    }
    const ok = Boolean(agentUiNavigate(destination));
    if (emitStatus && !ok) {
      await writeAgentUiStatus({
        op,
        ok: false,
        detail: 'Navigator not ready (wait for app mount).',
        route: getAgentUiRoute(),
      });
    }
    // Today keeps a local selectedDate — goto/reset `/` must snap back to today
    // so next/prev day flows don’t walk past the weather window.
    if (ok && destination === '/') {
      useUI.getState().setSelectedDate(todayKey());
    }
    if (ok && refreshDump) {
      try {
        writeAgentUiDump();
      } catch {
        /* best-effort */
      }
    }
    return ok;
  }

  if (!id) {
    if (emitStatus) {
      await writeAgentUiStatus({
        op,
        ok: false,
        detail: 'Missing id query parameter.',
      });
    }
    return false;
  }

  if (op === 'exists') {
    const element = getAgentUiTarget(id);
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'exists',
        id,
        ok: Boolean(element),
        detail: element ? 'found' : 'not found',
        element,
        route: getAgentUiRoute(),
      });
    }
    return Boolean(element);
  }

  if (op === 'scroll') {
    const scrolled = await scrollAgentUiTargetIntoView(id);
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'scroll',
        id,
        ok: scrolled,
        detail: scrolled
          ? 'scrolled into view'
          : 'not found or no active scroll container',
        element: getAgentUiTarget(id),
        route: getAgentUiRoute(),
      });
    }
    if (scrolled && refreshDump) writeAgentUiDump();
    return scrolled;
  }

  if (op !== 'tap') {
    if (emitStatus) {
      await writeAgentUiStatus({
        op,
        id,
        ok: false,
        detail: `Unsupported op with id: ${op}`,
        route: getAgentUiRoute(),
      });
    }
    return false;
  }

  const tapped = tapAgentUiTarget(id);
  if (emitStatus) {
    await writeAgentUiStatus({
      op: 'tap',
      id,
      ok: tapped,
      detail: tapped ? 'tapped' : 'not found or not tappable',
      element: getAgentUiTarget(id),
      route: getAgentUiRoute(),
    });
  }
  if (tapped && refreshDump) writeAgentUiDump();
  return tapped;
}
