import { ALL_ADDONS_ON } from '@/addons/registry';

import { AgentRuntimeError, createAgentRuntime } from '../runtime';
import type {
    AgentCapabilityId,
    AgentDefinition,
    AgentProvider,
    AgentRuntimeState,
    AgentTool,
} from '../types';

const TEST_AGENT: AgentDefinition = {
  id: 'test-companion',
  version: 1,
  name: 'Test companion',
  description: 'Used only by runtime contract tests.',
  icon: 'agents',
  providerId: 'test-provider',
  access: 'included',
  requiredAddonId: 'travel',
  requiredCapabilities: ['travel.read'],
  optionalCapabilities: ['calendar.write'],
};

function runtimeState(
  grantedCapabilities: readonly AgentCapabilityId[] = ['travel.read'],
): AgentRuntimeState {
  return {
    installations: {
      [TEST_AGENT.id]: {
        agentId: TEST_AGENT.id,
        version: TEST_AGENT.version,
        enabled: true,
        grantedCapabilities: [...grantedCapabilities],
        installedAt: '2026-07-26T00:00:00.000Z',
        updatedAt: '2026-07-26T00:00:00.000Z',
      },
    },
    entitlements: {
      [TEST_AGENT.id]: { active: true, source: 'testing' },
    },
    enabledAddons: ALL_ADDONS_ON,
  };
}

describe('agent runtime', () => {
  it('exposes only declared and granted tools to a provider', async () => {
    const readTool: AgentTool = {
      id: 'travel-plan.read',
      capability: 'travel.read',
      description: 'Read the current travel plan.',
      execute: async () => ({ destination: 'Lisbon' }),
    };
    const provider: AgentProvider = {
      id: 'test-provider',
      run: async (request) => {
        expect(request.tools).toEqual([
          {
            id: readTool.id,
            capability: readTool.capability,
            description: readTool.description,
          },
        ]);
        const plan = await request.callTool(readTool.id, {});
        return { text: `Plan: ${(plan as { destination: string }).destination}` };
      },
    };
    const runtime = createAgentRuntime({
      definitions: [TEST_AGENT],
      providers: [provider],
      tools: [readTool],
    });

    await expect(
      runtime.run({ agentId: TEST_AGENT.id, message: 'Where are we going?' }, runtimeState()),
    ).resolves.toEqual({ text: 'Plan: Lisbon' });
  });

  it('blocks tools without explicit permission', async () => {
    const writeTool: AgentTool = {
      id: 'calendar.create',
      capability: 'calendar.write',
      description: 'Create a calendar activity.',
      execute: async () => ({ created: true }),
    };
    const provider: AgentProvider = {
      id: 'test-provider',
      run: async (request) => {
        await request.callTool(writeTool.id, {});
        return { text: 'Created' };
      },
    };
    const runtime = createAgentRuntime({
      definitions: [TEST_AGENT],
      providers: [provider],
      tools: [writeTool],
    });

    await expect(
      runtime.run({ agentId: TEST_AGENT.id, message: 'Add it' }, runtimeState()),
    ).rejects.toMatchObject<Partial<AgentRuntimeError>>({ code: 'tool-not-authorized' });
  });

  it('requires installation, enablement, entitlement, and required permissions', async () => {
    const runtime = createAgentRuntime({
      definitions: [TEST_AGENT],
      providers: [{ id: 'test-provider', run: async () => ({ text: 'ok' }) }],
      tools: [],
    });
    const state = runtimeState([]);

    await expect(
      runtime.run({ agentId: TEST_AGENT.id, message: 'Hello' }, state),
    ).rejects.toMatchObject<Partial<AgentRuntimeError>>({ code: 'permission-required' });
  });
});
