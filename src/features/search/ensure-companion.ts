import type { Href } from 'expo-router';

import type { AddonEnabledState, AddonId } from '@/addons/types';
import {
  ONTRACK_COMPANION,
  ONTRACK_COMPANION_ID,
  getAgent,
} from '@/agents/registry';
import type { AgentCapabilityId } from '@/agents/types';
import { useAddons } from '@/store/addons';
import { useAgents } from '@/store/agents';

const CORE_OPTIONAL = new Set(['calendar', 'profile', 'todos', 'shell']);

/** Grant required + addon-gated optional capabilities and enable the companion. */
export function companionCapabilitiesForAddons(
  enabledAddons: AddonEnabledState,
): AgentCapabilityId[] {
  const definition = getAgent(ONTRACK_COMPANION_ID) ?? ONTRACK_COMPANION;
  const granted: AgentCapabilityId[] = [...definition.requiredCapabilities];
  for (const capability of definition.optionalCapabilities ?? []) {
    const domain = capability.split('.')[0];
    if (CORE_OPTIONAL.has(domain)) {
      granted.push(capability);
      continue;
    }
    if (enabledAddons[domain as AddonId]) granted.push(capability);
  }
  return [...new Set(granted)];
}

export function ensureCompanionReady(): boolean {
  const definition = getAgent(ONTRACK_COMPANION_ID);
  if (!definition) return false;
  useAgents.getState().ensureAgentReady(
    ONTRACK_COMPANION_ID,
    companionCapabilitiesForAddons(useAddons.getState().enabled),
  );
  const installation = useAgents.getState().installations[ONTRACK_COMPANION_ID];
  return Boolean(installation?.enabled);
}

export type CompanionNavigateHandler = (href: Href) => void;

let navigateHandler: CompanionNavigateHandler | null = null;

export function setCompanionNavigateHandler(handler: CompanionNavigateHandler | null) {
  navigateHandler = handler;
}

export function companionNavigate(href: Href): { opened: boolean } {
  if (!navigateHandler) return { opened: false };
  navigateHandler(href);
  return { opened: true };
}
