import {
  formatAgentUiSeedDetail,
  normalizeFixtureName,
  restoreTravelPlansFromDocuments,
  seedAgentUiFixture,
} from './fixtures';
import { resolveAgentUiFlow } from './flows';
import { ensurePastLaunchGates } from './handle-agent-ui-gates';
import { asBool, asSingle } from './handle-agent-ui-helpers';
import { runAssert } from './handle-agent-ui-assert';
import { continueAgentUiRequest } from './handle-agent-ui-ops-simple';
import { parseOp } from './handle-agent-ui-parse';
import type { AgentUiRequest } from './handle-agent-ui-types';
import {
  writeAgentUiStatus,
  type AgentUiStatusResult,
} from './persist';
import { isAgentUiEnabled } from './registry';
import { getAgentUiRoute } from './route';
import { applyAgentUiSlotFromUnknown } from './slot';

/**
 * Run one agent-ui op. By default writes status (and dump only for `dump`).
 * Batch/flow steps pass `emitStatus: false` and collect results.
 */
export async function handleAgentUiRequest(
  request: AgentUiRequest,
  options: { emitStatus?: boolean } = {},
): Promise<boolean> {
  const emitStatus = options.emitStatus !== false;
  applyAgentUiSlotFromUnknown(request.slot);

  if (!isAgentUiEnabled()) {
    if (emitStatus) {
      await writeAgentUiStatus({
        op: String(asSingle(request.op) ?? 'dump'),
        id: asSingle(request.id),
        ok: false,
        detail: 'Agent UI bridge is only available in __DEV__ builds.',
      });
    }
    return false;
  }

  const op = parseOp(asSingle(request.op) ?? 'dump');
  const id = asSingle(request.id);
  const to = asSingle(request.to) ?? asSingle(request.path);
  const prefix = asSingle(request.prefix) ?? (op === 'prefix' ? id : undefined);
  const refreshDump = asBool(request.refreshDump);

  if (op === 'flow') {
    const flowName = to ?? id;
    const steps = resolveAgentUiFlow(flowName);
    if (!steps) {
      if (emitStatus) {
        await writeAgentUiStatus({
          op: 'flow',
          ok: false,
          detail: `Unknown flow: ${flowName ?? '(missing)'}`,
        });
      }
      return false;
    }
    if (!(await ensurePastLaunchGates())) {
      if (emitStatus) {
        await writeAgentUiStatus({
          op: 'flow',
          id: flowName,
          ok: false,
          detail: 'Stuck on /welcome or /onboarding (launch gates failed)',
          route: getAgentUiRoute(),
        });
      }
      return false;
    }
    // Expand inline so status.op stays `flow` (host scripts wait on that).
    const results: AgentUiStatusResult[] = [];
    let allOk = true;
    for (const step of steps) {
      const stepOp = parseOp(asSingle(step.op) ?? 'dump');
      const ok = await handleAgentUiRequest(step, { emitStatus: false });
      const stepId =
        asSingle(step.id) ?? asSingle(step.prefix) ?? asSingle(step.to);
      results.push({
        op: stepOp,
        id: stepId,
        ok,
        route: getAgentUiRoute(),
        detail: ok ? 'ok' : 'failed',
      });
      if (!ok) {
        allOk = false;
        break;
      }
    }
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'flow',
        id: flowName,
        ok: allOk,
        detail: `${results.filter((r) => r.ok).length}/${steps.length} ok`,
        results,
        route: getAgentUiRoute(),
      });
    }
    return allOk;
  }

  if (op === 'batch') {
    const ops = Array.isArray(request.ops) ? request.ops : [];
    if (ops.length === 0) {
      if (emitStatus) {
        await writeAgentUiStatus({
          op: 'batch',
          ok: false,
          detail: 'Missing ops array for batch.',
          results: [],
        });
      }
      return false;
    }
    const results: AgentUiStatusResult[] = [];
    let allOk = true;
    for (const step of ops) {
      const stepOp = parseOp(asSingle(step.op) ?? 'dump');
      const ok = await handleAgentUiRequest(step, { emitStatus: false });
      const stepId =
        asSingle(step.id) ?? asSingle(step.prefix) ?? asSingle(step.to);
      results.push({
        op: stepOp,
        id: stepId,
        ok,
        route: getAgentUiRoute(),
        detail: ok ? 'ok' : 'failed',
      });
      if (!ok) {
        allOk = false;
        break;
      }
    }
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'batch',
        ok: allOk,
        detail: `${results.filter((r) => r.ok).length}/${ops.length} ok`,
        results,
        route: getAgentUiRoute(),
      });
    }
    return allOk;
  }

  if (op === 'seed') {
    const seedName = to ?? id;
    if (!(await ensurePastLaunchGates())) {
      if (emitStatus) {
        await writeAgentUiStatus({
          op: 'seed',
          ok: false,
          detail: 'Stuck on /welcome or /onboarding (launch gates failed)',
          route: getAgentUiRoute(),
        });
      }
      return false;
    }
    const seeded =
      normalizeFixtureName(seedName) === 'travel-restore-documents'
        ? await restoreTravelPlansFromDocuments()
        : seedAgentUiFixture(seedName);
    if (emitStatus) {
      await writeAgentUiStatus({
        op: 'seed',
        ok: Boolean(seeded),
        detail: seeded
          ? formatAgentUiSeedDetail(seeded)
          : `Unknown fixture: ${seedName ?? '(missing)'}`,
        id: seeded?.primaryId,
        route: getAgentUiRoute(),
      });
    }
    return Boolean(seeded);
  }

  if (op === 'assert') {
    return await runAssert(request, { id, prefix, to, emitStatus });
  }

  return continueAgentUiRequest(request, {
    emitStatus,
    op,
    id,
    prefix,
    to,
    refreshDump,
  });
}
