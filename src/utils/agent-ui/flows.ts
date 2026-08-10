import { Platform } from 'react-native';

import { AGENT_UI_ADDON_FLOWS } from './flows-addons';
import { AGENT_UI_DAILY_FLOWS } from './flows-daily';
import { AGENT_UI_LIST_FLOWS } from './flows-lists';
import { AGENT_UI_TRAVEL_FLOWS } from './flows-travel';
import {
    AGENT_UI_ANDROID_WAIT_TIMEOUT_MS,
    AGENT_UI_WAIT_TIMEOUT_MS,
} from './flows-waits';

export {
    AGENT_UI_ANDROID_WAIT_TIMEOUT_MS,
    AGENT_UI_WAIT_TIMEOUT_MS,
} from './flows-waits';

/** Minimal step shape for named flows (expanded by `op=flow`). */
export type AgentUiFlowStep = {
  op: string;
  to?: string;
  id?: string;
  prefix?: string;
  timeoutMs?: number;
  ms?: number;
};

/**
 * Named multi-step recipes. Expanded in-app by `op=flow` so one host round trip
 * covers seed → navigate → settle → tap.
 */

function flowWaitTimeoutMs(): number {
  return Platform.OS === 'android'
    ? AGENT_UI_ANDROID_WAIT_TIMEOUT_MS
    : AGENT_UI_WAIT_TIMEOUT_MS;
}

export const AGENT_UI_FLOWS = {
  ...AGENT_UI_TRAVEL_FLOWS,
  ...AGENT_UI_DAILY_FLOWS,
  ...AGENT_UI_LIST_FLOWS,
  ...AGENT_UI_ADDON_FLOWS,
} as const satisfies Record<string, readonly AgentUiFlowStep[]>;

export type AgentUiFlowName = keyof typeof AGENT_UI_FLOWS;

export function listAgentUiFlowNames(): AgentUiFlowName[] {
  return Object.keys(AGENT_UI_FLOWS) as AgentUiFlowName[];
}

export function resolveAgentUiFlow(
  name: string | undefined,
): AgentUiFlowStep[] | null {
  if (!name) return null;
  const key = name.trim() as AgentUiFlowName;
  const steps = AGENT_UI_FLOWS[key];
  if (!steps) return null;
  const waitMs = flowWaitTimeoutMs();
  return steps.map((step) => {
    const next: AgentUiFlowStep = { ...step };
    if (
      next.op === 'wait' &&
      next.timeoutMs != null &&
      next.timeoutMs === AGENT_UI_WAIT_TIMEOUT_MS
    ) {
      next.timeoutMs = waitMs;
    }
    return next;
  });
}
