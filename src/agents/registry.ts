import type { AddonEnabledState } from '@/addons/types';
import type { Entitlement } from '@/entitlements/types';

import type {
  AgentAvailability,
  AgentCapabilityDefinition,
  AgentCapabilityId,
  AgentDefinition,
  AgentEntitlementState,
  AgentId,
} from './types';

export const AGENT_CAPABILITIES = {
  'calendar.read': {
    id: 'calendar.read',
    name: 'View Calendar',
    description: 'Read scheduled activities and dates.',
  },
  'calendar.write': {
    id: 'calendar.write',
    name: 'Change Calendar',
    description: 'Create or update scheduled activities.',
    sensitive: true,
  },
  'profile.read': {
    id: 'profile.read',
    name: 'View Preferences',
    description: 'Read goals and app preferences.',
  },
  'profile.write': {
    id: 'profile.write',
    name: 'Change Preferences',
    description: 'Update goals and app preferences.',
    sensitive: true,
  },
  'food.read': {
    id: 'food.read',
    name: 'View Food Data',
    description: 'Read meals and nutrition history.',
  },
  'food.write': {
    id: 'food.write',
    name: 'Change Food Data',
    description: 'Create or update meals and nutrition records.',
    sensitive: true,
  },
  'food.search': {
    id: 'food.search',
    name: 'Search Food',
    description: 'Search supported food and nutrition sources.',
  },
  'fitness.read': {
    id: 'fitness.read',
    name: 'View Fitness Data',
    description: 'Read workouts and exercise history.',
  },
  'fitness.write': {
    id: 'fitness.write',
    name: 'Change Fitness Data',
    description: 'Create or update workouts and exercise records.',
    sensitive: true,
  },
  'travel.read': {
    id: 'travel.read',
    name: 'View Travel Plans',
    description: 'Read trips and itinerary details.',
  },
  'travel.write': {
    id: 'travel.write',
    name: 'Change Travel Plans',
    description: 'Create or update trips and itinerary details.',
    sensitive: true,
  },
  'travel.search': {
    id: 'travel.search',
    name: 'Search Travel',
    description: 'Search supported flight and stay providers.',
  },
  'plants.read': {
    id: 'plants.read',
    name: 'View Plant Data',
    description: 'Read plant profiles and care history.',
  },
  'plants.write': {
    id: 'plants.write',
    name: 'Change Plant Data',
    description: 'Create or update plant care records.',
    sensitive: true,
  },
  'todos.read': {
    id: 'todos.read',
    name: 'View Checklists',
    description: 'Read lists and open tasks.',
  },
  'todos.write': {
    id: 'todos.write',
    name: 'Change Checklists',
    description: 'Create, update, complete, or remove checklist items.',
    sensitive: true,
  },
  'shell.act': {
    id: 'shell.act',
    name: 'Navigate And Speak',
    description: 'Open screens, speak replies, and hand off to maps or the device assistant.',
  },
} as const satisfies Partial<Record<AgentCapabilityId, AgentCapabilityDefinition>>;

export const ONTRACK_COMPANION_ID = 'ontrack-companion';

export const ONTRACK_COMPANION: AgentDefinition = {
  id: ONTRACK_COMPANION_ID,
  version: 1,
  name: 'onTrack',
  description: 'Find anything in the app and get things done by voice or text.',
  icon: 'search',
  providerId: 'ontrack-companion',
  access: 'included',
  requiredCapabilities: ['todos.read', 'todos.write', 'shell.act'],
  optionalCapabilities: [
    'calendar.read',
    'calendar.write',
    'profile.read',
    'travel.read',
    'travel.write',
    'food.read',
    'plants.read',
    'fitness.read',
  ],
};

/**
 * First included companion. Prompts and tools live in `src/features/search/`,
 * not in this catalog manifest.
 */
export const AGENTS: readonly AgentDefinition[] = [ONTRACK_COMPANION];

export function createAgentRegistry(definitions: readonly AgentDefinition[]) {
  const byId = new Map<AgentId, AgentDefinition>();
  for (const definition of definitions) {
    if (!definition.id.trim()) throw new Error('Agent ids cannot be empty.');
    if (byId.has(definition.id)) throw new Error(`Duplicate agent id: ${definition.id}`);
    if (!definition.providerId.trim()) {
      throw new Error(`Agent ${definition.id} must declare a provider.`);
    }
    const capabilities = [
      ...definition.requiredCapabilities,
      ...(definition.optionalCapabilities ?? []),
    ];
    if (new Set(capabilities).size !== capabilities.length) {
      throw new Error(`Agent ${definition.id} declares a capability more than once.`);
    }
    for (const capability of capabilities) {
      if (!AGENT_CAPABILITIES[capability as keyof typeof AGENT_CAPABILITIES]) {
        throw new Error(`Agent ${definition.id} uses unknown capability: ${capability}`);
      }
    }
    byId.set(definition.id, definition);
  }
  return byId;
}

const AGENT_BY_ID = createAgentRegistry(AGENTS);

export function getAgent(id: AgentId): AgentDefinition | undefined {
  return AGENT_BY_ID.get(id);
}

export function getAgentCapability(
  id: AgentCapabilityId,
): AgentCapabilityDefinition | undefined {
  return AGENT_CAPABILITIES[id as keyof typeof AGENT_CAPABILITIES];
}

export function defaultAgentEntitlements(
  definitions: readonly AgentDefinition[] = AGENTS,
): AgentEntitlementState {
  const isTesting = process.env.EXPO_PUBLIC_APP_ENV === 'testflight';
  return Object.fromEntries(
    definitions.map((definition) => [
      definition.id,
      {
        active: isTesting || definition.access === 'included',
        source: isTesting ? 'testing' : 'included',
      } satisfies Entitlement,
    ]),
  );
}

export function agentAvailability(
  definition: AgentDefinition,
  entitlements: AgentEntitlementState,
  enabledAddons: AddonEnabledState,
): AgentAvailability {
  if (!entitlements[definition.id]?.active) {
    return { available: false, reason: 'not-entitled' };
  }
  if (definition.requiredAddonId && !enabledAddons[definition.requiredAddonId]) {
    return { available: false, reason: 'required-addon-disabled' };
  }
  return { available: true };
}
