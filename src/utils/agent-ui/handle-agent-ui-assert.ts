/** Assert / wait-target helpers for agent-ui ops. */

import {
  getAgentUiTarget,
  listAgentUiTargets,
} from './registry';
import { getAgentUiRoute, resolveAgentUiDestination } from './route';
import { writeAgentUiStatus, type AgentUiStatusResult } from './persist';
import { asSingle, asTruthyFlag } from './handle-agent-ui-helpers';
import type { AgentUiRequest } from './handle-agent-ui-types';

export function hasWaitTarget(
  id: string | undefined,
  prefix: string | undefined,
  routeTarget: string | undefined,
): boolean {
  return Boolean(id || prefix || routeTarget);
}

export function routeMatches(current: string | null, target: string): boolean {
  if (!current) return false;
  const resolved = resolveAgentUiDestination(target) ?? target;
  const want = resolved.split('?')[0];
  if (current === want) return true;
  if (current.endsWith(want)) return true;
  if (want !== '/' && current.includes(want)) return true;
  return false;
}

export async function runAssert(
  request: AgentUiRequest,
  opts: {
    id?: string;
    prefix?: string;
    to?: string;
    emitStatus: boolean;
  },
): Promise<boolean> {
  const { id, prefix, to, emitStatus } = opts;
  const contains = asSingle(request.contains);
  const wantMissing = asTruthyFlag(request.missing);
  const checks: AgentUiStatusResult[] = [];
  const route = getAgentUiRoute();

  if (id) {
    const element = getAgentUiTarget(id);
    const found = Boolean(element);
    if (wantMissing) {
      checks.push({
        op: 'missing',
        id,
        ok: !found,
        detail: found ? 'still registered' : 'absent',
        element,
        route,
      });
    } else {
      checks.push({
        op: 'exists',
        id,
        ok: found,
        detail: found ? 'found' : 'not found',
        element,
        route,
      });
      if (contains) {
        const label = element?.label ?? '';
        const value = element?.value ?? '';
        const needle = contains.toLowerCase();
        const inLabel = label.toLowerCase().includes(needle);
        const inValue = value.toLowerCase().includes(needle);
        const ok = inLabel || inValue;
        checks.push({
          op: 'label',
          id,
          ok: found && ok,
          detail: found
            ? ok
              ? inValue && !inLabel
                ? `value contains "${contains}"`
                : `label contains "${contains}"`
              : `label "${label}" value "${value}" missing "${contains}"`
            : 'missing element for label check',
          element,
          route,
        });
      }
    }
  } else if (wantMissing) {
    checks.push({
      op: 'missing',
      ok: false,
      detail: 'Missing id for missing assert.',
      route,
    });
  } else if (contains) {
    checks.push({
      op: 'label',
      ok: false,
      detail: 'Missing id for label contains assert.',
      route,
    });
  }

  if (prefix) {
    const count = listAgentUiTargets().filter((e) =>
      e.testID.startsWith(prefix),
    ).length;
    checks.push({
      op: 'prefix',
      id: prefix,
      ok: count > 0,
      detail: count > 0 ? `matches=${count}` : 'no matches',
      count,
      route,
    });
  }

  if (to) {
    const ok = routeMatches(route, to);
    checks.push({
      op: 'route',
      id: to,
      ok,
      detail: ok ? `route=${route}` : `route=${route ?? 'unknown'} want=${to}`,
      route,
    });
  }

  const ok = checks.length > 0 && checks.every((c) => c.ok);
  if (emitStatus) {
    await writeAgentUiStatus({
      op: 'assert',
      id: id ?? prefix ?? to,
      ok,
      detail:
        checks.length === 0
          ? 'assert requires --exists/--missing/--prefix/--route/--contains'
          : ok
            ? `${checks.length} check(s) passed`
            : checks
                .filter((c) => !c.ok)
                .map((c) => c.detail || c.op)
                .join('; '),
      results: checks,
      route,
      element: id ? getAgentUiTarget(id) : undefined,
      count: prefix
        ? listAgentUiTargets().filter((e) => e.testID.startsWith(prefix)).length
        : undefined,
    });
  }
  return ok;
}

