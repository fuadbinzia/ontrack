import { ALL_ADDONS_ON } from '@/addons/registry';
import {
    AGENTS,
    agentAvailability,
    createAgentRegistry,
    getAgentCapability,
} from '../registry';
import type { AgentDefinition } from '../types';

const TEST_AGENT: AgentDefinition = {
  id: 'test-companion',
  version: 1,
  name: 'Test companion',
  description: 'Used only to validate the agent extension contract.',
  icon: 'agents',
  providerId: 'test-provider',
  access: 'included',
  requiredAddonId: 'travel',
  requiredCapabilities: ['travel.read'],
  optionalCapabilities: ['travel.search'],
};

describe('agent registry', () => {
  it('ships the platform without creating concrete agents', () => {
    expect(AGENTS).toEqual([]);
  });

  it('validates a declarative agent manifest', () => {
    expect(createAgentRegistry([TEST_AGENT]).get(TEST_AGENT.id)).toEqual(TEST_AGENT);
    expect(getAgentCapability('travel.read')?.name).toBe('View Travel Plans');
  });

  it('rejects duplicate ids and unknown capabilities', () => {
    expect(() => createAgentRegistry([TEST_AGENT, TEST_AGENT])).toThrow('Duplicate agent id');
    expect(() =>
      createAgentRegistry([
        {
          ...TEST_AGENT,
          id: 'unknown-capability',
          requiredCapabilities: ['travel.act'],
        },
      ]),
    ).toThrow('unknown capability');
  });

  it('requires both entitlement and the connected add-on', () => {
    const entitlements = {
      [TEST_AGENT.id]: { active: true, source: 'included' as const },
    };
    expect(agentAvailability(TEST_AGENT, entitlements, ALL_ADDONS_ON)).toEqual({
      available: true,
    });
    expect(
      agentAvailability(TEST_AGENT, entitlements, {
        ...ALL_ADDONS_ON,
        travel: false,
      }),
    ).toEqual({ available: false, reason: 'required-addon-disabled' });
    expect(agentAvailability(TEST_AGENT, {}, ALL_ADDONS_ON)).toEqual({
      available: false,
      reason: 'not-entitled',
    });
  });
});
